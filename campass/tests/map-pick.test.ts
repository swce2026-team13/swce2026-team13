import test from "node:test";
import assert from "node:assert/strict";
import { emptyPick, pickOnMap, pickStatus } from "../lib/map-pick.ts";

test("처음 누른 건물은 출발, 두 번째로 누른 건물은 도착", () => {
  const first = pickOnMap(emptyPick, "bon", true);
  assert.deepEqual(first, { start: "bon", destination: null });
  const second = pickOnMap(first, "hyein", true);
  assert.deepEqual(second, { start: "bon", destination: "hyein" });
});

test("출발로 고른 건물을 다시 누르면 출발만 취소", () => {
  const picked = pickOnMap(pickOnMap(emptyPick, "bon", true), "hyein", true);
  assert.deepEqual(pickOnMap(picked, "bon", true), {
    start: null,
    destination: "hyein",
  });
  assert.deepEqual(pickOnMap(pickOnMap(emptyPick, "bon", true), "bon", true), emptyPick);
});

test("다시 선택하면 아무것도 고르지 않은 처음 상태", () => {
  const picked = pickOnMap(pickOnMap(emptyPick, "bon", true), "hyein", true);
  assert.notDeepEqual(picked, emptyPick);
  assert.deepEqual(emptyPick, { start: null, destination: null });
  assert.equal(pickStatus(emptyPick).ready, false);
  assert.equal(pickStatus(emptyPick).message, "");
});

test("정류장·정문 같은 지도 표시는 출발로만 고름", () => {
  const picked = pickOnMap(pickOnMap(emptyPick, "bon", true), "gate_main", false);
  assert.deepEqual(picked, { start: "gate_main", destination: null });
});

test("본관 → 혜인관, 2115번 정류장 → 혜인관은 안내 가능", () => {
  const fromMain = pickStatus({ start: "bon", destination: "hyein" });
  assert.deepEqual(fromMain, { ready: true, start: "main", message: "" });
  const fromBusStop = pickStatus({ start: "bus_stop_2115", destination: "hyein" });
  assert.deepEqual(fromBusStop, { ready: true, start: "bus_stop_2115", message: "" });
});

test("한림관 → 혜인관은 출발 지점이 없어 안내 불가", () => {
  const status = pickStatus({ start: "hallim", destination: "hyein" });
  assert.equal(status.ready, false);
  assert.equal(status.message, "아직 이 건물에서 출발하는 안내가 없어요");
});

test("경로가 없는 도착 건물은 막고 안내 문구를 보여 줌", () => {
  const status = pickStatus({ start: "bon", destination: "bukak" });
  assert.equal(status.ready, false);
  assert.equal(status.message, "아직 안내 경로가 없는 건물이에요");
});
