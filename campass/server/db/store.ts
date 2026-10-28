import { randomBytes, randomUUID } from "node:crypto";
import pg, { type PoolClient, type QueryResultRow } from "pg";
import { AppError, calculateRoute, startPoint, waypoints } from "../../shared/utils/routing.ts";
import { currentPlaceId } from "../../shared/utils/catalog.ts";
import { allPlaces } from "../services/rooms.ts";
import { graphEdges, nodeArea, nodeLabel } from "../../shared/utils/campus3d/route.ts";
import { campusBuildings } from "../../shared/utils/campus3d/types.ts";
import { confusionLevel, confusionLevels, confusionReasons } from "../../shared/utils/confusion-advice.ts";
import type { Session, Feedback, RecognitionFeedback } from "../../shared/types/session.ts";
export type { Session, Feedback, RecognitionFeedback } from "../../shared/types/session.ts";

export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
type Connection = PoolClient | pg.Pool;

function connectionOptions(url: string) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname);
  return {
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    // Shared transaction pooling does not support named prepared statements.
    // node-postgres only creates those when a query config has a name; use text/values below.
    ssl: local ? false : { rejectUnauthorized: true },
  };
}

export class Store {
  readonly pool: pg.Pool;

  constructor(url: string) {
    this.pool = new pg.Pool(connectionOptions(url));
  }

