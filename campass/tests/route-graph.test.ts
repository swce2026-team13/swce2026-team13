import test from "node:test";
import assert from "node:assert/strict";
import { calculateRoute } from "../shared/utils/routing.ts";
import { graphEdges, PARKING } from "../shared/utils/campus3d/route.ts";
import { allPlaces } from "../server/services/rooms.ts";
import { Store } from "../server/db/store.ts";

test("엘리베이터를 켜면 2115 정류장에서 면접 대기실까지 엘리베이터 길 하나", () => {
  const route = calculateRoute("bus_stop_2115", "interview", true);
  assert.equal(route.options.length, 1);
  assert.equal(route.options[0].name, "엘리베이터 길");
  assert.deepEqual(route.options[0].nodes, [
    "bus_stop_2115",
    "bon|1",
    "bon|5",
    "hallim|3",
    "hallim|6",
    "eunju1|5",
    "스콘스퀘어",
    "hyein|1",
    "hyein|2",
  ]);
  assert.deepEqual(route.options[0].links.slice(1, 3), [
    "bon|1>bon|5",
    "bon-5__hallim-3",
  ]);
  assert.notEqual(route.options[0].stepFree, false);
});

test("엘리베이터를 끄면 지하통로 길이 먼저, 연결통로 길이 다음", () => {
  const route = calculateRoute("bus_stop_2115", "interview", false);
  assert.equal(route.options.length, 2);
  assert.equal(route.options[0].name, "지하통로 길");
  assert.ok(route.options[0].nodes.includes(PARKING));
  assert.deepEqual(route.options[0].nodes, [
    "bus_stop_2115",
    "bon|1",
    "지하주차장",
    "hyein|B1",
    "hyein|1",
    "hyein|2"
  ]);
  assert.equal(route.options[1].name, "연결통로 길");
  assert.ok(!route.options[1].nodes.includes(PARKING));
  assert.deepEqual(route.options[0].legs.at(-1), {
    building: "혜인관",
    from: "지하 1층",
    to: "2층",
  });
});

test("본관에서 한림관은 경로가 있고 크리에이티브센터에서 혜인관은 경로 없음(422)", () => {
  const route = calculateRoute("bon", "hallim", false);
  assert.equal(route.options[0].nodes[0], "bon|1");
  assert.ok(route.options[0].nodes.at(-1)!.startsWith("hallim|"));
  assert.throws(
    () => calculateRoute("creative", "hyein", false),
    (error: { status: number; code: string }) =>
      error.status === 422 && error.code === "ROUTE_UNAVAILABLE",
  );
  // 확인된 연결로 안 이어지면 '확인 필요' · '추정' 연결까지 씀
  const bukak = calculateRoute("bukak", "hyein", false);
  assert.ok(bukak.options.every((o) => o.unverified));
  assert.equal(
    calculateRoute("bus_stop_2115", "interview", true).options[0].unverified,
    undefined,
  );
  // 유담관은 10/24에 확인된 본관 1층 ↔ 유담관 8층으로 이어짐
  assert.equal(
    calculateRoute("bus_stop_2115", "room-yudam-541", true, allPlaces()).options[0]
      .unverified,
    undefined,
  );
});

test("연결통로 사진 지점에서 면접 대기실까지 2115 정류장으로 되돌아가지 않음", () => {
  const route = calculateRoute("hallim_6f_corridor", "interview", true);
  for (const option of route.options) {
    assert.ok(!option.nodes.includes("bus_stop_2115"));
    assert.equal(option.steps[0].id, "hallim_6f_corridor");
    assert.equal(option.steps.at(-1)!.id, "interview");
  }
});

test("지금 응답 필드는 첫 후보와 같고, 같은 조건이면 후보 id도 같음", () => {
  const route = calculateRoute("bus_stop_2115", "interview", false);
  const first = route.options[0];
  assert.deepEqual(route.steps, first.steps);
  assert.equal(route.connections, first.connections);
  assert.equal(route.floorMoves, first.floorMoves);
  assert.equal(route.option, first.id);
  assert.equal(route.verified, false);
  assert.equal(route.elevator, false);
  assert.equal(calculateRoute("bus_stop_2115", "interview", false).options[0].id, first.id);
  const second = calculateRoute("bus_stop_2115", "interview", false, undefined, {
    option: route.options[1].id,
  });
  assert.deepEqual(second.steps, route.options[1].steps);
  assert.throws(
    () => calculateRoute("bus_stop_2115", "interview", false, undefined, { option: "x" }),
    (error: { status: number }) => error.status === 400,
  );
});

test("층 이동 연결은 계단 16, 엘리베이터 50 + 층 수 차이 × 3", () => {
  const stairs = graphEdges.find((e) => e.kind === "stairs" && e.id === "bon|1>bon|2")!;
  const elevator = graphEdges.find((e) => e.kind === "elevator" && e.id === "bon|1>bon|5")!;
  assert.equal(stairs.cost, 16);
  assert.equal(stairs.stepFree, false);
  assert.equal(elevator.cost, 59);
  assert.equal(elevator.stepFree, true);
  assert.ok(!graphEdges.some((e) => e.kind === "elevator" && e.a.startsWith("chungwoon|")));
});

test("정문 출발은 대략적인 길로 표시하고, 엘리베이터로만 못 가면 따로 안내", () => {
  const route = calculateRoute("gate", "interview", false);
  assert.ok(route.options.every((o) => o.approximate));
  assert.ok(!calculateRoute("bus_stop_2115", "interview", false).options[0].approximate);
  // 지하주차장은 '확인 필요' 연결로 엘리베이터 길이 이어짐
  assert.ok(calculateRoute("parking", "interview", true).options[0].unverified);
  // 청운관은 엘리베이터가 없어 L층(교내 서점)은 계단으로만 감
  const bookstore = allPlaces().find((p) => p.name === "교내 서점(문구점)")!.id;
  assert.throws(
    () => calculateRoute("bus_stop_2115", bookstore, true, allPlaces()),
    (error: { status: number; code: string; message: string }) =>
      error.status === 422 &&
      error.code === "ELEVATOR_ROUTE_UNAVAILABLE" &&
      /엘리베이터를 끄면/.test(error.message),
  );
  assert.ok(calculateRoute("bus_stop_2115", bookstore, false, allPlaces()).options.length);
});

test("세션은 고른 후보로 만들고 복구도 같은 그래프로 다시 계산", () => {
  const store = new Store(":memory:");
  const route = calculateRoute("bus_stop_2115", "interview", false);
  const session = store.create(
    "owner",
    "bus_stop_2115",
    "interview",
    false,
    route.options[1].id,
  );
  assert.equal(session.route.option, route.options[1].id);
  assert.deepEqual(session.route.steps, route.options[1].steps);
  const recovered = store.recover(session.id, "owner", "hallim_6f_corridor", session.version);
  assert.equal(recovered.route.steps[0].id, "hallim_6f_corridor");
  assert.ok(!recovered.route.options[0].nodes.includes("bus_stop_2115"));
  store.close();
});
