import test from "node:test";
import assert from "node:assert/strict";
import {
  campusMap,
  routeSegments,
  routeCoordinate,
  getFloorElevations,
  toScenePosition,
} from "../shared/utils/campus-map.ts";
import { campusBuildings, campusEntrances } from "../shared/utils/campus3d/types.ts";
import { loadCampusThree } from "../features/navigation/campus-map/three-loader.js";

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

test("route segments retain floor heights and break at unknown nodes", () => {
  const segments = routeSegments(["bus_stop_2115", "bon|1", "bon|5", "hallim|3", "hallim|6", "eunju1|5"]);
  assert.equal(segments.length, 4);
  assert.equal(segments[0][0].east, segments[0][1].east);
  assert.ok(segments[0][1].elevation > segments[0][0].elevation);
  assert.equal(segments[1][0].elevation, segments[1][1].elevation);
  assert.equal(routeSegments(["bon|1", "missing", "hallim|3"]).length, 0);
  assert.equal(routeSegments([]).length, 0);
  assert.equal(routeSegments(["to_hallim", "hallim|3"]).length, 1);
});

test("유담관 진입·퇴장은 입구 3을 경유하고 실내 층 이동은 유지한다", () => {
  const entrance = campusEntrances().find(e => e.id === "yudam_entrance_3")!;
  const outside = routeCoordinate("bon|1")!;
  const inside = routeCoordinate("yudam|8")!;
  const door = { east: entrance.local[0], north: entrance.local[1], elevation: inside.elevation };
  assert.deepEqual(routeSegments(["bon|1", "yudam|8"]), [[outside, door], [door, inside]]);
  assert.deepEqual(routeSegments(["yudam|8", "bon|1"]), [[inside, door], [door, outside]]);
  assert.deepEqual(routeSegments(["yudam|8", "yudam|6"]), [[inside, routeCoordinate("yudam|6")]]);
  assert.deepEqual(routeSegments(["missing", "yudam|8"]), []);
});

test("유담관 입구 3 좌표를 수정하면 연결선도 그 좌표를 사용한다", () => {
  const entrance = campusEntrances().find(e => e.id === "yudam_entrance_3")!;
  const saved = [...entrance.local] as [number, number];
  try {
    entrance.local = [-111, -4];
    const segments = routeSegments(["bon|1", "yudam|8", "yudam|6"]);
    assert.equal(segments[0][1].east, -111);
    assert.equal(segments[0][1].north, -4);
    assert.deepEqual(segments[0][1], segments[1][0]);
    assert.deepEqual(segments[1][1], segments[2][0]);
  } finally {
    entrance.local = saved;
  }
});

test("본관은 정류장 쪽 공통 표시점으로 연결하고 겹친 선분은 생략한다", () => {
  const bus=routeCoordinate("bus_stop_2115")!;
  const main=routeCoordinate("bon|1")!;
  const upper=routeCoordinate("bon|5")!;
  assert.deepEqual(main,bus);
  assert.equal(upper.east,main.east);
  assert.equal(upper.north,main.north);
  assert.ok(upper.elevation>main.elevation);
  const route=routeSegments(["bus_stop_2115","bon|1","yudam|8"]);
  const door=campusEntrances().find(e=>e.id==="yudam_entrance_3")!;
  assert.equal(route.length,2);
  assert.deepEqual(route[0][0],bus);
  assert.equal(route[0][1].east,door.local[0]);
  assert.equal(route[0][1].north,door.local[1]);
  assert.deepEqual(routeSegments(["yudam|8","bon|1","bus_stop_2115"]),route.toReversed().map(([a,b])=>[b,a]));
  assert.equal(routeSegments(["bon|1","bon|1","bon|5"]).length,1);
});
