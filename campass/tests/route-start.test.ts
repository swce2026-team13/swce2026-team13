import test from "node:test";
import assert from "node:assert/strict";
import { places } from "../shared/utils/catalog.ts";
import { allPlaces } from "../server/services/rooms.ts";
import { calculateRoute } from "../shared/utils/routing.ts";
import {
  placeLabel,
  startChoices,
  startLabel,
  startMapIds,
  samePlace,
} from "../shared/utils/route-start.ts";

test("장소명에 포함된 건물과 층을 요약에 반복하지 않는다", () => {
  assert.equal(placeLabel(places.find((p) => p.id === "eunju1_5f_front")!), "은주1관 5층 앞");
});

test("출발지 검색은 등록된 건물과 사진 지점만 반환하고 빈 결과를 구분한다", () => {
  assert.ok(startChoices("본관", places).some((p) => p.id === "bon"));
  assert.ok(startChoices("2115", places).some((p) => p.id === "bus_stop_2115"));
  assert.deepEqual(startChoices("없는장소입니다", places), []);
  assert.deepEqual(startChoices("   ", places), []);
});

test("호실 출발지의 건물과 층을 표시하고 같은 건물을 지도에서 강조한다", () => {
  assert.match(startLabel("hyein-301", places), /혜인관 3층 301호/);
  assert.deepEqual(startMapIds("hyein-301", places), ["hyein"]);
  assert.deepEqual(startMapIds("gate", places), ["gate_main"]);
  assert.deepEqual(startMapIds("parking", places), ["parking_entrance_1"]);
  assert.deepEqual(startMapIds("hallim_6f_elevator", places), ["hallim"]);
  assert.deepEqual(startMapIds("", places), []);
});

test("등록된 강의실에서 출발하면 해당 층에서 경로를 계산한다", () => {
  const route = calculateRoute("hyein-301", "bon", false, allPlaces());
  assert.equal(route.options[0].nodes[0], "hyein|3");
  const roomRoute = calculateRoute("room-yudam-541", "bon", false, allPlaces());
  assert.equal(roomRoute.options[0].nodes[0], "yudam|5");
});

test("등록된 장소라도 연결할 수 없으면 다른 층으로 대체하지 않는다", () => {
  const unavailable = places.find((p) => p.id === "hyein-301")!;
  const list = [
    ...places.filter((p) => p.id !== unavailable.id),
    { ...unavailable, floor: "등록되지 않은 층" },
  ];
  assert.throws(() => calculateRoute(unavailable.id, "bon", false, list), {
    code: "ROUTE_UNAVAILABLE",
  });
  assert.throws(() => calculateRoute("bon", unavailable.id, false, list), {
    code: "ROUTE_UNAVAILABLE",
  });
});

test("출발과 도착의 같은 장소 및 기존 건물 식별자를 구분한다", () => {
  assert.equal(samePlace("hyein-301", "hyein-301"), true);
  assert.equal(samePlace("main", "bon"), true);
  assert.equal(samePlace("hyein-301", "hyein-302"), false);
  assert.equal(samePlace("", "bon"), false);
});
