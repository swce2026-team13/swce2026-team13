import test from "node:test";
import assert from "node:assert/strict";
import { findPaths, graphEdges } from "../shared/utils/campus3d/route.ts";
import { elevatorSection, elevatorShortcutAreas } from "../shared/utils/elevator-shortcut.ts";

test("엘리베이터 지름길은 확인된 단차 없는 연결로 이어진 6곳 15쌍이에요", () => {
  const { areas, pairs } = elevatorShortcutAreas();
  assert.deepEqual(new Set(areas.map((a) => a.name)),
    new Set(["2115번 정류장", "본관", "한림관", "은주1관", "스콘스퀘어", "혜인관"]));
  assert.equal(pairs.length, 15);
  for (const id of ["bukak", "munye", "yudam", "eunju2", "suin", "sangseung"])
    assert.ok(!areas.some((a) => a.id === id), id);
});

test("정류장은 출발로만 고를 수 있어요", () => {
  const stop = elevatorShortcutAreas().areas.find((a) => a.id === "bus_stop_2115");
  assert.equal(stop?.startOnly, true);
  assert.ok(elevatorShortcutAreas().areas.filter((a) => a.startOnly).every((a) => a.id === "bus_stop_2115"));
  assert.equal(elevatorSection("bon", "bus_stop_2115"), undefined);
  assert.ok(elevatorSection("bus_stop_2115", "hyein"));
});

test("본관 → 혜인관 단면도는 엘리베이터 2 · 연결통로 2 · 계단 0이에요", () => {
  const section = elevatorSection("bon", "hyein")!;
  assert.deepEqual(section.stops.map((s) => [s.name, s.enter.floor, s.exit.floor, s.inside, s.next]), [
    ["본관", "1층", "5층", "elevator", "passage"],
    ["한림관", "3층", "6층", "elevator", "passage"],
    ["은주1관", "5층", "5층", null, "plaza"],
    ["스콘스퀘어", "", "", null, "plaza"],
    ["혜인관", "1층", "1층", null, null],
  ]);
  assert.equal(section.elevators, 2);
  assert.equal(section.passages, 2);
  assert.equal(section.stairs, 0);
  assert.ok(section.rise !== null && section.rise > 0);
  const reverse = elevatorSection("hyein", "bon")!;
  assert.equal(reverse.rise, -section.rise!);
});

test("지름길 경로는 계단·언덕·추정 연결을 쓰지 않아요", () => {
  for (const [start, target] of [["bus_stop_2115", "hyein|1"], ["bon|1", "eunju1|5"]]) {
    const [path] = findPaths({ node: start }, [target], { elevator: true, stepFreeOnly: true });
    assert.ok(path, start);
    for (const { edge } of path.hops) {
      assert.notEqual(edge.kind, "stairs");
      if (edge.kind !== "elevator") {
        assert.equal(edge.status, "확인");
        assert.equal(edge.stepFree, true);
      }
    }
  }
});

test("연결이 '확인'·단차 없음으로 바뀌면 지름길 목록이 저절로 늘어나요", () => {
  const edges = graphEdges.map((edge) =>
    edge.id === "bon-8__bukak-6" ? { ...edge, status: "확인" as const, stepFree: true } : edge);
  const { areas, pairs } = elevatorShortcutAreas(edges);
  assert.ok(areas.some((a) => a.id === "bukak"));
  assert.equal(areas.length, 7);
  assert.equal(pairs.length, 21);
});
