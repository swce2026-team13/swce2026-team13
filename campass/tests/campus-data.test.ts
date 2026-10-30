import test from "node:test";
import assert from "node:assert/strict";
import {
  buildingPosition,
  campusBuildings,
  campusEntrances,
  campusLinks,
  floorCode,
  loadPlaces,
  loadRooms,
  nodeKey,
} from "../shared/utils/campus3d/types.ts";
import { places } from "../shared/utils/catalog.ts";
import { calculateRoute } from "../shared/utils/routing.ts";
import { testStore } from "./postgres-helper.ts";

test("캠퍼스 데이터는 건물 13, 연결 22(삭제 제외), 입구 35", () => {
  assert.equal(campusBuildings().length, 13);
  assert.equal(campusLinks().length, 22);
  assert.ok(campusLinks().every((l) => l.status !== "삭제"));
  assert.equal(campusEntrances().length, 35);
});

test("입구 id 35개가 모두 있고 겹치지 않음", () => {
  const ids = campusEntrances().map((e) => e.id);
  assert.ok(ids.every(Boolean));
  assert.equal(new Set(ids).size, 35);
  const byName = new Map(campusEntrances().map((e) => [e.name, e]));
  assert.equal(byName.get("본관 입구(2)")?.id, "bon_entrance_2");
  assert.equal(byName.get("한림관 입구")?.id, "hallim_entrance_1");
  assert.equal(byName.get("상승관 입구")?.stepFree, false);
  assert.equal(byName.get("은주1관 입구(2)")?.floor, "5");
});

test("연결 양 끝 층이 건물 층 목록에 있음", () => {
  const floors = new Set(
    campusBuildings().flatMap((b) => b.floors.map((f) => nodeKey(b.id, f.floor))),
  );
  for (const link of campusLinks())
    for (const end of [link.from, link.to]) {
      if (["스콘스퀘어", "지하주차장"].includes(end.building)) continue;
      assert.ok(floors.has(nodeKey(end.building, end.floor)), link.id);
    }
});

test("층 노드 키와 좌표 없는 건물의 위치", () => {
  assert.equal(nodeKey("bon", "5"), "bon|5");
  const creative = campusBuildings().find((b) => b.id === "creative")!;
  assert.equal(creative.official, null);
  assert.deepEqual(buildingPosition(creative), [-80.24, -92.43]);
});

test("앱의 건물 장소 13곳이 모두 캠퍼스 데이터 건물에 있음", () => {
  const ids = new Set(campusBuildings().map((b) => b.id));
  const appBuildings = places.filter((p) => p.category === "building");
  assert.equal(appBuildings.length, 13);
  for (const p of appBuildings) assert.ok(ids.has(p.id), p.id);
});

test("본관 경로는 바꾸기 전과 같고 예전 id로도 같은 경로", () => {
  for (const elevator of [true, false]) {
    const route = calculateRoute("bus_stop_2115", "bon", elevator);
    assert.deepEqual(
      route.steps.map((s) => s.id),
      ["bus_stop_2115", "main"],
    );
    assert.equal(route.distance, 36);
    assert.deepEqual(calculateRoute("bus_stop_2115", "main", elevator), route);
  }
  assert.deepEqual(
    calculateRoute("bus_stop_2115", "hyein", false).steps.map((s) => s.id),
    ["bus_stop_2115", "스콘스퀘어", "hyein|1"],
  );
});

test("예전 건물 id로 만든 세션과 저장된 세션을 새 id로 받음", async (t) => {
  const fixture = await testStore(t);
  if (!fixture) return;
  const { store } = fixture;
  const created = await store.create("owner", "bus_stop_2115", "main", true);
  assert.equal(created.destination, "bon");
  await store.query("UPDATE sessions SET data=$1::jsonb WHERE id=$2",
    [JSON.stringify({ ...created, destination: "hanlim" }), created.id]);
  assert.equal((await store.get(created.id, "owner")).destination, "hallim");
});

test("청운관 L층과 2층 장소는 모두 층 코드 2", () => {
  const chungwoon = loadPlaces().filter(
    (p) =>
      p.buildingId === "chungwoon" && ["L층", "2층"].includes(p.floorLabel),
  );
  assert.ok(chungwoon.some((p) => p.floorLabel === "L층"));
  assert.ok(chungwoon.some((p) => p.floorLabel === "2층"));
  assert.ok(chungwoon.every((p) => p.floor === "2"));
  assert.equal(floorCode("munye", "L층"), "3");
  assert.equal(floorCode("yudam", "L층"), "6");
  assert.equal(floorCode("hyein", "지하 1층"), "B1");
  assert.equal(floorCode("hyein", ""), "");
});

test("호실명에 교수가 들어가면 모두 교수연구실", () => {
  const rooms = loadRooms();
  assert.equal(rooms.length, 1255);
  const professors = rooms.filter((r) => r.name.includes("교수"));
  assert.ok(professors.length > 0);
  assert.ok(professors.every((r) => r.name === "교수연구실"));
});
