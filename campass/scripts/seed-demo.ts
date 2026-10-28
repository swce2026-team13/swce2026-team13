import { Store, type Session, type Feedback } from "../server/db/store.ts";
import { calculateRoute, type Route } from "../shared/utils/routing.ts";
import { allPlaces } from "../server/services/rooms.ts";
import { nodeLabel } from "../shared/utils/campus3d/route.ts";
import type { PoolClient } from "pg";

const url = process.env.DEMO_DATABASE_URL;
if (!url || process.env.NODE_ENV === "production" || process.env.VERCEL)
  throw new Error("Demo seeding requires a local DEMO_DATABASE_URL outside production");
const parsed = new URL(url);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) ||
    parsed.pathname !== "/campass_demo" || url === process.env.DATABASE_URL)
  throw new Error("DEMO_DATABASE_URL must target a separate local campass_demo database");
const store = new Store(url);
const demoWhere = "id LIKE 'demo-%' AND owner='demo' AND data->>'demo'='true'";

async function clearDemo(client: PoolClient) {
  // Child records are removed by foreign-key cascades; ordinary sessions are untouched.
  await store.query(`DELETE FROM sessions WHERE ${demoWhere}`, [], client);
}

let seed = 57;
function shuffled<T>(values: T[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

try {
  if (process.argv.includes("--clear")) {
    await store.transaction(clearDemo);
    const [row] = await store.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sessions WHERE ${demoWhere}`);
    console.log(`예시 기록을 지웠어요. 남은 예시 세션 ${row.count}개예요.`);
  } else {
    const places = allPlaces();
    const plans = [
      { start: "bus_stop_2115", destination: "interview", count: 18 },
      { start: "bus_stop_2115", destination: "contest-final", count: 12 },
      { start: "gate_main", destination: "hyein-301", count: 6 },
      { start: "parking_entrance_1", destination: "facility-hallim-1", count: 4 },
    ];
    const sessions: { start: string; destination: string; route: Route }[] = [];
    for (const plan of plans) {
      let start = plan.start;
      let route: Route;
      try {
        route = calculateRoute(start, plan.destination, true, places);
      } catch (error) {
        if (start !== "parking_entrance_1") throw error;
        start = "gate_main";
        route = calculateRoute(start, plan.destination, true, places);
        console.log("1주차장 출발 경로가 등록되지 않아 식당행은 정문에서 출발해요.");
      }
      for (let i = 0; i < plan.count; i++) sessions.push({ start, destination: plan.destination, route });
      console.log(`${nodeLabel(start)} → ${places.find((p) => p.id === plan.destination)!.name}: ${plan.count}회`);
    }
    const steps = sessions.flatMap((s) => s.route.steps);
    const eunju = steps.find((step) => step.node === "eunju1|5" && step.instruction.includes("스콘스퀘어"));
    const passage = steps.find((step) => step.link === "bon-5__hallim-3");
    const yudam = steps.find((step) => step.node === "yudam|8" && step.instruction.includes("L층"));
    if (!eunju || !passage || !yudam) throw new Error("예시 혼란을 넣을 경로 단계를 확인해 주세요.");
    const signals = new Map<number, { waypointId: string; reason: string }[]>();
    for (const [step, count, reason] of [
      [eunju, 10, "방향 혼란"], [passage, 6, "표지판 부족"], [yudam, 3, "지도랑 달랐어요"],
    ] as const) {
      const candidates = sessions.map((s, index) => ({ s, index }))
        .filter(({ s }) => s.route.steps.some((w) => w.id === step.id));
      for (const { index } of shuffled(candidates).slice(0, count)) {
        signals.set(index, [...(signals.get(index) ?? []), { waypointId: step.id, reason }]);
      }
      console.log(`혼란 단계: ${step.id} · ${step.name} · ${reason} ${count}건`);
    }
    const feedbackIndices = new Set(shuffled(sessions.map((_, i) => i)).slice(0, Math.round(sessions.length * 0.6)));
    const now = Date.now();
    let passageCount = 0;
    let confusionCount = 0;
    await store.transaction(async (client) => {
      await clearDemo(client);
      for (const [index, { destination, route }] of sessions.entries()) {
        const id = `demo-${String(index + 1).padStart(3, "0")}`;
        const date = new Date(now - (index % 14) * 24 * 60 * 60 * 1000).toISOString();
        const visited = [...new Set(route.steps.map((s) => s.id))];
        const session: Session = {
          id, demo: true, destination, route, currentStep: route.steps.length - 1,
          version: route.steps.length - 1, status: "completed", recovered: false,
          recoveryDirection: "unknown", visited, feedbackSubmitted: feedbackIndices.has(index),
        };
        await store.query("INSERT INTO sessions(id,owner,data,created_at) VALUES ($1,'demo',$2::jsonb,$3)",
          [id, JSON.stringify(session), date], client);
        for (const waypoint of visited) {
          await store.query("INSERT INTO passages(session_id,waypoint_id,created_at) VALUES ($1,$2,$3)",
            [id, waypoint, date], client);
          passageCount++;
        }
        for (const signal of signals.get(index) ?? []) {
          await store.query("INSERT INTO confusions(session_id,waypoint_id,reason,created_at) VALUES ($1,$2,$3,$4)",
            [id, signal.waypointId, signal.reason, date], client);
          confusionCount++;
        }
        if (feedbackIndices.has(index)) {
          const signal = signals.get(index)?.[0];
          const feedback: Feedback = signal
            ? { confused: true, ...signal, comment: "갈림길에서 헷갈렸어요" }
            : { confused: false, comment: "" };
          await store.query("INSERT INTO feedback(session_id,data,created_at) VALUES ($1,$2::jsonb,$3)",
            [id, JSON.stringify(feedback), date], client);
        }
      }
    });
    console.log(`예시 세션 ${sessions.length}개 · 통과 ${passageCount}건 · 혼란 ${confusionCount}건 · 피드백 ${feedbackIndices.size}건을 넣었어요.`);
    for (const point of (await store.insights()).points)
      console.log(`${point.name}: ${point.level} · 혼란 ${point.confusions}건 / 통과 ${point.passages}건 · ${point.rate}%`);
  }
} finally {
  await store.close();
}
