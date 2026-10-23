import { arrivalWaypoint, type Place } from "./catalog.ts";
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
  stage?: boolean;
};
export const waypoints: Waypoint[] = [
  {
    id: "gate",
    name: "학교 정문",
    instruction: "학교 정문에서 출발하세요",
    detail: "본관 1층 로비 방향으로 이동해 주세요.",
    photo: "bus",
    direction: "forward",
    x: 32,
    y: 320,
  },
  {
    id: "main",
    name: "본관 1층 로비",
    instruction: "본관 1층 로비를 지나 이동하세요",
    detail: "지하주차장 통로 입구를 찾아주세요.",
    photo: "bus",
    direction: "right",
    x: 52,
    y: 160,
    stage: true,
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
    name: "지하주차장 P1",
    instruction: "오른쪽 통로로 이동하세요",
    detail: "혜인관으로 이어지는 방향을 확인해 주세요.",
    photo: "corridor",
    direction: "right",
    x: 160,
    y: 240,
    stage: true,
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
    stage: true,
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
    stage: true,
  },
    {
    id: "bus_stop_2115",
    name: "2115번 정류장",
    instruction: "정류장에서 출발하세요",
    detail: "본관과 이어진 연결통로 방향으로 이동해 주세요.",
    photo: "bus",
    direction: "forward",
    x: 52,
    y: 303,
  },
  {
    id: "main_bus_stop_passage",
    name: "본관↔2115 정류장 연결통로",
    instruction: "연결통로를 따라 이동하세요",
    detail: "본관 복도 방향으로 이동해 주세요.",
    photo: "corridor",
    direction: "forward",
    x: 52,
    y: 240,
  },
  {
    id: "main_corridor",
    name: "본관 복도",
    instruction: "복도를 따라 이동하세요",
    detail: "엘리베이터 앞으로 이동해 주세요.",
    photo: "corridor",
    direction: "forward",
    x: 52,
    y: 180,
  },
  {
    id: "main_elevator_front",
    name: "본관 엘리베이터 앞",
    instruction: "엘리베이터 앞을 지나 이동하세요",
    detail: "한림관으로 이어지는 연결통로를 찾아 주세요.",
    photo: "corridor",
    direction: "forward",
    x: 52,
    y: 120,
  },
  {
    id: "to_hallim",
    name: "본관 5층↔한림관 3층 연결통로",
    instruction: "연결통로를 따라 한림관으로 이동하세요",
    detail: "한림관 3층 엘리베이터 방향으로 이동해 주세요.",
    photo: "corridor",
    direction: "forward",
    x: 130,
    y: 120,
    stage: true,
  },
  {
    id: "hallim_to_elevator",
    name: "한림관 3층 엘리베이터 가는 길",
    instruction: "엘리베이터 쪽으로 이동하세요",
    detail: "한림관 3층 엘리베이터 앞으로 이동해 주세요.",
    photo: "corridor",
    direction: "forward",
    x: 200,
    y: 120,
  },
  {
    id: "hallim_elevator_front",
    name: "한림관 3층 엘리베이터 앞",
    instruction: "엘리베이터로 6층까지 이동하세요",
    detail: "6층에서 내려 주세요.",
    photo: "corridor",
    direction: "up",
    x: 263,
    y: 120,
    stage: true,
  },
  {
    id: "hallim_6f_elevator",
    name: "한림관 6층 엘리베이터 앞",
    instruction: "6층에 도착했어요",
    detail: "은주1관으로 이어지는 연결통로 방향으로 이동해 주세요.",
    photo: "corridor",
    direction: "forward",
    x: 263,
    y: 90,
  },
  {
    id: "hallim_6f_corridor",
    name: "한림관 6층↔은주1관 5층 연결통로",
    instruction: "연결통로를 따라 은주1관으로 이동하세요",
    detail: "은주1관 5층으로 이어져요.",
    photo: "corridor",
    direction: "forward",
    x: 230,
    y: 65,
  },
  {
    id: "eunju1_5f_front",
    name: "은주1관 5층 앞",
    instruction: "은주1관 5층에 도착했어요",
    detail: "시연용 임시 목적지입니다.",
    photo: "corridor",
    direction: "forward",
    x: 170,
    y: 65,
    stage: true,
  },
];
// 시연 동선 · 실내 연결 미검증
type Edge = {
  from: string;
  to: string;
  meters: number;
  stairs?: boolean;
  connection?: boolean;
  floorMove?: boolean;
};
const edges: Edge[] = [
  { from: "gate", to: "main", meters: 40, connection: true },
  { from: "bus_stop_2115", to: "main", meters: 40, connection: true },
  { from: "main", to: "parking-entry", meters: 30, connection: true },
  { from: "parking-entry", to: "parking", meters: 25 },
  { from: "parking", to: "hyein", meters: 45, connection: true },
  { from: "hyein", to: "elevator", meters: 15 },
  { from: "elevator", to: "interview", meters: 35, floorMove: true },
  { from: "hyein", to: "stairs", meters: 5 },
  { from: "stairs", to: "interview", meters: 30, stairs: true, floorMove: true },
  { from: "bus_stop_2115", to: "main_bus_stop_passage", meters: 40, connection: true },
  { from: "main_bus_stop_passage", to: "main_corridor", meters: 30 },
  { from: "main_corridor", to: "main_elevator_front", meters: 20 },
  { from: "main_elevator_front", to: "to_hallim", meters: 30, connection: true },
  { from: "to_hallim", to: "hallim_to_elevator", meters: 25 },
  { from: "hallim_to_elevator", to: "hallim_elevator_front", meters: 10 },
  { from: "hallim_elevator_front", to: "hallim_6f_elevator", meters: 15, floorMove: true },
  { from: "hallim_6f_elevator", to: "hallim_6f_corridor", meters: 20 },
  { from: "hallim_6f_corridor", to: "eunju1_5f_front", meters: 40, connection: true },
];
// 공통 출발지 안내 문구 (다음 지점별)
const branchDetails: Record<string, Record<string, string>> = {
  bus_stop_2115: {
    main: "본관 1층 로비 방향으로 이동해 주세요.",
    main_bus_stop_passage: "본관과 이어진 연결통로 방향으로 이동해 주세요.",
  },
};
export const DEFAULT_START = "bus_stop_2115";
const startCandidates = [DEFAULT_START, "gate", "main", "parking"];
// 2115 정류장으로 되돌아가는 출발지는 제외
export function startOptions(destination: string, elevator: boolean) {
  return startCandidates.filter((start) => {
    try {
      const route = calculateRoute(start, destination, elevator);
      return (
        start === DEFAULT_START ||
        !route.steps.some((step) => step.id === DEFAULT_START)
      );
    } catch {
      return false;
    }
  });
}
export type Route = {
  steps: Waypoint[];
  distance: number;
  minutes: number;
  connections: number;
  floorMoves: number;
  verified: false;
  elevator: boolean;
};
// list: 목적지를 찾을 장소 목록. 서버는 호실까지 넣어서 넘김
export function calculateRoute(
  start: string,
  destination: string,
  elevator: boolean,
  list?: Place[],
): Route {
  const target = arrivalWaypoint(destination, list);
  if (!waypoints.some((w) => w.id === start) || !target)
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
    if (id === target) break;
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
  if (!dist.has(target))
    throw new AppError(
      "이 장소의 안내 경로는 아직 등록되지 않았어요. 공식 캠퍼스 지도를 확인해 주세요.",
      422,
      "ROUTE_UNAVAILABLE",
    );
  const ids = [target];
  while (ids[0] !== start) ids.unshift(previous.get(ids[0])!);
  const steps = ids.map((id, index) => {
    const point = { ...waypoints.find((w) => w.id === id)! };
    const branch = branchDetails[id]?.[ids[index + 1]];
    if (branch) point.detail = branch;
    // 역방향 경로 안내 갱신
    if (!["interview", "eunju1_5f_front"].includes(target) && index < ids.length - 1) {
      point.instruction = `${waypoints.find((w) => w.id === ids[index + 1])!.name} 방향으로 이동하세요`;
      point.detail = "시연 경로 · 현장의 안내 표지를 함께 확인하세요.";
    }
    if (index === ids.length - 1) {
      point.instruction = "목적지에 도착했어요";
      point.detail = "주변 안내 표지와 목적지를 확인해 주세요.";
    }
    return point;
  });
  const usedEdges = ids.slice(0, -1).map((id, index) => {
  const nextId = ids[index + 1];

  return edges.find(
    (edge) =>
      (edge.from === id && edge.to === nextId) ||
      (edge.from === nextId && edge.to === id),
  )!;
});

const connections = usedEdges.filter((edge) => edge.connection).length;
const floorMoves = usedEdges.filter((edge) => edge.floorMove).length;
  const distance = dist.get(target)!;
  return {
  steps,
  distance,
  minutes: Math.max(1, Math.ceil(distance / 40) + (elevator ? 3 : 1)),
  connections,
  floorMoves,
  verified: false,
  elevator,
};
}