  async close() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values: unknown[] = [],
    connection: Connection = this.pool,
  ): Promise<T[]> {
    return (await connection.query<T>(sql, values)).rows;
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await fn(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async limit(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const [row] = await this.query<{ hits: number }>(
      `INSERT INTO rate_limits(key,hits,expires) VALUES ($1,1,$2)
       ON CONFLICT(key) DO UPDATE SET
         hits=CASE WHEN rate_limits.expires <= $3 THEN 1 ELSE rate_limits.hits+1 END,
         expires=CASE WHEN rate_limits.expires <= $3 THEN $2 ELSE rate_limits.expires END
       RETURNING hits`,
      [key, now + windowMs, now],
    );
    if (row.hits > max)
      throw new AppError("요청이 많아요. 잠시 후 다시 시도해 주세요.", 429, "RATE_LIMITED");
    return row.hits;
  }

  async loginAttempt(key: string, authorized: boolean) {
    const outcome = await this.transaction(async (client) => {
      // Transaction-scoped lock serializes attempts across server instances.
      await this.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key], client);
      const now = Date.now();
      const [row] = await this.query<{ hits: number }>(
        "SELECT hits FROM rate_limits WHERE key=$1 AND expires>$2",
        [key, now],
        client,
      );
      if (row && row.hits >= 5) return { kind: "blocked" as const };
      if (!authorized) {
        const [failure] = await this.query<{ hits: number }>(
          `INSERT INTO rate_limits(key,hits,expires) VALUES ($1,1,$2)
           ON CONFLICT(key) DO UPDATE SET
             hits=CASE WHEN rate_limits.expires <= $3 THEN 1 ELSE rate_limits.hits+1 END,
             expires=CASE WHEN rate_limits.expires <= $3 THEN $2 ELSE rate_limits.expires END
           RETURNING hits`,
          [key, now + 600_000, now],
          client,
        );
        if (failure.hits === 5)
          await this.query("UPDATE rate_limits SET expires=$2 WHERE key=$1", [key, now + 600_000], client);
        return { kind: failure.hits >= 5 ? "blocked" as const : "invalid" as const };
      }
      await this.query("DELETE FROM rate_limits WHERE key=$1", [key], client);
      const session = {
        id: randomBytes(32).toString("hex"),
        expires: now + ADMIN_SESSION_SECONDS * 1000,
      };
      await this.query("INSERT INTO admin_sessions(id,expires) VALUES ($1,$2)", [session.id, session.expires], client);
      return { kind: "ok" as const, session };
    });
    if (outcome.kind === "blocked")
      throw new AppError("로그인 시도가 많아요. 10분 후 다시 시도해 주세요.", 429, "RATE_LIMITED");
    if (outcome.kind === "invalid")
      throw new AppError("아이디 또는 비밀번호를 확인해 주세요.", 401, "UNAUTHORIZED");
    return outcome.session!;
  }

  async hasAdminSession(id: string) {
    const rows = await this.query("SELECT 1 FROM admin_sessions WHERE id=$1 AND expires>$2", [id, Date.now()]);
    return rows.length > 0;
  }

  async deleteAdminSession(id: string) {
    await this.query("DELETE FROM admin_sessions WHERE id=$1", [id]);
  }

  private async save(session: Session, client: PoolClient) {
    await this.query("UPDATE sessions SET data=$1::jsonb WHERE id=$2", [JSON.stringify(session), session.id], client);
  }

  private async passage(session: Session, client: PoolClient) {
    const id = session.route.steps[session.currentStep].id;
    await this.query(
      "INSERT INTO passages(session_id,waypoint_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [session.id, id], client,
    );
    if (!session.visited.includes(id)) session.visited.push(id);
  }

  async create(owner: string, start: string, destination: string, elevator: boolean, option?: string): Promise<Session> {
    const route = calculateRoute(start, destination, elevator, allPlaces(), { option });
    return this.transaction(async (client) => {
      const session: Session = {
        id: randomUUID(),
        destination: currentPlaceId(destination),
        route,
        currentStep: 0,
        version: 0,
        status: route.steps.length === 1 ? "completed" : "active",
        recovered: false,
        recoveryDirection: "unknown",
        visited: [],
        feedbackSubmitted: false,
      };
      await this.query("INSERT INTO sessions(id,owner,data) VALUES ($1,$2,$3::jsonb)",
        [session.id, owner, JSON.stringify(session)], client);
      await this.passage(session, client);
      await this.save(session, client);
      return session;
    });
  }

  async get(id: string, owner: string, client?: PoolClient): Promise<Session> {
    const [row] = await this.query<{ data: Session }>(
      `SELECT data FROM sessions WHERE id=$1 AND owner=$2${client ? " FOR UPDATE" : ""}`,
      [id, owner], client,
    );
    if (!row) throw new AppError("안내 기록을 찾을 수 없어요.", 404, "NOT_FOUND");
    const session = row.data;
    session.destination = currentPlaceId(session.destination);
    return session;
  }

  private async active(id: string, owner: string, client: PoolClient, version?: number) {
    const session = await this.get(id, owner, client);
    if (session.status !== "active")
      throw new AppError("이미 도착한 안내입니다.", 409, "COMPLETED");
    if (version !== undefined && session.version !== version)
      throw new AppError("단계가 변경됐어요. 새로고침해 주세요.", 409, "STALE_VERSION");
    return session;
  }

  async advance(id: string, owner: string, version: number) {
    return this.transaction(async (client) => {
      const session = await this.active(id, owner, client, version);
      session.currentStep++;
      session.version++;
      session.recovered = false;
      session.recoveryDirection = "unknown";
      if (session.currentStep === session.route.steps.length - 1) session.status = "completed";
      await this.passage(session, client);
      await this.save(session, client);
      return session;
    });
  }

  async previous(id: string, owner: string, version: number) {
    return this.transaction(async (client) => {
      const session = await this.get(id, owner, client);
      if (session.version !== version)
        throw new AppError("단계가 변경되었어요. 새로고침해 주세요.", 409, "STALE_VERSION");
      if (session.currentStep <= 0)
        throw new AppError("첫 번째 단계입니다.", 409, "FIRST_STEP");
      session.currentStep--;
      session.version++;
      session.status = "active";
      session.recovered = false;
      session.recoveryDirection = "unknown";
      await this.save(session, client);
      return session;
    });
  }

  async confusion(id: string, owner: string) {
    return this.transaction(async (client) => {
      const session = await this.active(id, owner, client);
      await this.query(
        "INSERT INTO confusions(session_id,waypoint_id,reason) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [id, session.route.steps[session.currentStep].id, "위치 재확인"], client,
      );
      return session;
    });
  }

  async recover(
    id: string, owner: string, waypointId: string, version: number,
    direction: Session["recoveryDirection"] = "unknown",
  ) {
    return this.transaction(async (client) => {
      if (!["forward", "backward", "unknown"].includes(direction))
        throw new AppError("위치 방향을 확인해 주세요.");
      const session = await this.active(id, owner, client, version);
      const chosen = session.route.options?.find((option) => option.id === session.route.option);
      const route = calculateRoute(waypointId, session.destination, session.route.elevator, allPlaces());
      const same = route.options.find((option) => option.name === chosen?.name);
      session.route = same && same.id !== route.option
        ? calculateRoute(waypointId, session.destination, session.route.elevator, allPlaces(), { option: same.id })
        : route;
      session.currentStep = 0;
      session.version++;
      session.recovered = true;
      session.recoveryDirection = direction;
      if (session.route.steps.length === 1) session.status = "completed";
      await this.passage(session, client);
      await this.save(session, client);
      return session;
    });
  }

  async feedback(id: string, owner: string, input: Feedback) {
    return this.transaction(async (client) => {
      const session = await this.get(id, owner, client);
      if (session.status !== "completed")
        throw new AppError("도착 후 피드백을 보낼 수 있어요.", 409, "NOT_COMPLETED");
      if (session.feedbackSubmitted) return { saved: true, duplicate: true };
      if (typeof input.confused !== "boolean" || (input.comment?.length ?? 0) > 500)
        throw new AppError("피드백 내용을 확인해 주세요.");
      if (input.confused && (!input.waypointId || !session.visited.includes(input.waypointId) ||
        !["방향 혼란", "사진 불일치", "지도랑 달랐어요", "표지판 부족", "기타"].includes(input.reason ?? "")))
        throw new AppError("방문한 구간과 혼란 이유를 선택해 주세요.");
      if (input.confused)
        await this.query(
          "INSERT INTO confusions(session_id,waypoint_id,reason) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [id, input.waypointId, input.reason], client,
        );
      const inserted = await this.query(
        "INSERT INTO feedback(session_id,data) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING RETURNING session_id",
        [id, JSON.stringify(input)], client,
      );
      session.feedbackSubmitted = true;
      await this.save(session, client);
      return { saved: true, duplicate: inserted.length === 0 };
    });
  }

  async recognitionFeedback(input: RecognitionFeedback) {
    if (!input.predictedWaypointId || typeof input.confidence !== "number" ||
      !["forward", "backward", "unknown"].includes(input.direction))
      throw new AppError("사진 인식 피드백 내용을 확인해 주세요.");
    await this.query("INSERT INTO recognition_feedback(data) VALUES ($1::jsonb)", [JSON.stringify(input)]);
    return { saved: true };
  }

  async insights(filters: { period?: string; building?: string; reason?: string; demo?: string } = {}) {
    const { period = "all", building, reason, demo = "include" } = filters;
    if (!["all", "7d", "today"].includes(period) || !["include", "exclude"].includes(demo) ||
      (building !== undefined && !campusBuildings().some((b) => b.id === building)) ||
      (reason !== undefined && !confusionReasons.some((r) => r === reason)))
      throw new AppError("통계 필터를 확인해 주세요.");
    const now = new Date();
    const day = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const midnight = Date.parse(`${day}T00:00:00+09:00`);
    const since = period === "all" ? null : new Date(
      midnight - (period === "7d" ? 6 * 24 * 60 * 60 * 1000 : 0),
    ).toISOString();
    const rows = await this.query<{
      session_id: string; id: string; reason: string | null; feedback: Feedback | null; demo: boolean;
    }>(`
      SELECT p.session_id, p.waypoint_id AS id, c.reason, f.data AS feedback,
        (s.id LIKE 'demo-%' AND s.owner='demo' AND s.data->>'demo'='true') AS demo
      FROM passages p JOIN sessions s ON s.id=p.session_id
      LEFT JOIN confusions c ON c.session_id=p.session_id AND c.waypoint_id=p.waypoint_id
      LEFT JOIN feedback f ON f.session_id=p.session_id
      WHERE ($1::timestamptz IS NULL OR p.created_at >= $1::timestamptz)
    `, [since]);
    const areas = new Map<string, string>();
    const filtered = rows.filter((row) => {
      if (!building) return true;
      if (!areas.has(row.id)) {
        const point = startPoint(row.id);
        const link = point?.link ? graphEdges.find((edge) => edge.id === point.link) : undefined;
        areas.set(row.id, nodeArea(link?.a ?? point?.node ?? row.id));
      }
      return areas.get(row.id) === building;
    });
    const demoSessions = new Set(filtered.filter((row) => row.demo).map((row) => row.session_id)).size;
    const groups = new Map<string, { passages: number; confusions: number; reasons: Map<string, number> }>();
    const feedbackSessions = new Set<string>();
    for (const row of filtered) {
      if (demo === "exclude" && row.demo) continue;
      const group = groups.get(row.id) ?? { passages: 0, confusions: 0, reasons: new Map<string, number>() };
      group.passages++;
      if (row.reason && (!reason || row.reason === reason)) {
        group.confusions++;
        group.reasons.set(row.reason, (group.reasons.get(row.reason) ?? 0) + 1);
      }
      groups.set(row.id, group);
      if (row.feedback && (!reason || row.feedback.reason === reason))
        feedbackSessions.add(row.session_id);
    }
    const points = [...groups].map(([id, group]) => {
      const reasons = [...group.reasons].map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, "ko"));
      return {
        id, passages: group.passages, confusions: group.confusions,
        name: waypoints.find((waypoint) => waypoint.id === id)?.name ?? nodeLabel(id),
        rate: Math.round(group.confusions / group.passages * 1000) / 10,
        level: confusionLevel(group.passages, group.confusions),
        reasons, topReason: reasons[0]?.reason ?? null,
      };
    }).sort((a, b) => confusionLevels.indexOf(a.level) - confusionLevels.indexOf(b.level) ||
      b.confusions / b.passages - a.confusions / a.passages || b.confusions - a.confusions);
    const passages = points.reduce((n, point) => n + point.passages, 0);
    const confusions = points.reduce((n, point) => n + point.confusions, 0);
    return {
      passages, confusions,
      rate: passages ? Math.round(confusions / passages * 1000) / 10 : 0,
      feedbacks: feedbackSessions.size, points, demoSessions,
      scope: period === "all" ? "all-time" : period,
      dataMode: "demo-route-activity",
    };
  }
}
