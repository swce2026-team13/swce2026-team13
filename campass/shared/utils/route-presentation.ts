import type { RouteOption } from "./routing.ts";
import type { HillMode } from "./campus3d/route.ts";

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
export const routeNames = {
  hill: "언덕길",
  stairs: "계단길",
  elevator: "엘리베이터길",
};
export const routeColors = {
  hill: "#3f8a48",
  stairs: "#c76b12",
  elevator: "#10223f",
};
export const routeName = (option: RouteOption) =>
  option.hillMode ? routeNames[option.hillMode] : option.name;

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
