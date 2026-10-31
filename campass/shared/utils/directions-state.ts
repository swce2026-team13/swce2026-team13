export type RouteRequest = {
  key: string;
  status: "loading" | "ready" | "failed";
  errorCode?: string;
};

export function routeRequestState(
  key: string,
  request: RouteRequest,
  active: boolean,
) {
  if (!active) return "inactive";
  return request.key === key ? request.status : "loading";
}

export function routeRecoveryAction(
  key: string,
  request: RouteRequest,
  active: boolean,
) {
  if (routeRequestState(key, request, active) !== "failed") return null;
  return request.errorCode === "ELEVATOR_ROUTE_UNAVAILABLE"
    ? "disable-elevator"
    : "change-destination";
}
