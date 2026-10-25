import test from "node:test";
import assert from "node:assert/strict";
import {
  campusMap,
  getFloorElevations,
  toScenePosition,
} from "../shared/utils/campus-map.ts";

test("첨부 지도의 건물과 등고선은 유효한 좌표와 층 높이를 가진다", () => {
  assert.equal(campusMap.buildings.length, 12);
  assert.equal(new Set(campusMap.buildings.map((b) => b.id)).size, 12);
  assert.equal(campusMap.contours.length, 101);
  for (const building of campusMap.buildings) {
    const elevations = getFloorElevations(building);
    assert.equal(elevations.length, building.floors.length);
    assert.ok(building.poly.length >= 3);
    assert.ok(building.poly.every((p) => p.every(Number.isFinite)));
    for (let i = 0; i < elevations.length; i++) {
      assert.ok(Number.isFinite(elevations[i]));
      if (i > 0) assert.ok(elevations[i] > elevations[i - 1]);
      const anchor = building.anchors[building.floors[i].floor];
      if (anchor !== undefined) assert.equal(elevations[i], anchor);
    }
  }
  assert.ok(
    campusMap.contours.every(
      (c) => Number.isFinite(c.e) && c.p.every((p) => p.every(Number.isFinite)),
    ),
  );
});

test("생략된 층 번호를 포함해 원본의 층 간 보간과 지하층 높이를 유지한다", () => {
  const main = campusMap.buildings.find((b) => b.id === "bon")!;
  assert.deepEqual(
    getFloorElevations(main),
    [127.3, 131.3, 135.65, 140, 143, 146, 149],
  );
  const daeil = campusMap.buildings.find((b) => b.id === "daeil")!;
  assert.deepEqual(getFloorElevations(daeil).slice(0, 4), [141, 145, 149, 153]);
});

test("지도 좌표의 동·북·해발 방향을 동일한 3D 축으로 변환한다", () => {
  assert.deepEqual(
    toScenePosition({ east: 20, north: 10, elevation: 85 }),
    [20, 0, -10],
  );
  const a = toScenePosition({ east: -40, north: -12, elevation: 140 });
  const b = toScenePosition({ east: -40, north: -12, elevation: 149 });
  assert.equal(a[0], -40);
  assert.equal(a[2], 12);
  assert.ok(Math.abs(b[1] - a[1] - 9 * 1.3) < 1e-10);
});
