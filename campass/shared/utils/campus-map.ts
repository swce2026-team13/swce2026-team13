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

export function routeSegments(
  nodes: string[],
): [CampusCoordinate, CampusCoordinate][] {
  const points = nodes.map(routeCoordinate);
  const segments = points.slice(1).flatMap((point, i) => {
    const previous = points[i];
    if (!previous || !point) return [];
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
