import { campusEntrances } from "./campus3d/types.ts";
import data from "../../campus-data/campus-map-data.json" with { type: "json" };

export type MapBuilding = {
  id: string;
  name: string;
  center: number[];
  poly: number[][];
  approx: boolean;
  anchors: Partial<Record<string, number>>;
  floors: { floor: string; label: string; passOnly?: boolean }[];
};

// 팀의 3D 지도 윤곽과 등고선만 사용하고 연결 경로는 기존 그래프에 맡겨요.
export const campusMap: {
  buildings: MapBuilding[];
  plaza: { center: number[]; polygon: number[][] };
  contours: { e: number; m: boolean | number; p: number[][] }[];
} = data;

export type CampusCoordinate = {
  east: number;
  north: number;
  elevation: number;
};

export const MAP_BASE_ELEVATION = 85;
export const MAP_HEIGHT_SCALE = 1.3;
export const PLAZA_ELEVATION = 149;
const FLOOR_HEIGHT = 4;

/** 로컬 미터 좌표를 장면 축으로 옮겨요. 위도·경도는 받지 않아요. */
export function toScenePosition(
  position: CampusCoordinate,
): [number, number, number] {
  return [
    position.east,
    (position.elevation - MAP_BASE_ELEVATION) * MAP_HEIGHT_SCALE,
    -position.north,
  ];
}

/** 4·13층이 생략된 건물도 원본 층 순서로 높이를 보간해요. */
export function getFloorElevations(building: MapBuilding): number[] {
  const anchors = building.floors
    .map((floor, index) => ({
      index,
      elevation: building.anchors[floor.floor],
    }))
    .filter(
      (anchor): anchor is { index: number; elevation: number } =>
        anchor.elevation !== undefined,
    );
  if (!anchors.length)
    throw new Error(`기준층 높이가 없습니다: ${building.id}`);

  return building.floors.map((floor, index) => {
    const known = building.anchors[floor.floor];
    if (known !== undefined) return known;
    const lower = anchors.filter((anchor) => anchor.index < index).at(-1);
    const upper = anchors.find((anchor) => anchor.index > index);
    if (lower && upper) {
      return (
        lower.elevation +
        ((upper.elevation - lower.elevation) * (index - lower.index)) /
          (upper.index - lower.index)
      );
    }
    const nearest = lower ?? upper!;
    return nearest.elevation + (index - nearest.index) * FLOOR_HEIGHT;
  });
}

export type MapSelection = { buildingId: string };

export type MapMarkerKind = "bus" | "parking" | "gate";

export type MapMarker = {
  /** entrances.json 의 입구 id (2D 지도 표시 id와 같음) */
  id: string;
  label: string;
  kind: MapMarkerKind;
  /** 길찾기 그래프에서 이 표시를 가리키는 노드 id */
  routeId: string;
};

// 지도에서 출발로 고를 수 있는 실외 지점. 2D 지도의 출발 버튼(정류장·정문·주차장)과 같다.
export const MAP_MARKERS: MapMarker[] = [
  { id: "bus_stop_2115", label: "2115번 정류장", kind: "bus", routeId: "bus_stop_2115" },
  { id: "gate_main", label: "정문", kind: "gate", routeId: "gate" },
  { id: "parking_entrance_1", label: "1주차장", kind: "parking", routeId: "parking" },
];

/** 3D 지도에 표시할 지점의 좌표. 높이는 연결 층 또는 가장 가까운 등고선으로 정한다. */
export function markerCoordinate(id: string): CampusCoordinate | undefined {
  return routeCoordinate(id);
}

export type CampusMapController = {
  fitAll: () => void;
  zoom: (factor: number) => void;
  selectBuilding: (id: string) => void;
  highlightBuildings: (ids: string[], currentId?: string) => void;
  showRoute: (nodes: string[], annotation?: { name: string; color: string; guide?: import("./guide-route-motion").GuideRouteMotion }) => void;
  /** 안내 중 내 위치 점. undefined면 숨긴다. */
  showPosition: (position?: CampusCoordinate) => void;
  dispose: () => void;
};

