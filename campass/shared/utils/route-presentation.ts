import type { RouteOption } from "./routing.ts";
import type { HillMode } from "./campus3d/route.ts";

// 언덕 구간을 지나지 않는 기존 일반 경로도 세 가지 선택 방식에 표시한다.
export function routeMode(option: RouteOption): HillMode {
  return option.hillMode ?? (option.lifts.includes("elevator") ? "elevator" : option.approximate ? "hill" : "stairs");
}
export const routeNames = { hill: "언덕길", stairs: "계단길", elevator: "엘리베이터길" };
export const routeColors = { hill: "#3f8a48", stairs: "#c76b12", elevator: "#10223f" };
export const routeName = (option: RouteOption) => option.hillMode ? routeNames[option.hillMode] : option.name;
