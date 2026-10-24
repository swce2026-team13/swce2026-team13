import test from "node:test";
import assert from "node:assert/strict";
import { calculateRoute } from "../lib/routing.ts";
import {
  legRows,
  optionSummary,
  pickOption,
  stepFreeText,
} from "../lib/route-cards.ts";
import { Store } from "../lib/store.ts";

const interview = (elevator: boolean) =>
  calculateRoute("bus_stop_2115", "interview", elevator);

test("2115 정류장 → 면접 대기실: 엘리베이터를 켜면 카드 1개, 끄면 2개", () => {
  const on = interview(true).options;
  assert.equal(on.length, 1);
  assert.equal(on[0].name, "엘리베이터 길");
  assert.deepEqual(legRows(on[0]), [
    "본관 1층 → 5층",
    "한림관 3층 → 6층",
    "은주1관 5층 · 스콘스퀘어",
    "혜인관 3층",
  ]);
  const off = interview(false).options;
  assert.equal(off.length, 2);
  assert.deepEqual(
    off.map((o) => o.name),
    ["지하통로 길", "연결통로 길"],
  );
  assert.deepEqual(legRows(off[0]), [
    "본관 1층",
    "지하통로 → 지하주차장",
    "혜인관 3층",
  ]);
});

test("계단 여부 문구와 접힌 카드 한 줄", () => {
  const [underground, connector] = interview(false).options;
  assert.equal(stepFreeText(underground), "계단 · 언덕이 있어요");
  assert.equal(
    stepFreeText(interview(true).options[0]),
    "계단 여부를 아직 확인하지 못했어요",
  );
  assert.match(
    stepFreeText(calculateRoute("gate", "interview", true).options[0]),
    /실외 길은 대략적인 안내예요$/,
  );
  assert.equal(
    optionSummary(connector),
    `${connector.legs.length}단계 · 연결 ${connector.connections}곳 · 층 이동 ${connector.floorMoves}번 · 층 이동은 계단`,
  );
});

test("접힌 카드를 누르면 고른 길이 바뀌고 그 id로 세션이 만들어짐", () => {
  const options = interview(false).options;
  assert.equal(pickOption(options).id, options[0].id);
  const chosen = pickOption(options, options[1].id);
  assert.equal(chosen.name, "연결통로 길");
  const store = new Store(":memory:");
  const session = store.create("owner", "bus_stop_2115", "interview", false, chosen.id);
  assert.equal(session.route.option, chosen.id);
  assert.deepEqual(session.route.steps, chosen.steps);
  store.close();
});

test("엘리베이터를 바꿔도 같은 id의 길은 계속 고른 상태, 없으면 첫 후보", () => {
  const on = calculateRoute("bus_stop_2115", "bon", true).options;
  const off = calculateRoute("bus_stop_2115", "bon", false).options;
  assert.equal(pickOption(off, on[0].id).id, on[0].id);
  const underground = interview(false).options[0];
  assert.equal(
    pickOption(interview(true).options, underground.id).id,
    interview(true).options[0].id,
  );
});

test("복구해도 복구 전에 고른 길과 같은 이름의 길로 이어짐", () => {
  const store = new Store(":memory:");
  const connector = interview(false).options[1];
  const session = store.create("owner", "bus_stop_2115", "interview", false, connector.id);
  const recovered = store.recover(session.id, "owner", "main_corridor", session.version);
  const chosen = recovered.route.options.find((o) => o.id === recovered.route.option)!;
  assert.equal(chosen.name, "연결통로 길");
  assert.notEqual(recovered.route.options[0].name, "연결통로 길");
  assert.deepEqual(recovered.route.steps, chosen.steps);
  assert.equal(recovered.route.steps[0].id, "main_corridor");
  store.close();
});
