import { Store, type Session, type Feedback } from "../lib/store.ts";
import { calculateRoute, type Route } from "../lib/routing.ts";
import { allPlaces } from "../lib/rooms.ts";
import { nodeLabel } from "../lib/campus3d/route.ts";

const store = new Store(process.env.DATABASE_PATH || "./data/campass.sqlite");
const demoWhere = "id GLOB 'demo-*' AND owner='demo' AND json_extract(data,'$.demo')=1";

function clearDemo() {
  for (const table of ["feedback", "confusions", "passages"])
    store.db.exec(`DELETE FROM ${table} WHERE session_id IN (SELECT id FROM sessions WHERE ${demoWhere})`);
  store.db.exec(`DELETE FROM sessions WHERE ${demoWhere}`);
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
    store.transaction(clearDemo);
    const row = store.db.prepare(`SELECT COUNT(*) AS count FROM sessions WHERE ${demoWhere}`).get();
    console.log(`예시 기록을 지웠어요. 남은 예시 세션 ${row?.count}개예요.`);
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
    store.transaction(() => {
      clearDemo();
      sessions.forEach(({ destination, route }, index) => {
        const id = `demo-${String(index + 1).padStart(3, "0")}`;
        const date = new Date(now - (index % 14) * 24 * 60 * 60 * 1000).toISOString();
        const visited = [...new Set(route.steps.map((s) => s.id))];
        const session: Session = {
          id, demo: true, destination, route, currentStep: route.steps.length - 1,
          version: route.steps.length - 1, status: "completed", recovered: false,
          recoveryDirection: "unknown", visited, feedbackSubmitted: feedbackIndices.has(index),
        };
        store.db.prepare("INSERT INTO sessions(id,owner,data,created_at) VALUES (?,'demo',?,?)")
          .run(id, JSON.stringify(session), date);
        for (const waypoint of visited) {
          store.db.prepare("INSERT INTO passages(session_id,waypoint_id,created_at) VALUES (?,?,?)")
            .run(id, waypoint, date);
          passageCount++;
        }
        for (const signal of signals.get(index) ?? []) {
          store.db.prepare("INSERT INTO confusions(session_id,waypoint_id,reason,created_at) VALUES (?,?,?,?)")
            .run(id, signal.waypointId, signal.reason, date);
          confusionCount++;
        }
        if (feedbackIndices.has(index)) {
          const signal = signals.get(index)?.[0];
          const feedback: Feedback = signal
            ? { confused: true, ...signal, comment: "갈림길에서 헷갈렸어요" }
            : { confused: false, comment: "" };
          store.db.prepare("INSERT INTO feedback(session_id,data,created_at) VALUES (?,?,?)")
            .run(id, JSON.stringify(feedback), date);
        }
      });
    });
    console.log(`예시 세션 ${sessions.length}개 · 통과 ${passageCount}건 · 혼란 ${confusionCount}건 · 피드백 ${feedbackIndices.size}건을 넣었어요.`);
    for (const point of store.insights().points)
      console.log(`${point.name}: ${point.level} · 혼란 ${point.confusions}건 / 통과 ${point.passages}건 · ${point.rate}%`);
  }
} finally {
  store.close();
}