export function routeCoordinate(node: string): CampusCoordinate | undefined {
  const [id, floor] = node.split("|");
  const building = campusMap.buildings.find((b) => b.id === id);
  if (building) {
    const index = building.floors.findIndex((f) => f.floor === floor);
    if (index < 0) return;
    // 본관의 정류장 연결과 실내 경로는 한 수평 표시점을 공유한다.
    // 그래프의 출발 지점·층 구분은 유지하고 지도상의 중심 왕복만 없앤다.
    const anchor = id === "bon"
      ? campusEntrances().find(e => e.id === "bus_stop_2115")?.local ?? building.center
      : building.center;
    return {
      east: anchor[0],
      north: anchor[1],
      elevation: getFloorElevations(building)[index],
    };
  }
  if (node === "스콘스퀘어" || node === "지하주차장")
    return {
      east: campusMap.plaza.center[0],
      north: campusMap.plaza.center[1],
      elevation: PLAZA_ELEVATION - (node === "지하주차장" ? 6 : 0),
    };
  // 본관-한림관 연결통로 위 출발점은 실제 통로 좌표에 둔다.
  if (node === "to_hallim") {
    const local = campusEntrances().find(e => e.id === "passage_bon_hallim")?.local;
    const hallim = routeCoordinate("hallim|3");
    if (local && hallim) return { east: local[0], north: local[1], elevation: hallim.elevation };
  }
  const passage: Record<string, [string, string]> = {
    to_hallim: ["bon|5", "hallim|3"],
    hallim_6f_corridor: ["hallim|6", "eunju1|5"],
  };
  if (passage[node]) {
    const [a, b] = passage[node].map((n) => routeCoordinate(n)!);
    return {
      east: (a.east + b.east) / 2,
      north: (a.north + b.north) / 2,
      elevation: (a.elevation + b.elevation) / 2,
    };
  }
  const entrance = campusEntrances().find((e) => e.id === node);
  if (!entrance) return;
  const connected =
    entrance.connectsTo &&
    routeCoordinate(
      entrance.connectsTo.building + "|" + entrance.connectsTo.floor,
    );
  // 정문 등 실외 입구 높이는 가장 가까운 등고선 표본으로 추정한다.
  let elevation = connected?.elevation ?? MAP_BASE_ELEVATION;
  if (node !== "bus_stop_2115") {
    let nearest = Infinity;
    for (const contour of campusMap.contours)
      for (const p of contour.p) {
        const distance = Math.hypot(
          p[0] - entrance.local[0],
          p[1] - entrance.local[1],
        );
        if (distance < nearest) {
          nearest = distance;
          elevation = contour.e;
        }
      }
  }
  return { east: entrance.local[0], north: entrance.local[1], elevation };
}

// 본관 → 한림관은 건물 가운데를 가로지르지 않고 본관 오른쪽(북동쪽) 입구를 따라 내려가
// 연결통로를 지나 한림관으로 들어간다. 본관 쪽부터의 순서.
const BON_TO_HALLIM = ["bon_entrance_2", "bon_entrance_3", "passage_bon_hallim"];

function bonHallimWaypoints(
  from: CampusCoordinate,
  to: CampusCoordinate,
  fromBon: boolean,
): CampusCoordinate[] {
  const ids = fromBon ? BON_TO_HALLIM : BON_TO_HALLIM.toReversed();
  const bon = fromBon ? from : to;
  const hallim = fromBon ? to : from;
  return ids.flatMap((id) => {
    const local = campusEntrances().find(e => e.id === id)?.local;
    if (!local) return [];
    // 본관 안의 점은 본관 층 높이, 연결통로는 한림관 층 높이를 쓴다.
    const elevation = id === "passage_bon_hallim" ? hallim.elevation : bon.elevation;
    return [{ east: local[0], north: local[1], elevation }];
  });
}

