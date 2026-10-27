import test from "node:test";
import assert from "node:assert/strict";
import {
  campusMap,
  getFloorElevations,
  toScenePosition,
} from "../lib/campus-map.ts";
import { campusBuildings } from "../lib/campus3d/types.ts";
import { loadCampusThree } from "../components/campus-map/three-loader.js";

test("첨부 지도의 건물과 등고선은 유효한 좌표와 층 높이를 가진다", () => {
  assert.equal(campusMap.buildings.length, 12);
  assert.equal(new Set(campusMap.buildings.map((b) => b.id)).size, 12);
  assert.equal(campusMap.contours.length, 101);
  for (const building of campusMap.buildings) {
    const registered = campusBuildings().find(
      (item) => item.id === building.id,
    );
    assert.equal(registered?.name, building.name);
    assert.deepEqual(
      building.floors.map((floor) => floor.floor),
      registered?.floors.map((floor) => floor.floor),
    );
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

test("WebGL 미지원은 CDN 요청 없이 실패하고 로딩 실패는 다시 시도할 수 있어요", async (t) => {
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => {
    for (const [name, descriptor] of [
      ["document", savedDocument],
      ["window", savedWindow],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
  let supported = false;
  let requests = 0;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) =>
        tag === "canvas"
          ? {
              getContext: () =>
                supported ? { getExtension: () => null } : null,
            }
          : { remove() {} },
      head: {
        appendChild: (script: { onerror: () => void }) => {
          requests++;
          queueMicrotask(() => script.onerror());
        },
      },
    },
  });
  await assert.rejects(loadCampusThree(), /사용할 수 없어요/);
  assert.equal(requests, 0);
  supported = true;
  await assert.rejects(loadCampusThree(), /불러오지 못했어요/);
  await assert.rejects(loadCampusThree(), /불러오지 못했어요/);
  assert.equal(requests, 2);
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
