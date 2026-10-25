import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AppError, calculateRoute, startPoint, waypoints, type Route } from "./routing.ts";
import { currentPlaceId } from "./catalog.ts";
import { allPlaces } from "./rooms.ts";
import { graphEdges, nodeArea, nodeLabel } from "./campus3d/route.ts";
import { campusBuildings } from "./campus3d/types.ts";
import { confusionLevel, confusionLevels, confusionReasons } from "./confusion-advice.ts";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
export type Session = {
  id: string;
  demo?: boolean;
  destination: string;
  route: Route;
  currentStep: number;
  version: number;
  status: "active" | "completed";
  recovered: boolean;
  recoveryDirection: "forward" | "backward" | "unknown";
  visited: string[];
  feedbackSubmitted: boolean;
};
export type Feedback = {
  confused: boolean;
  waypointId?: string;
  reason?: string;
  comment?: string;
};
export type RecognitionFeedback = {
  predictedWaypointId: string;
  confidence: number;
  direction: "forward" | "backward" | "unknown";
  correctedWaypointId?: string;
};
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS passages (session_id TEXT REFERENCES sessions(id), waypoint_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(session_id,waypoint_id));
      CREATE TABLE IF NOT EXISTS confusions (session_id TEXT, waypoint_id TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(session_id,waypoint_id), FOREIGN KEY(session_id,waypoint_id) REFERENCES passages(session_id,waypoint_id));
      CREATE TABLE IF NOT EXISTS feedback (session_id TEXT PRIMARY KEY REFERENCES sessions(id), data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS recognition_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      PRAGMA user_version=1;`);
  }
  close() {
    this.db.close();
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  limit(key: string, max: number, windowMs: number) {
    const now = Date.now();
    this.db.prepare("DELETE FROM rate_limits WHERE expires <= ?").run(now);
    const row = this.db
      .prepare(
        `INSERT INTO rate_limits(key,hits,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits`,
      )
      .get(key, now + windowMs) as { hits: number };
    if (row.hits > max)
      throw new AppError(
        "요청이 많아요. 잠시 후 다시 시도해 주세요.",
        429,
        "RATE_LIMITED",
      );
    return row.hits;
  }
  checkLoginLimit(key: string) {
    const row = this.db
      .prepare("SELECT hits FROM rate_limits WHERE key=? AND expires>?")
      .get(key, Date.now()) as { hits: number } | undefined;
    if (row && row.hits >= 5)
      throw new AppError(
        "로그인 시도가 많아요. 10분 후 다시 시도해 주세요.",
        429,
        "RATE_LIMITED",
      );
  }
  recordLoginFailure(key: string) {
    const hits = this.limit(key, 5, 10 * 60 * 1000);
    if (hits === 5) {
      this.db
        .prepare("UPDATE rate_limits SET expires=? WHERE key=?")
        .run(Date.now() + 10 * 60 * 1000, key);
      this.checkLoginLimit(key);
    }
  }
  clearLoginFailures(key: string) {
    this.db.prepare("DELETE FROM rate_limits WHERE key=?").run(key);
  }
  createAdminSession() {
    const now = Date.now();
    this.db.prepare("DELETE FROM admin_sessions WHERE expires<=?").run(now);
    const session = {
      id: randomBytes(32).toString("hex"),
      expires: now + ADMIN_SESSION_SECONDS * 1000,
    };
    this.db
      .prepare("INSERT INTO admin_sessions(id,expires) VALUES (?,?)")
      .run(session.id, session.expires);
    return session;
  }
  hasAdminSession(id: string) {
    return Boolean(
      this.db
        .prepare("SELECT 1 FROM admin_sessions WHERE id=? AND expires>?")
        .get(id, Date.now()),
    );
  }
  deleteAdminSession(id: string) {
    this.db.prepare("DELETE FROM admin_sessions WHERE id=?").run(id);
  }
  save(session: Session) {
    this.db
      .prepare("UPDATE sessions SET data=? WHERE id=?")
      .run(JSON.stringify(session), session.id);
  }
  passage(session: Session) {
    const id = session.route.steps[session.currentStep].id;
    this.db
      .prepare(
        "INSERT OR IGNORE INTO passages(session_id,waypoint_id) VALUES (?,?)",
      )
      .run(session.id, id);
    if (!session.visited.includes(id)) session.visited.push(id);
  }
  create(
    owner: string,
    start: string,
    destination: string,
    elevator: boolean,
    option?: string,
  ): Session {
    const route = calculateRoute(start, destination, elevator, allPlaces(), {
      option,
    });
    return this.transaction(() => {
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
      this.db
        .prepare("INSERT INTO sessions(id,owner,data) VALUES (?,?,?)")
        .run(session.id, owner, JSON.stringify(session));
      this.passage(session);
      this.save(session);
      return session;
    });
  }
  get(id: string, owner: string): Session {
    const row = this.db
      .prepare("SELECT data FROM sessions WHERE id=? AND owner=?")
      .get(id, owner) as { data: string } | undefined;
    if (!row)
      throw new AppError("안내 기록을 찾을 수 없어요.", 404, "NOT_FOUND");
    const session: Session = JSON.parse(row.data);
    session.destination = currentPlaceId(session.destination);
    return session;
  }
  active(id: string, owner: string, version?: number) {
    const s = this.get(id, owner);
    if (s.status !== "active")
      throw new AppError("이미 도착한 안내입니다.", 409, "COMPLETED");
    if (version !== undefined && s.version !== version)
      throw new AppError(
        "단계가 변경됐어요. 새로고침해 주세요.",
        409,
        "STALE_VERSION",
      );
    return s;
  }
  advance(id: string, owner: string, version: number) {
    return this.transaction(() => {
      const s = this.active(id, owner, version);
      s.currentStep++;
      s.version++;
      s.recovered = false;
      s.recoveryDirection = "unknown";
      if (s.currentStep === s.route.steps.length - 1) s.status = "completed";
      this.passage(s);
      this.save(s);
      return s;
    });
  }
  previous(id: string, owner: string, version: number) {
  return this.transaction(() => {
    const s = this.get(id, owner);

    if (s.version !== version)
      throw new AppError(
        "단계가 변경되었어요. 새로고침해 주세요.",
        409,
        "STALE_VERSION",
      );

    if (s.currentStep <= 0)
      throw new AppError(
        "첫 번째 단계입니다.",
        409,
        "FIRST_STEP",
      );

    s.currentStep--;
    s.version++;
    s.status = "active";
    s.recovered = false;
    s.recoveryDirection = "unknown";

    this.save(s);
    return s;
  });
}
  confusion(id: string, owner: string) {
    return this.transaction(() => {
      const s = this.active(id, owner);
      this.db
        .prepare(
          "INSERT OR IGNORE INTO confusions(session_id,waypoint_id,reason) VALUES (?,?,?)",
        )
        .run(id, s.route.steps[s.currentStep].id, "위치 재확인");
      return s;
    });
  }
  recover(
    id: string,
    owner: string,
    waypointId: string,
    version: number,
    direction: Session["recoveryDirection"] = "unknown",
  ) {
    return this.transaction(() => {
      if (!["forward", "backward", "unknown"].includes(direction))
        throw new AppError("위치 방향을 확인해 주세요.");
      const s = this.active(id, owner, version);
      // 복구 전에 고른 길과 같은 이름의 후보가 있으면 그 길로 이어 감
      const chosen = s.route.options?.find((o) => o.id === s.route.option);
      const route = calculateRoute(
        waypointId,
        s.destination,
        s.route.elevator,
        allPlaces(),
      );
      const same = route.options.find((o) => o.name === chosen?.name);
      s.route =
        same && same.id !== route.option
          ? calculateRoute(
              waypointId,
              s.destination,
              s.route.elevator,
              allPlaces(),
              { option: same.id },
            )
          : route;
      s.currentStep = 0;
      s.version++;
      s.recovered = true;
      s.recoveryDirection = direction;
      if (s.route.steps.length === 1) s.status = "completed";
      this.passage(s);
      this.save(s);
      return s;
    });
  }
  feedback(id: string, owner: string, input: Feedback) {
    return this.transaction(() => {
      const s = this.get(id, owner);
      if (s.status !== "completed")
        throw new AppError(
          "도착 후 피드백을 보낼 수 있어요.",
          409,
          "NOT_COMPLETED",
        );
      if (s.feedbackSubmitted) return { saved: true, duplicate: true };
      if (
        typeof input.confused !== "boolean" ||
        (input.comment?.length ?? 0) > 500
      )
        throw new AppError("피드백 내용을 확인해 주세요.");
      if (
        input.confused &&
        (!input.waypointId ||
          !s.visited.includes(input.waypointId) ||
          ![
            "방향 혼란",
            "사진 불일치",
            "지도랑 달랐어요",
           "표지판 부족",
            "기타",
          ].includes(input.reason ?? ""))
      )
        throw new AppError("방문한 구간과 혼란 이유를 선택해 주세요.");
      if (input.confused)
        this.db
          .prepare(
            "INSERT OR IGNORE INTO confusions(session_id,waypoint_id,reason) VALUES (?,?,?)",
          )
          .run(id, input.waypointId!, input.reason!);
      this.db
        .prepare("INSERT INTO feedback(session_id,data) VALUES (?,?)")
        .run(id, JSON.stringify(input));
      s.feedbackSubmitted = true;
      this.save(s);
      return { saved: true, duplicate: false };
    });
  }
    recognitionFeedback(input: RecognitionFeedback) {
    if (
      !input.predictedWaypointId ||
      typeof input.confidence !== "number" ||
      !["forward", "backward", "unknown"].includes(input.direction)
    ) {
      throw new AppError("사진 인식 피드백 내용을 확인해 주세요.");
    }

    this.db
      .prepare(
        "INSERT INTO recognition_feedback(data) VALUES (?)",
      )
      .run(JSON.stringify(input));

    return { saved: true };
  }
  insights(filters: { period?: string; building?: string; reason?: string; demo?: string } = {}) {
    const { period = "all", building, reason, demo = "include" } = filters;
    if (!["all", "7d", "today"].includes(period) ||
        !["include", "exclude"].includes(demo) ||
        (building !== undefined && !campusBuildings().some((b) => b.id === building)) ||
        (reason !== undefined && !confusionReasons.some((r) => r === reason)))
      throw new AppError("통계 필터를 확인해 주세요.");
    // 오늘은 한국 시간 자정, 최근 7일은 오늘을 포함한 일곱 날짜로 집계해요.
    const now = new Date();
    const day = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const midnight = Date.parse(`${day}T00:00:00+09:00`);
    const since = period === "all" ? null : new Date(
      midnight - (period === "7d" ? 6 * 24 * 60 * 60 * 1000 : 0),
    ).toISOString();
    const rows = this.db.prepare(`
      SELECT p.session_id, p.waypoint_id AS id, c.reason, f.data AS feedback,
        (s.id GLOB 'demo-*' AND s.owner='demo' AND json_extract(s.data,'$.demo')=1) AS demo
      FROM passages p JOIN sessions s ON s.id=p.session_id
      LEFT JOIN confusions c ON c.session_id=p.session_id AND c.waypoint_id=p.waypoint_id
      LEFT JOIN feedback f ON f.session_id=p.session_id
      WHERE (? IS NULL OR julianday(p.created_at)>=julianday(?))
    `).all(since, since) as {
      session_id: string; id: string; reason: string | null; feedback: string | null; demo: number;
    }[];
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
    // 예시를 뺀 상태에서도 다시 포함할 수 있게, 같은 범위의 예시 세션 수를 알려줘요.
    const demoSessions = new Set(filtered.filter((r) => r.demo).map((r) => r.session_id)).size;
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
      if (row.feedback && (!reason || JSON.parse(row.feedback).reason === reason))
        feedbackSessions.add(row.session_id);
    }
    const points = [...groups].map(([id, group]) => {
      const reasons = [...group.reasons].map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, "ko"));
      return {
        id, passages: group.passages, confusions: group.confusions,
        // 사진 안내 지점이 아니면 그래프 노드 이름으로 보완해요.
        name: waypoints.find((w) => w.id === id)?.name ?? nodeLabel(id),
        rate: Math.round(group.confusions / group.passages * 1000) / 10,
        level: confusionLevel(group.passages, group.confusions),
        reasons, topReason: reasons[0]?.reason ?? null,
      };
    }).sort((a, b) => confusionLevels.indexOf(a.level) - confusionLevels.indexOf(b.level) ||
      b.confusions / b.passages - a.confusions / a.passages || b.confusions - a.confusions);
    const passages = points.reduce((n, p) => n + p.passages, 0);
    const confusions = points.reduce((n, p) => n + p.confusions, 0);
    return {
      passages, confusions,
      rate: passages ? Math.round(confusions / passages * 1000) / 10 : 0,
      feedbacks: feedbackSessions.size, points, demoSessions,
      scope: period === "all" ? "all-time" : period,
      dataMode: "demo-route-activity",
    };
  }
}