// 언덕길(2115 정류장 ↔ 스콘스퀘어)의 가운데 선. 정류장 쪽부터의 순서.
// 본관 북서쪽 모서리를 돌아 본관과 문예관 사이 길을 지나 한림관·대일관·문예관 사이
// 갈림길을 거쳐 대일관 남쪽에서 광장으로 들어간다. 실외 길의 대략적인 선형이며
// 높이는 거리 비율로 정류장 → 광장 진입점 높이를 잇고, 광장 안은 평지로 둔다.
export const HILL_ROAD: [number, number][] = [
  [-68.2, 66.1], // 본관 북서쪽 모서리 (정류장까지 끝까지 갈 때만 지남)
  [-14, 37], // 문예관 앞
  [5, 27], // 한림관·대일관·문예관 사이 갈림길
  [24, 16], // 한림관과 대일관 사이
  [36, 11], // 광장 북쪽 끝 진입
];

// 언덕길 가운데에서 건물로 꺾기만 하는 지점. 정류장까지 가는 길에는 지나지 않는다.
// from: 광장 쪽에서 내려오다 이 지점으로 갈라지는 HILL_ROAD 꼭짓점
export const HILL_STOPS: { name: string; xy: [number, number]; from: number }[] = [
  { name: "북악관 앞", xy: [-67.8, 74.7], from: 1 },
];

const BUS = "bus_stop_2115";
const PLAZA_NODE = "스콘스퀘어";

type HillPoint = { point: CampusCoordinate; path: CampusCoordinate[] };

