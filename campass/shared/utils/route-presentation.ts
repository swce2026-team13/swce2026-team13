import type { RouteOption } from "./routing.ts";
import { PLAZA, buildingById, nodeArea, nodeLabel, type HillMode } from "./campus3d/route.ts";
import { campusEntrances } from "./campus3d/types.ts";
import { MAP_MARKERS } from "./campus-map.ts";

// 언덕 구간을 지나지 않는 기존 일반 경로도 세 가지 선택 방식에 표시한다.
export function routeMode(option: RouteOption): HillMode {
  return (
    option.hillMode ??
    (option.lifts.includes("elevator") || option.name === "엘리베이터 길"
      ? "elevator"
      : option.approximate
        ? "hill"
        : "stairs")
  );
}
// 앱 전체에서 쓰는 길 이름. 경로 데이터의 이름(option.name)과 상관없이 길 종류로 정함
export const routeNames = {
  hill: "바깥으로 걷는 길",
  stairs: "지름길",
  elevator: "엘리베이터 이용하는 길",
};
export const routeColors = {
  hill: "#3f8a48",
  stairs: "#c76b12",
  elevator: "#10223f",
};
export const routeName = (option: RouteOption) => routeNames[routeMode(option)];

// 조건과 호환되는 현재 후보는 보존하고, 조건 전환 때만 맞는 후보로 바꾼다.
export function displayedRouteOption(
  options: RouteOption[],
  selected: RouteOption,
  elevator: boolean,
  preferred?: "hill" | "stairs" | null,
) {
  const mode = routeMode(selected);
  if (elevator)
    return mode === "elevator"
      ? selected
      : options.find((o) => routeMode(o) === "elevator");
  if (preferred)
    return (
      options.find((o) => routeMode(o) === preferred) ??
      options.find((o) => routeMode(o) !== "elevator")
    );
  return mode !== "elevator"
    ? selected
    : options.find((o) => routeMode(o) !== "elevator");
}

export function routeEnvironment(option: RouteOption) {
  if (routeMode(option) === "elevator") return "elevator";
  if (
    option.hillMode === "hill" ||
    option.hillMode === "stairs" ||
    option.approximate
  )
    return "outdoor";
  return "indoor";
}

export function routeModeLabel(option: RouteOption) {
  const environment = routeEnvironment(option);
  return `${environment === "elevator" ? "엘리베이터" : environment === "outdoor" ? "실외" : "실내"} 길 (${routeName(option)})`;
}

// 지도·경유 표시용 장소 이름: 건물 이름, 스콘스퀘어, 출발 지점 이름
export function areaName(area: string) {
  if (area === PLAZA) return PLAZA;
  const building = buildingById(area);
  if (building) return building.name;
  return MAP_MARKERS.find((m) => m.id === area || m.routeId === area)?.label
    ?? campusEntrances().find((e) => e.id === area)?.name
    ?? nodeLabel(area);
}

// 거쳐 가는 곳 순서. 같은 곳에 이어 머무는 지점은 하나로 셈
export function routeAreas(option: Pick<RouteOption, "nodes">) {
  return option.nodes
    .map(nodeArea)
    .filter((area, i, list) => i === 0 || area !== list[i - 1])
    .map(areaName);
}
