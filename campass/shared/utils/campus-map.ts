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

export type CampusMapController = {
  fitAll: () => void;
  zoom: (factor: number) => void;
  selectBuilding: (id: string) => void;
  highlightBuildings: (ids: string[], currentId?: string) => void;
  showRoute: (nodes: string[]) => void;
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

// 언덕길(2115 정류장 → 스콘스퀘어): 본관 북서쪽 모서리를 돌아 본관과 문예관 사이 길로 올라가
// 한림관·대일관·문예관 사이 갈림길을 지나 대일관 남쪽에서 광장으로 들어간다. 정류장 쪽부터의 순서.
// 실외 길의 대략적인 선형이며 높이는 거리 비율로 정류장 → 광장 높이를 잇는다.
export const HILL_ROAD: [number, number][] = [
  [-72, 54], // 본관 북서쪽 모서리 바깥
  [-40, 46], // 본관과 문예관 사이 길
  [-15, 36],
  [5, 27], // 한림관·대일관·문예관 사이 갈림길
  [24, 16], // 한림관과 대일관 사이
  [36, 11], // 광장 북쪽 끝 진입
];

function hillWaypoints(
  from: CampusCoordinate,
  to: CampusCoordinate,
  fromBus: boolean,
): CampusCoordinate[] {
  // 정류장에서 광장 진입점까지 오르막, 광장 안은 평지
  const bus = fromBus ? from : to;
  const plaza = fromBus ? to : from;
  const xy = [[bus.east, bus.north], ...HILL_ROAD];
  const lengths = xy.slice(1).map((p, i) => Math.hypot(p[0] - xy[i][0], p[1] - xy[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let walked = 0;
  const points = HILL_ROAD.map(([east, north], i) => {
    walked += lengths[i];
    const t = total ? walked / total : 1;
    return { east, north, elevation: bus.elevation + (plaza.elevation - bus.elevation) * t };
  });
  return fromBus ? points : points.toReversed();
}

export function routeSegments(
  nodes: string[],
): [CampusCoordinate, CampusCoordinate][] {
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
    if (pair.includes("bus_stop_2115") && pair.includes("스콘스퀘어")) {
      const path = [previous, ...hillWaypoints(previous, point, nodes[i] === "bus_stop_2115"), point];
      return path.slice(1).map((p, j) => [path[j], p] as [CampusCoordinate, CampusCoordinate]);
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
  // 동일 좌표의 정류장↔본관 연결은 생략하되 수직 층 이동은 남긴다.
  return segments.filter(([a, b]) =>
    Math.hypot(a.east - b.east, a.north - b.north, a.elevation - b.elevation) > 0.001,
  );
}