// 꺾을 수 있는 언덕길 지점과, 정류장 쪽 순서로 그 지점부터 광장 진입점까지의 길
function hillPoints(bus: CampusCoordinate, plaza: CampusCoordinate): HillPoint[] {
  const xy = [[bus.east, bus.north], ...HILL_ROAD];
  const lengths = xy.slice(1).map((p, i) => Math.hypot(p[0] - xy[i][0], p[1] - xy[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let walked = 0;
  const road = HILL_ROAD.map(([east, north], i) => {
    walked += lengths[i];
    const t = total ? walked / total : 1;
    return { east, north, elevation: bus.elevation + (plaza.elevation - bus.elevation) * t };
  });
  const main = road.map((point, i) => ({ point, path: road.slice(i) }));
  const stops = HILL_STOPS.map(({ xy: [east, north], from }) => {
    // 높이는 갈라지는 구간(정류장 쪽 이전 꼭짓점 → from)에 투영해 보간
    const b = road[from];
    const a = from > 0 ? road[from - 1] : bus;
    const dx = b.east - a.east, dy = b.north - a.north;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.min(1, Math.max(0, ((east - a.east) * dx + (north - a.north) * dy) / len2)) : 1;
    const point = { east, north, elevation: a.elevation + (b.elevation - a.elevation) * t };
    return { point, path: [point, ...road.slice(from)] };
  });
  return [...main, ...stops];
}

const pairOf = (path: CampusCoordinate[]) =>
  path.slice(1).map((p, j) => [path[j], p] as [CampusCoordinate, CampusCoordinate]);

const pathLength = (path: CampusCoordinate[]) =>
  path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.east - path[i].east, p.north - path[i].north), 0);

// 언덕길 위에서 건물로 꺾는 곳: 건물 입구마다 가장 가까운 언덕길 지점을 찾고,
// 광장 진입점에서 그 지점까지 걸은 거리 + 입구까지 거리가 가장 짧은 입구를 쓴다.
function hillTurn(buildingId: string, points: HillPoint[]) {
  let best: { at: HillPoint; door: [number, number]; cost: number } | undefined;
  for (const entrance of campusEntrances()) {
    if (entrance.building !== buildingId) continue;
    const gap = points.map(({ point }) =>
      Math.hypot(point.east - entrance.local[0], point.north - entrance.local[1]),
    );
    const index = gap.indexOf(Math.min(...gap));
    const cost = pathLength(points[index].path) + gap[index];
    if (!best || cost < best.cost) best = { at: points[index], door: entrance.local, cost };
  }
  return best;
}

// 광장 → 언덕길 → 도착 건물 입구 → 도착 지점. 정류장·본관을 거치지 않는다.
function hillToBuilding(target: string): CampusCoordinate[] | undefined {
  const bus = routeCoordinate(BUS);
  const plaza = routeCoordinate(PLAZA_NODE);
  const goal = routeCoordinate(target);
  if (!bus || !plaza || !goal) return;
  const turn = hillTurn(target.split("|")[0], hillPoints(bus, plaza));
  if (!turn) return;
  const door = { east: turn.door[0], north: turn.door[1], elevation: turn.at.point.elevation };
  return [plaza, ...turn.at.path.toReversed(), door, { ...door, elevation: goal.elevation }];
}

// 언덕길에서 바로 들어가는 건물. 입구는 언덕길과 같은 높이에 있으므로
// 꺾는 지점의 언덕 높이와 가장 가까운 층으로 들어간다.
export const HILL_ENTRY_BUILDINGS = ["munye", "bukak"];

/** 광장에서 언덕길을 따라 건물 입구로 들어갈 때의 층과 걷는 거리 */
export function hillEntry(buildingId: string): { floor: string; length: number } | undefined {
  const building = campusMap.buildings.find((b) => b.id === buildingId);
  const bus = routeCoordinate(BUS);
  const plaza = routeCoordinate(PLAZA_NODE);
  if (!building || !bus || !plaza) return;
  const turn = hillTurn(buildingId, hillPoints(bus, plaza));
  if (!turn) return;
  const corner = turn.at.point;
  const elevations = getFloorElevations(building);
  const gaps = elevations.map((e) => Math.abs(e - corner.elevation));
  const floor = building.floors[gaps.indexOf(Math.min(...gaps))].floor;
  const length = pathLength([plaza, ...turn.at.path.toReversed()]) +
    Math.hypot(turn.door[0] - corner.east, turn.door[1] - corner.north);
  return { floor, length: Math.round(length * 10) / 10 };
}

export function routeSegments(
  nodes: string[],
): [CampusCoordinate, CampusCoordinate][] {
  // 언덕길로 내려가 정류장 뒤 건물(본관 → 북악관 등)로 이어지는 경로는 정류장까지 내려가지 않고
  // 언덕길 가운데를 따라 내려오다 도착 건물 입구와 가까운 곳(문예관 앞, 북악관 앞 등)에서 꺾는다.
  // 올라갈 때(출발 건물 → 정류장 → 광장)도 같은 길을 거꾸로 쓴다.
  const down = nodes.findIndex((n, i) => n === PLAZA_NODE && nodes[i + 1] === BUS);
  if (down >= 0 && down + 2 < nodes.length) {
    const tail = hillToBuilding(nodes.at(-1)!);
    if (tail) return dropEmpty([...routeSegments(nodes.slice(0, down + 1)), ...pairOf(tail)]);
  }
  const up = nodes.findIndex((n, i) => n === BUS && nodes[i + 1] === PLAZA_NODE);
  if (up > 0) {
    const head = hillToBuilding(nodes[0]);
    if (head)
      return dropEmpty([
        ...pairOf(head.toReversed()),
        ...routeSegments(nodes.slice(up + 1)),
      ]);
  }
  const points = nodes.map(routeCoordinate);
  const segments = points.slice(1).flatMap((point, i) => {
    const previous = points[i];
    if (!previous || !point) return [];
    const fromBon = nodes[i].startsWith("bon|");
    const toBon = nodes[i + 1].startsWith("bon|");
    const fromHallim = nodes[i].startsWith("hallim|");
    const toHallim = nodes[i + 1].startsWith("hallim|");
    if ((fromBon && toHallim) || (fromHallim && toBon)) {
      const path = [previous, ...bonHallimWaypoints(previous, point, fromBon), point];
      return path.slice(1).map((p, j) => [path[j], p] as [CampusCoordinate, CampusCoordinate]);
    }
    const pair = [nodes[i], nodes[i + 1]];
    // 광장 ↔ 문예관·북악관: 언덕길 가운데를 따라가다 입구 앞에서 같은 높이로 꺾는다.
    const entered = pair.find((n) => HILL_ENTRY_BUILDINGS.includes(n.split("|")[0]));
    if (pair.includes(PLAZA_NODE) && entered) {
      const path = hillToBuilding(entered);
      if (path) return pairOf(nodes[i] === PLAZA_NODE ? path : path.toReversed());
    }
    if (pair.includes(BUS) && pair.includes(PLAZA_NODE)) {
      const fromBus = nodes[i] === BUS;
      const road = hillPoints(fromBus ? previous : point, fromBus ? point : previous)[0].path;
      return pairOf([previous, ...(fromBus ? road : road.toReversed()), point]);
    }
    const fromYudam = nodes[i].startsWith("yudam|");
    const toYudam = nodes[i + 1].startsWith("yudam|");
    // 유담관 출입 연결은 입구 3을 경유한다. 실내 층 이동은 기존 위치를 유지한다.
    if (fromYudam !== toYudam) {
      const entrance = campusEntrances().find(e => e.id === "yudam_entrance_3");
      if (entrance) {
        const door: CampusCoordinate = {
          east: entrance.local[0],
          north: entrance.local[1],
          // 입구 층은 기존 연결의 유담관 층을 사용하고 등고선 높이로 바꾸지 않는다.
          elevation: (fromYudam ? previous : point).elevation,
        };
        return [[previous, door], [door, point]] as [CampusCoordinate, CampusCoordinate][];
      }
    }
    return [[previous, point] as [CampusCoordinate, CampusCoordinate]];
  });
  return dropEmpty(segments);
}

// 동일 좌표의 정류장↔본관 연결은 생략하되 수직 층 이동은 남긴다.
function dropEmpty(segments: [CampusCoordinate, CampusCoordinate][]) {
  return segments.filter(([a, b]) =>
    Math.hypot(a.east - b.east, a.north - b.north, a.elevation - b.elevation) > 0.001,
  );
}

/**
 * 안내 중 지금 단계의 위치(내 위치 점). 연결통로처럼 다음 지점으로 이동 중인 단계는
 * 지금 지점과 다음 지점 사이 길의 가운데, 그 밖에는 지금 지점에 둔다.
 */
export function currentPosition(
  nodes: string[],
  current: { node?: string; link?: string },
): CampusCoordinate | undefined {
  const node = current.node;
  if (!node) return;
  const next = nodes[nodes.indexOf(node) + 1];
  if (current.link && next && nodes.includes(node)) {
    const path = routeSegments([node, next]);
    const total = path.reduce((sum, [a, b]) => sum + span(a, b), 0);
    let left = total / 2;
    for (const [a, b] of path) {
      const length = span(a, b);
      if (length && left <= length) {
        const t = left / length;
        return {
          east: a.east + (b.east - a.east) * t,
          north: a.north + (b.north - a.north) * t,
          elevation: a.elevation + (b.elevation - a.elevation) * t,
        };
      }
      left -= length;
    }
  }
  return routeCoordinate(node);
}

const span = (a: CampusCoordinate, b: CampusCoordinate) =>
  Math.hypot(a.east - b.east, a.north - b.north, a.elevation - b.elevation);

// ── 지형 ─────────────────────────────────────────────────────────────
// 등고선(5m 간격)으로 격자 높이를 만든다. 격자점마다 가장 가까운 등고선과
// 높이가 다른 그다음 등고선까지의 거리 비율로 두 높이를 잇고, 두 번 다듬는다.
// 스콘스퀘어 안은 광장 높이로 평평하게 둔다.

export type CampusTerrain = {
  /** 서쪽·남쪽 끝 (로컬 미터) */
  origin: [number, number];
  step: number;
  columns: number;
  rows: number;
  /** rows × columns, 행은 남→북, 열은 서→동 */
  heights: Float32Array;
  min: number;
  max: number;
};

const TERRAIN_STEP = 4;
const TERRAIN_SEARCH = 60;
let terrainCache: CampusTerrain | undefined;

function insidePolygon([x, y]: number[], polygon: number[][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function campusTerrain(): CampusTerrain {
  if (terrainCache) return terrainCache;
  // 등고선을 2m 간격 표본으로 촘촘하게 만들고 10m 칸에 나눠 담는다.
  const samples: { x: number; y: number; e: number }[] = [];
  for (const contour of campusMap.contours)
    contour.p.forEach((p, i) => {
      const q = contour.p[i + 1];
      if (!q) return samples.push({ x: p[0], y: p[1], e: contour.e });
      const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2));
      for (let k = 0; k < n; k++)
        samples.push({
          x: p[0] + ((q[0] - p[0]) * k) / n,
          y: p[1] + ((q[1] - p[1]) * k) / n,
          e: contour.e,
        });
    });
  const xs = samples.map((s) => s.x);
  const ys = samples.map((s) => s.y);
  const minX = Math.floor(Math.min(...xs));
  const minY = Math.floor(Math.min(...ys));
  const columns = Math.ceil((Math.max(...xs) - minX) / TERRAIN_STEP) + 1;
  const rows = Math.ceil((Math.max(...ys) - minY) / TERRAIN_STEP) + 1;
  // 등고선 높이를 번호로 바꿔 두고(5m 간격 약 20단계), 격자점마다 높이별 최소 거리만 기록한다.
  const levelValues = [...new Set(samples.map((s) => s.e))].sort((p, q) => p - q);
  const levelOf = new Map(levelValues.map((e, i) => [e, i]));
  const CELL = 10;
  const cellColumns = Math.ceil(columns * TERRAIN_STEP / CELL) + 1;
  const cellRows = Math.ceil(rows * TERRAIN_STEP / CELL) + 1;
  const cells: number[][] = Array.from({ length: cellColumns * cellRows }, () => []);
  samples.forEach((s, index) => {
    const cx = Math.floor((s.x - minX) / CELL);
    const cy = Math.floor((s.y - minY) / CELL);
    cells[cy * cellColumns + cx].push(index);
  });
  const sx = Float64Array.from(samples, (s) => s.x);
  const sy = Float64Array.from(samples, (s) => s.y);
  const sl = Int32Array.from(samples, (s) => levelOf.get(s.e)!);
  const reach = Math.ceil(TERRAIN_SEARCH / CELL);
  const best = new Float64Array(levelValues.length);
  let heights = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const x = minX + c * TERRAIN_STEP;
      const y = minY + r * TERRAIN_STEP;
      const cx = Math.floor((x - minX) / CELL);
      const cy = Math.floor((y - minY) / CELL);
      best.fill(Infinity);
      for (let j = Math.max(0, cy - reach); j <= Math.min(cellRows - 1, cy + reach); j++)
        for (let i = Math.max(0, cx - reach); i <= Math.min(cellColumns - 1, cx + reach); i++)
          for (const k of cells[j * cellColumns + i]) {
            const dx = sx[k] - x;
            const dy = sy[k] - y;
            const d = dx * dx + dy * dy;
            if (d < best[sl[k]]) best[sl[k]] = d;
          }
      // 가장 가까운 높이 두 개
      let l1 = -1;
      let l2 = -1;
      for (let l = 0; l < best.length; l++) {
        if (best[l] === Infinity) continue;
        if (l1 < 0 || best[l] < best[l1]) {
          l2 = l1;
          l1 = l;
        } else if (l2 < 0 || best[l] < best[l2]) l2 = l;
      }
      let h = NaN;
      if (l1 >= 0 && l2 < 0) h = levelValues[l1];
      else if (l1 >= 0) {
        const d1 = Math.sqrt(best[l1]);
        const d2 = Math.sqrt(best[l2]);
        h = levelValues[l1] + ((levelValues[l2] - levelValues[l1]) * d1) / (d1 + d2 || 1);
      }
      heights[r * columns + c] = h;
    }
  // 표본이 닿지 않은 칸은 가장 낮은 등고선 높이로 채운다.
  const fallback = Math.min(...campusMap.contours.map((c) => c.e));
  for (let i = 0; i < heights.length; i++) if (Number.isNaN(heights[i])) heights[i] = fallback;
  const plaza = campusMap.plaza.polygon;
  const flat = (r: number, c: number) =>
    insidePolygon([minX + c * TERRAIN_STEP, minY + r * TERRAIN_STEP], plaza);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(heights.length);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        let sum = 0;
        let count = 0;
        for (let i = -1; i <= 1; i++)
          for (let j = -1; j <= 1; j++) {
            const rr = r + i;
            const cc = c + j;
            if (rr < 0 || cc < 0 || rr >= rows || cc >= columns) continue;
            sum += heights[rr * columns + cc];
            count++;
          }
        next[r * columns + c] = sum / count;
      }
    heights = next;
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++)
      if (flat(r, c)) heights[r * columns + c] = PLAZA_ELEVATION - 0.3;
  let min = Infinity;
  let max = -Infinity;
  for (const h of heights) {
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  terrainCache = { origin: [minX, minY], step: TERRAIN_STEP, columns, rows, heights, min, max };
  return terrainCache;
}

