import data from "../campus-data/campus-map-data.json" with { type: "json" };

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
  dispose: () => void;
};
