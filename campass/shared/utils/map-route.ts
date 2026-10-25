import { places } from "./catalog.ts";
import { AppError, calculateRoute, waypoints } from "./routing.ts";

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
  if (!start || !destination || !waypoints.some((p) => p.id === start.id))
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