/** 지형 판(원)의 중심과 반지름. 격자 안에 들어가는 가장 큰 원 */
export function terrainDisc(): { center: [number, number]; radius: number } {
  const t = campusTerrain();
  const width = (t.columns - 1) * t.step;
  const height = (t.rows - 1) * t.step;
  return {
    center: [t.origin[0] + width / 2, t.origin[1] + height / 2],
    radius: Math.min(width, height) / 2 - t.step,
  };
}

/** 지형 격자에서 (동, 북) 지점의 땅 높이(양선형 보간). 격자 밖은 가장자리 값 */
export function terrainHeight(east: number, north: number): number {
  const t = campusTerrain();
  const fx = Math.min(Math.max((east - t.origin[0]) / t.step, 0), t.columns - 1);
  const fy = Math.min(Math.max((north - t.origin[1]) / t.step, 0), t.rows - 1);
  const c = Math.min(Math.floor(fx), t.columns - 2);
  const r = Math.min(Math.floor(fy), t.rows - 2);
  const u = fx - c;
  const v = fy - r;
  const at = (rr: number, cc: number) => t.heights[rr * t.columns + cc];
  return (
    at(r, c) * (1 - u) * (1 - v) +
    at(r, c + 1) * u * (1 - v) +
    at(r + 1, c) * (1 - u) * v +
    at(r + 1, c + 1) * u * v
  );
}

/** 건물 둘레에서 가장 낮은 땅 높이. 이보다 위가 다 묻힌 층은 지하로 본다. */
export function buildingGround(building: MapBuilding): number {
  const points = building.poly.flatMap((p, i) => {
    const q = building.poly[(i + 1) % building.poly.length];
    return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]];
  });
  return Math.min(...points.map(([e, n]) => terrainHeight(e, n)));
}

/** 지하층인지: 층 이름이 B로 시작하거나(지하 1·2층), 천장까지 땅에 완전히 묻힌 층 */
export function undergroundFloors(building: MapBuilding): boolean[] {
  const ground = buildingGround(building);
  const elevations = getFloorElevations(building);
  return elevations.map((elevation, i) => {
    if (/^B\d/.test(building.floors[i].floor)) return true;
    const top = elevations[i + 1] ?? elevation + FLOOR_HEIGHT;
    return top <= ground + 0.5;
  });
}
