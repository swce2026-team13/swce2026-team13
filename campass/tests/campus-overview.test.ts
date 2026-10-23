import test from "node:test";
import assert from "node:assert/strict";
import {
  GROUND_COLORS,
  LEGEND,
  MAP_HEIGHT,
  MAP_WIDTH,
  overviewBuildings,
  overviewLinks,
  overviewMarkers,
  project,
} from "../lib/campus-overview.ts";
import { campusLinks } from "../lib/campus3d/types.ts";

test("개요도 건물 13곳이 모두 윤곽과 색이 있음", () => {
  assert.equal(overviewBuildings.length, 13);
  for (const b of overviewBuildings) {
    assert.ok(b.points.split(" ").length >= 3, b.id);
    assert.ok(b.colors.length > 0, b.id);
  }
});

test("건물 색 중 범례에 없는 색이 없음", () => {
  const known = new Set([...LEGEND.map((l) => l.color), ...GROUND_COLORS]);
  for (const b of overviewBuildings)
    for (const color of b.colors) assert.ok(known.has(color), `${b.name} ${color}`);
  assert.equal(LEGEND.length, 9);
});

test("건물과 지도 표시가 모두 지도 안에 들어오고 북쪽이 위", () => {
  for (const b of overviewBuildings)
    for (const point of b.points.split(" ")) {
      const [x, y] = point.split(",").map(Number);
      assert.ok(x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= MAP_HEIGHT, b.id);
    }
  for (const m of overviewMarkers) {
    const [x, y] = m.position;
    assert.ok(x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= MAP_HEIGHT, m.id);
  }
  assert.ok(project([0, 10])[1] < project([0, 0])[1]);
});

test("가까운 두 정류장은 이름표만 겹치지 않게 옮김", () => {
  const stop1164 = overviewMarkers.find((m) => m.id === "bus_stop_1164")!;
  const stop2115 = overviewMarkers.find((m) => m.id === "bus_stop_2115")!;
  assert.equal(stop1164.labelAt, "left");
  assert.equal(stop2115.labelAt, "below");
  assert.equal(overviewMarkers.find((m) => m.id === "gate_main")!.labelAt, "right");
});

test("삭제된 연결은 그리지 않음", () => {
  const drawn = new Set(overviewLinks.map((l) => l.id));
  assert.ok(overviewLinks.every((l) => l.status !== "삭제"));
  assert.ok(!drawn.has("hallim-3__eunju1-3"));
  assert.ok(campusLinks().some((l) => drawn.has(l.id)));
});
