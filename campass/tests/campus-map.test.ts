import test from "node:test";
import assert from "node:assert/strict";
import {
  HILL_ROAD,
  HILL_STOPS,
  campusMap,
  routeSegments,
  routeCoordinate,
  getFloorElevations,
  MAP_MARKERS,
  markerCoordinate,
  currentPosition,
  campusTerrain,
  terrainHeight,
  terrainDisc,
  undergroundFloors,
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
  // 본관 5층 → 한림관 3층은 본관 입구(2)·입구(3)·연결통로를 거쳐 4개 선분이 된다.
  assert.equal(segments.length, 7);
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

test("본관 → 한림관은 본관 오른쪽 입구와 연결통로를 따라 한림관 중심으로 이어진다", () => {
  const at = (id: string) => campusEntrances().find(e => e.id === id)!.local;
  const segments = routeSegments(["bon|5", "hallim|3"]);
  const via = segments.slice(1).map(([a]) => [a.east, a.north]);
  assert.deepEqual(via, [at("bon_entrance_2"), at("bon_entrance_3"), at("passage_bon_hallim")]);
  assert.deepEqual(segments.at(-1)![1], routeCoordinate("hallim|3"));
  assert.ok(segments.every(([a, b]) => a.elevation === 140 && b.elevation === 140));
  assert.deepEqual(
    routeSegments(["hallim|3", "bon|5"]),
    segments.toReversed().map(([a, b]) => [b, a]),
  );
  const start = routeCoordinate("to_hallim")!;
  assert.deepEqual([start.east, start.north], at("passage_bon_hallim"));
});

test("정류장에서 광장까지 갈 때는 북악관 앞(꺾는 지점)을 지나지 않는다", () => {
  const corners = routeSegments(["bus_stop_2115", "스콘스퀘어"]).map(([a]) => [a.east, a.north]);
  assert.ok(!corners.some(([e, n]) => e === HILL_STOPS[0].xy[0] && n === HILL_STOPS[0].xy[1]));
});

test("언덕길은 한림관·대일관·문예관 사이 길을 따라 광장으로 오르고 높이가 계속 오른다", () => {
  const segments = routeSegments(["bus_stop_2115", "스콘스퀘어", "hyein|1"]);
  assert.equal(segments.length, HILL_ROAD.length + 2);
  assert.deepEqual(segments.slice(1, HILL_ROAD.length + 1).map(([a]) => [a.east, a.north]), HILL_ROAD);
  assert.deepEqual(segments[0][0], routeCoordinate("bus_stop_2115"));
  assert.deepEqual(segments[HILL_ROAD.length][1], routeCoordinate("스콘스퀘어"));
  for (const [a, b] of segments.slice(0, HILL_ROAD.length)) assert.ok(b.elevation > a.elevation);
  // 광장 진입점부터는 광장 높이 그대로
  assert.equal(segments[HILL_ROAD.length][0].elevation, 149);
  assert.equal(segments[HILL_ROAD.length][1].elevation, 149);
  const back = routeSegments(["스콘스퀘어", "bus_stop_2115"]);
  assert.deepEqual(back, segments.slice(0, HILL_ROAD.length + 1).toReversed().map(([a, b]) => [b, a]));
});

test("언덕길로 내려갈 때는 정류장·본관을 거치지 않고 도착 건물 입구 가까운 언덕길 지점에서 꺾는다", () => {
  const at = (id: string) => campusEntrances().find(e => e.id === id)!.local;
  const turnOf = (nodes: string[]) => {
    const segments = routeSegments(nodes);
    const corners = segments.map(([a]) => [a.east, a.north]);
    const last = segments.at(-1)!;
    return { corners, segments, last };
  };
  const bus = routeCoordinate("bus_stop_2115")!;
  const cases: [string[], [number, number], string][] = [
    [["hyein|1", "스콘스퀘어", "bus_stop_2115", "bon|1", "bukak|B1", "bukak|7", "munye|6"], HILL_ROAD[1], "munye_entrance_1"],
    [["hyein|1", "스콘스퀘어", "bus_stop_2115", "bon|1", "bukak|B1", "bukak|3"], HILL_STOPS[0].xy, "bukak_entrance_1"],
    [["hyein|1", "스콘스퀘어", "bus_stop_2115", "bon|1", "bon|5"], HILL_ROAD[1], "bon_entrance_3"],
  ];
  for (const [nodes, corner, door] of cases) {
    const { corners, segments, last } = turnOf(nodes);
    assert.ok(corners.every(([e, n]) => e !== bus.east || n !== bus.north));
    assert.ok(!corners.some(([e, n]) => e === HILL_ROAD[0][0] && n === HILL_ROAD[0][1]));
    const doorIndex = corners.findIndex(([e, n]) => e === at(door)[0] && n === at(door)[1]);
    assert.deepEqual(corners[doorIndex - 1], corner);
    assert.deepEqual([last[1].east, last[1].north], at(door));
    assert.equal(last[1].elevation, routeCoordinate(nodes.at(-1)!)!.elevation);
    assert.ok(segments.length > 0);
  }
  // 정류장이 도착지이면 언덕길 끝까지 내려간다.
  const toBus = routeSegments(["hyein|1", "스콘스퀘어", "bus_stop_2115"]);
  assert.deepEqual(toBus.at(-1)![1], bus);
  // 올라갈 때는 같은 길을 거꾸로 쓴다.
  const down = routeSegments(["스콘스퀘어", "bus_stop_2115", "bon|1", "bukak|B1", "bukak|7", "munye|6"]);
  const up = routeSegments(["munye|6", "bukak|7", "bukak|B1", "bon|1", "bus_stop_2115", "스콘스퀘어"]);
  assert.deepEqual(up, down.toReversed().map(([a, b]) => [b, a]));
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

test("3D 지도에 정류장·정문·1주차장 출발 지점을 실제 입구 좌표에 표시한다", () => {
  assert.deepEqual(MAP_MARKERS.map((m) => m.id), ["bus_stop_2115", "gate_main", "parking_entrance_1"]);
  for (const marker of MAP_MARKERS) {
    const entrance = campusEntrances().find((e) => e.id === marker.id)!;
    const at = markerCoordinate(marker.id)!;
    assert.deepEqual([at.east, at.north], entrance.local);
    assert.ok(Number.isFinite(at.elevation));
  }
  // 2115 정류장은 본관 1층과 같은 높이, 정문은 언덕 아래(등고선 높이)라 정류장보다 낮다.
  assert.equal(markerCoordinate("bus_stop_2115")!.elevation, 127.3);
  assert.ok(markerCoordinate("gate_main")!.elevation < markerCoordinate("bus_stop_2115")!.elevation);
});

test("안내 중 내 위치 점은 지금 지점에, 연결통로 단계는 다음 지점까지 길의 가운데에 둔다", () => {
  const nodes = ["bus_stop_2115", "bon|1", "bon|5", "hallim|3", "hallim|6", "eunju1|5", "스콘스퀘어", "hyein|1"];
  assert.equal(currentPosition(nodes, {}), undefined);
  assert.deepEqual(currentPosition(nodes, { node: "gate_main" }), routeCoordinate("gate_main"));
  assert.deepEqual(currentPosition(nodes, { node: "hallim|3" }), routeCoordinate("hallim|3"));
  // 본관 5층 → 한림관 3층 연결통로: 본관 입구·연결통로를 지나는 길의 가운데, 같은 높이
  const middle = currentPosition(nodes, { node: "bon|5", link: "bon-5__hallim-3" })!;
  assert.equal(middle.elevation, 140);
  // 길 위의 한 점: 어느 한 선분 위에 놓인다
  const onPath = routeSegments(["bon|5", "hallim|3"]).some(([a, b]) => {
    const ab = Math.hypot(a.east - b.east, a.north - b.north);
    const am = Math.hypot(a.east - middle.east, a.north - middle.north);
    const mb = Math.hypot(middle.east - b.east, middle.north - b.north);
    return Math.abs(am + mb - ab) < 1e-6;
  });
  assert.ok(onPath);
  assert.notDeepEqual(middle, routeCoordinate("bon|5"));
  assert.notDeepEqual(middle, routeCoordinate("hallim|3"));
  // 마지막 지점에서 link가 있어도 다음 지점이 없으면 그 지점에 둔다
  assert.deepEqual(currentPosition(nodes, { node: "hyein|1", link: "x" }), routeCoordinate("hyein|1"));
});

test("등고선 지형은 실외 입구 높이와 맞고 건물·출발 지점이 모두 지형 판 안에 든다", () => {
  const terrain = campusTerrain();
  assert.ok(terrain.heights.every(Number.isFinite));
  assert.ok(terrain.min >= 70 && terrain.max <= 170);
  // 정류장·정문·1주차장: 기존 높이(연결 층 또는 가장 가까운 등고선)와 2m 안에서 맞는다
  for (const id of ["bus_stop_2115", "gate_main", "parking_entrance_1"]) {
    const at = routeCoordinate(id)!;
    assert.ok(Math.abs(terrainHeight(at.east, at.north) - at.elevation) < 2, id);
  }
  // 스콘스퀘어 안은 광장 높이로 평평하다
  const [px, py] = campusMap.plaza.center;
  assert.ok(Math.abs(terrainHeight(px, py) - 149) < 0.5);
  const disc = terrainDisc();
  const inside = ([e, n]: number[]) => Math.hypot(e - disc.center[0], n - disc.center[1]) <= disc.radius;
  assert.ok(campusMap.buildings.every((b) => b.poly.every(inside)));
  assert.ok(MAP_MARKERS.every((m) => inside(campusEntrances().find((e) => e.id === m.id)!.local)));
});

test("지하층(B로 시작하는 층)은 점선 표시 대상이고 지상층은 아니다", () => {
  for (const building of campusMap.buildings) {
    const underground = undergroundFloors(building);
    building.floors.forEach((floor, i) => {
      if (floor.floor.startsWith("B")) assert.ok(underground[i], `${building.id} ${floor.floor}`);
    });
    // 맨 위층은 항상 지상
    assert.equal(underground.at(-1), false, building.id);
  }
  const yudam = campusMap.buildings.find((b) => b.id === "yudam")!;
  assert.deepEqual(
    yudam.floors.filter((_, i) => undergroundFloors(yudam)[i]).map((f) => f.floor),
    ["B2", "B1"],
  );
});
