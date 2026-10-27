import test from "node:test";
import assert from "node:assert/strict";
import {
  selectRouteBuilding,
  buildingRoute,
  mapRouteBuildings,
} from "../lib/map-route.ts";
import { calculateRoute } from "../lib/routing.ts";
import { toGuideMapData } from "../lib/guide-view.ts";

test("건물을 누르면 출발과 도착을 고르고 연속 중복 선택은 무시해요", () => {
  const first = selectRouteBuilding([], "본관");
  assert.deepEqual(first, ["본관"]);
  assert.deepEqual(selectRouteBuilding(first, "본관"), first);
  const pair = selectRouteBuilding(first, "혜인관");
  assert.deepEqual(pair, ["본관", "혜인관"]);
  assert.deepEqual(selectRouteBuilding(pair, "유담관"), ["유담관"]);
});

test("건물 안내는 현재 등록 그래프를 사용하고 미등록 연결은 거부해요", () => {
  const route = buildingRoute(["본관", "혜인관"]);
  assert.equal(route.start, "bon");
  assert.equal(route.destination, "hyein");
  assert.ok(route.route.steps.length > 0);
  assert.equal(buildingRoute(["혜인관", "본관"]).destination, "bon");
  assert.equal(buildingRoute(["본관", "유담관"]).destination, "yudam");
  assert.throws(() => buildingRoute(["상승관", "혜인관"]), /등록/);
  assert.throws(() => buildingRoute(["본관", "본관"]), /다른/);
});

test("3D 강조는 고른 경로와 현재 단계의 등록 건물만 사용해요", () => {
  const route = calculateRoute("bus_stop_2115", "interview", true);
  const option = route.options[0];
  const map = toGuideMapData(
    option,
    option.steps.find((step) => step.node === "hallim|6"),
  );
  const highlight = mapRouteBuildings(map);
  assert.ok(highlight.ids.includes("bon"));
  assert.ok(highlight.ids.includes("hyein"));
  assert.equal(highlight.currentId, "hallim");
  assert.deepEqual(
    mapRouteBuildings({
      ...map,
      nodes: ["없는관|1", "지하주차장"],
      current: {},
    }),
    { ids: ["스콘스퀘어"], currentId: undefined },
  );
});
