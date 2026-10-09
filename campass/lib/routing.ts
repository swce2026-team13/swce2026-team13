import { places } from "./catalog.ts";
export class AppError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "INVALID_INPUT") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export type Waypoint = {
  id: string;
  name: string;
  instruction: string;
  detail: string;
  photo: string;
  direction: "forward" | "right" | "up";
  x: number;
  y: number;
};
export const waypoints: Waypoint[] = [
  {
    id: "bus",
    name: "1164·2115번 정류장",
    instruction: "정류장에서 출발하세요",
    detail: "본관 입구 방향으로 이동해 주세요.",
    photo: "bus",
    direction: "forward",
    x: 52,
    y: 303,
  },
  {
    id: "main",
    name: "본관 입구",
    instruction: "본관 입구를 지나 이동하세요",
    detail: "지하주차장 통로 입구를 찾아주세요.",
    photo: "bus",
    direction: "right",
    x: 52,
    y: 160,
  },
  {
    id: "parking-entry",
    name: "지하주차장 통로 입구",
    instruction: "통로를 따라 직진하세요",
    detail: "약 25m 이동 후 오른쪽 · 시연 거리",
    photo: "corridor",
    direction: "forward",
    x: 160,
    y: 160,
  },
  {
    id: "parking",
    name: "P1 중앙",
    instruction: "오른쪽 통로로 이동하세요",
    detail: "혜인관으로 이어지는 방향을 확인해 주세요.",
    photo: "corridor",
    direction: "right",
    x: 160,
    y: 240,
  },
  {
    id: "hyein",
    name: "혜인관 입구",
    instruction: "혜인관으로 들어가세요",
    detail: "층 이동 안내를 확인해 주세요.",
    photo: "corridor",
    direction: "forward",
    x: 263,
    y: 240,
  },
  {
    id: "elevator",
    name: "혜인관 엘리베이터",
    instruction: "엘리베이터로 이동하세요",
    detail: "목적지 층을 확인한 뒤 이동해 주세요.",
    photo: "corridor",
    direction: "up",
    x: 263,
    y: 130,
  },
  {
    id: "stairs",
    name: "혜인관 계단",
    instruction: "계단으로 이동하세요",
    detail: "목적지 층의 안내 표지를 확인해 주세요.",
    photo: "corridor",
    direction: "up",
    x: 263,
    y: 130,
  },
  {
    id: "interview",
    name: "혜인관 5층 면접 대기실",
    instruction: "면접 대기실에 도착했어요",
    detail: "시연용 목적지입니다. 실제 행사 장소를 확인해 주세요.",
    photo: "corridor",
    direction: "forward",
    x: 263,
    y: 65,
  },
];
// Every edge is a demonstration fixture. Official maps verify names, not indoor connectivity.
type Edge = { from: string; to: string; meters: number; stairs?: boolean };
const edges: Edge[] = [
  { from: "bus", to: "main", meters: 40 },
  { from: "main", to: "parking-entry", meters: 30 },
  { from: "parking-entry", to: "parking", meters: 25 },
  { from: "parking", to: "hyein", meters: 45 },
  { from: "hyein", to: "elevator", meters: 15 },
  { from: "elevator", to: "interview", meters: 35 },
  { from: "hyein", to: "stairs", meters: 5, stairs: true },
  { from: "stairs", to: "interview", meters: 30, stairs: true },
];
export type Route = {
  steps: Waypoint[];
  distance: number;
  minutes: number;
  verified: false;
  elevator: boolean;
};
export function calculateRoute(
  start: string,
  destination: string,
  elevator: boolean,
): Route {
  if (
    !waypoints.some((w) => w.id === start) ||
    !places.some((p) => p.id === destination)
  )
    throw new AppError("출발지 또는 목적지를 확인해 주세요.");
  const dist = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, string>();
  const pending = new Set(waypoints.map((w) => w.id));
  while (pending.size) {
    const id = [...pending].sort(
      (a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity),
    )[0];
    if (!Number.isFinite(dist.get(id) ?? Infinity)) break;
    pending.delete(id);
    if (id === destination) break;
    for (const e of edges) {
      if (elevator && e.stairs) continue;
      const next = e.from === id ? e.to : e.to === id ? e.from : undefined;
      if (!next || !pending.has(next)) continue;
      const value = dist.get(id)! + e.meters;
      if (value < (dist.get(next) ?? Infinity)) {
        dist.set(next, value);
        previous.set(next, id);
      }
    }
  }
  if (!dist.has(destination))
    throw new AppError(
      "이 장소의 안내 경로는 아직 등록되지 않았어요. 공식 캠퍼스 지도를 확인해 주세요.",
      422,
      "ROUTE_UNAVAILABLE",
    );
  const ids = [destination];
  while (ids[0] !== start) ids.unshift(previous.get(ids[0])!);
  const steps = ids.map((id, index) => {
    const point = { ...waypoints.find((w) => w.id === id)! };
    // Descriptions authored for the canonical route must not be reused for reverse routes.
    if (destination !== "interview" && index < ids.length - 1) {
      point.instruction = `${waypoints.find((w) => w.id === ids[index + 1])!.name} 방향으로 이동하세요`;
      point.detail = "시연 경로 · 현장의 안내 표지를 함께 확인하세요.";
    }
    if (index === ids.length - 1) {
      point.instruction = "목적지에 도착했어요";
      point.detail = "주변 안내 표지와 목적지를 확인해 주세요.";
    }
    return point;
  });
  const distance = dist.get(destination)!;
  return {
    steps,
    distance,
    minutes: Math.max(1, Math.ceil(distance / 40) + (elevator ? 3 : 1)),
    verified: false,
    elevator,
  };
}
