import test from "node:test";
import assert from "node:assert/strict";
import { emptyPick, pickOnMap, pickStatus } from "../shared/utils/map-pick.ts";

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
  assert.deepEqual(fromMain, {
    ready: true,
    start: "bon",
    elevator: true,
    message: "",
  });
  const fromBusStop = pickStatus({ start: "bus_stop_2115", destination: "hyein" });
  assert.deepEqual(fromBusStop, {
    ready: true,
    start: "bus_stop_2115",
    elevator: true,
    message: "",
  });
  assert.equal(pickStatus({ start: "gate_main", destination: "hyein" }).start, "gate");
});

test("건물끼리: 본관 → 한림관, 스콘스퀘어 → 혜인관은 안내 가능", () => {
  assert.equal(pickStatus({ start: "bon", destination: "hallim" }).ready, true);
  assert.deepEqual(pickStatus({ start: "스콘스퀘어", destination: "hyein" }), {
    ready: true,
    start: "스콘스퀘어",
    elevator: true,
    message: "",
  });
  assert.equal(pickStatus({ start: "hallim", destination: "스콘스퀘어" }).ready, true);
});

test("크리에이티브센터 → 혜인관은 경로가 없어 막고 안내 문구를 보여 줌", () => {
  const status = pickStatus({ start: "creative", destination: "hyein" });
  assert.equal(status.ready, false);
  assert.equal(status.message, "아직 안내 경로가 없는 곳이에요");
});

test("1주차장 출발은 확인 전 연결까지 써서 엘리베이터 길로 안내", () => {
  const status = pickStatus({ start: "parking_entrance_1", destination: "hyein" });
  assert.deepEqual(status, {
    ready: true,
    start: "parking",
    elevator: true,
    message: "",
  });
});
