import { places } from "./catalog.ts";
import { AppError, calculateRoute } from "./routing.ts";
import { campusMap } from "./campus-map.ts";
import { nodeArea, PARKING, PLAZA } from "./campus3d/route.ts";
import type { GuideMapData } from "./guide-view.ts";

// 등록 노드가 속한 건물만 강조하고, 없는 건물이나 연결을 만들지 않아요.
export function mapRouteBuildings(map: GuideMapData) {
  const area = (node: string) => {
    const id = nodeArea(node);
    if (id === PARKING || id === PLAZA) return PLAZA;
    return campusMap.buildings.some((building) => building.id === id)
      ? id
      : undefined;
  };
  return {
    ids: [
      ...new Set(map.nodes.map(area).filter((id): id is string => Boolean(id))),
    ],
    currentId: map.current.node ? area(map.current.node) : undefined,
  };
}

export function selectRouteBuilding(
  selected: string[],
  name: string,
): string[] {
  if (selected.at(-1) === name) return selected;
  return selected.length === 1 ? [...selected, name] : [name];
}

export function buildingRoute(selected: string[]) {
  const [from, to] = selected;
  if (!from || !to || from === to)
    throw new AppError("출발지와 도착지로 서로 다른 건물을 선택해 주세요.");
  const start = places.find(
    (p) => p.category === "building" && p.name === from,
  );
  const destination = places.find(
    (p) => p.category === "building" && p.name === to,
  );
  if (!start || !destination)
    throw new AppError(
      "이 건물의 안내 경로는 아직 등록되지 않았어요.",
      422,
      "ROUTE_UNAVAILABLE",
    );
  return {
    start: start.id,
    destination: destination.id,
    route: calculateRoute(start.id, destination.id, true),
  };
}
