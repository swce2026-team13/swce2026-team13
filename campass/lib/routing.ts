import { currentPlaceId, places, type Place } from "./catalog.ts";
import {
  campusBuildings,
  floorCode,
  nodeKey,
  type LinkStatus,
} from "./campus3d/types.ts";
import {
  PARKING,
  PLAZA,
  buildingById,
  findPaths,
  floorLabel,
  graphNodes,
  isFloorMove,
  nodeArea,
  nodeLabel,
  type GraphPath,
  type Hop,
} from "./campus3d/route.ts";
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
    name: "혜인관 3층 면접 대기실",
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
// 출발 위치로 쓸 때 사진 안내 지점이 놓인 그래프 노드
const waypointNodes: Record<string, string> = {
  gate: "gate_main",
  bus_stop_2115: "bus_stop_2115",
  main: "bon|1",
  main_bus_stop_passage: "bon|1",
  main_corridor: "bon|1",
  main_elevator_front: "bon|1",
  "parking-entry": "bon|1",
  parking: PARKING,
  hallim_to_elevator: "hallim|3",
  hallim_elevator_front: "hallim|3",
  hallim_6f_elevator: "hallim|6",
  eunju1_5f_front: "eunju1|5",
  hyein: "hyein|B1",
  elevator: "hyein|B1",
  stairs: "hyein|B1",
  interview: "hyein|3",
};
// 연결통로 위에 있는 사진 안내 지점
const waypointLinks: Record<string, string> = {
  to_hallim: "bon-5__hallim-3",
  hallim_6f_corridor: "hallim-6__eunju1-5",
};
// 공통 출발지 안내 문구 (다음 지점별)
const branchDetails: Record<string, Record<string, string>> = {
  bus_stop_2115: {
    main: "본관 1층 로비 방향으로 이동해 주세요.",
    main_bus_stop_passage: "본관과 이어진 연결통로 방향으로 이동해 주세요.",
  },
};
const GENERIC_DETAIL = "시연 경로 · 현장의 안내 표지를 함께 확인하세요.";
export const DEFAULT_START = "bus_stop_2115";
const startCandidates = [DEFAULT_START, "gate", "main", "parking"];
// 2115 정류장으로 되돌아가는 출발지는 제외
export function startOptions(destination: string, elevator: boolean) {
  return startCandidates.filter((start) => {
    try {
      const route = calculateRoute(start, destination, elevator);
      return (
        start === DEFAULT_START ||
        !route.options[0].nodes.includes(DEFAULT_START)
      );
    } catch {
      return false;
    }
  });
}
export type RouteOption = {
  // 같은 조건이면 같은 값 (노드 목록 기준)
  id: string;
  name: "엘리베이터 길" | "지하통로 길" | "연결통로 길";
  nodes: string[];
  links: string[];
  // 건물 단위 단계 (예: 본관 1층 → 5층)
  legs: { building: string; from: string; to: string }[];
  steps: Waypoint[];
  connections: number;
  floorMoves: number;
  stepFree: boolean | null;
  // '추정' 출발 연결(실외 길 대략)을 지나면 true
  approximate: boolean;
};
// 기존 필드는 고른 후보(없으면 첫 후보) 값으로 채움
export type Route = {
  steps: Waypoint[];
  distance: number;
  connections: number;
  floorMoves: number;
  verified: false;
  elevator: boolean;
  option: string;
  options: RouteOption[];
};
export type RouteChoice = {
  // 후보 id. 없으면 첫 후보
  option?: string;
  // 기본은 '확인' 연결만 씀
  statuses?: LinkStatus[];
};

function startPoint(start: string) {
  if (waypointLinks[start]) return { node: start, link: waypointLinks[start] };
  if (waypointNodes[start]) return { node: waypointNodes[start] };
  if (graphNodes.includes(start)) return { node: start };
  // 지도에서 건물을 출발로 고를 때: 1층, 없으면 가장 아래층
  const building = buildingById(start);
  if (building) {
    const floor = building.floors.find((f) => f.floor === "1") ?? building.floors[0];
    return { node: nodeKey(building.id, floor.floor) };
  }
}

function destinationNodes(destination: string, list: Place[]) {
  const id = currentPlaceId(destination);
  if (id === "parking") return [PARKING];
  if (id === "eunju1_5f_front") return ["eunju1|5"];
  const place = list.find((p) => p.id === id);
  if (!place) return;
  const building = campusBuildings().find((b) => b.name === place.building);
  if (!building) return [];
  const floor =
    place.category === "building" || !place.floor
      ? ""
      : (building.floors.find((f) => f.label === place.floor)?.floor ??
        floorCode(building.id, place.floor));
  const node = nodeKey(building.id, floor);
  // 건물 장소는 그 건물의 아무 층이나 먼저 닿는 층
  return graphNodes.includes(node)
    ? [node]
    : building.floors.map((f) => nodeKey(building.id, f.floor));
}

// 노드에 붙는 사진 안내 지점. 들어오고 나가는 방향이 맞는 것만
function nodeWaypoints(
  node: string,
  prev: Hop | undefined,
  next: Hop | undefined,
  arrival: string,
) {
  const up = Boolean(next && isFloorMove(next.edge));
  const byElevator = next?.edge.kind === "elevator";
  switch (node) {
    case "bus_stop_2115":
      return ["bus_stop_2115"];
    case "gate_main":
      return ["gate"];
    case PARKING:
      return ["parking"];
    case "eunju1|5":
      return ["eunju1_5f_front"];
    case "hallim|6":
      return prev && isFloorMove(prev.edge) ? ["hallim_6f_elevator"] : [];
    case "hallim|3":
      return byElevator ? ["hallim_to_elevator", "hallim_elevator_front"] : [];
    case "bon|1":
      return [
        prev?.from === "bus_stop_2115" && up ? "main_bus_stop_passage" : "main",
        ...(next?.edge.id === "bon-1__지하주차장-B1" ? ["parking-entry"] : []),
        ...(up ? ["main_corridor"] : []),
        ...(byElevator ? ["main_elevator_front"] : []),
      ];
  }
  const list: string[] = [];
  if (node === "hyein|B1" && prev?.edge.id === "hyein-B1__지하주차장-B1")
    list.push("hyein");
  // 혜인관 층 이동을 시작하는 층
  if (nodeArea(node) === "hyein" && up)
    list.push(byElevator ? "elevator" : "stairs");
  if (node === "hyein|3" && !next && arrival === "interview")
    list.push("interview");
  return list;
}

function linkWaypoint(hop: Hop) {
  if (hop.edge.id === "bon-5__hallim-3" && hop.to === "hallim|3")
    return "to_hallim";
  if (hop.edge.id === "hallim-6__eunju1-5" && hop.to === "eunju1|5")
    return "hallim_6f_corridor";
}

// 받침이 있으면 '으로', 없거나 ㄹ이면 '로'
function toward(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const final = code >= 0 && code < 11172 ? code % 28 : 0;
  return `${word}${final && final !== 8 ? "으로" : "로"}`;
}

// 사진 안내 지점이 없는 곳은 글자 단계로
function textStep(path: GraphPath, index: number): Waypoint {
  const node = path.nodes[index];
  const next = path.hops[index];
  let instruction = "목적지에 도착했어요";
  if (next && isFloorMove(next.edge)) {
    let end = index;
    while (path.hops[end] && isFloorMove(path.hops[end].edge)) end++;
    instruction = `${next.edge.kind === "elevator" ? "엘리베이터로" : "계단으로"} ${toward(floorLabel(path.nodes[end]))} 가세요`;
  } else if (next && node === PLAZA)
    instruction = `${toward(PLAZA)} 나가 ${toward(nodeLabel(next.to))} 가세요`;
  else if (next) instruction = `${toward(nodeLabel(next.to))} 이어진 길로 가세요`;
  return {
    id: node,
    name: nodeLabel(node),
    instruction,
    detail: GENERIC_DETAIL,
    photo: "",
    direction: next && isFloorMove(next.edge) ? "up" : "forward",
    x: 0,
    y: 0,
  };
}

const liftPoints = [
  "main_elevator_front",
  "hallim_elevator_front",
  "elevator",
  "stairs",
];

function buildSteps(path: GraphPath, start: string, destination: string) {
  const arrival = currentPlaceId(destination);
  const entries: (string | Waypoint)[] = [];
  path.nodes.forEach((node, index) => {
    const prev = path.hops[index - 1];
    const next = path.hops[index];
    // 같은 건물 안에서 이어지는 층 이동의 중간 층은 건너뜀
    if (
      prev &&
      next &&
      isFloorMove(prev.edge) &&
      isFloorMove(next.edge) &&
      nodeArea(prev.from) === nodeArea(next.to)
    )
      return;
    const onLink = next && linkWaypoint(next);
    if (index === 0 && waypointLinks[start]) entries.push(start);
    else {
      const attached = nodeWaypoints(node, prev, next, arrival);
      entries.push(...attached);
      // 층 이동을 알려 주는 지점이 없으면 글자 단계를 더함
      const movesFloor =
        next &&
        isFloorMove(next.edge) &&
        !attached.some((id) => liftPoints.includes(id));
      if ((!attached.length && !onLink) || movesFloor)
        entries.push(textStep(path, index));
    }
    if (onLink && !(index === 0 && waypointLinks[start])) entries.push(onLink);
  });
  // 사진 안내 지점에서 출발하면 그 지점이 첫 단계
  if (waypoints.some((w) => w.id === start)) {
    const first = entries.indexOf(start);
    if (first >= 0) entries.splice(0, first);
    else entries.unshift(start);
  }
  const points = entries.map((entry) =>
    typeof entry === "string"
      ? { ...waypoints.find((w) => w.id === entry)! }
      : entry,
  );
  // 글자 단계는 바로 앞(없으면 뒤) 지점 좌표를 씀
  points.forEach((point, index) => {
    if (point.photo) return;
    const near =
      points.slice(0, index).reverse().find((p) => p.photo) ??
      points.slice(index + 1).find((p) => p.photo);
    point.x = near?.x ?? 0;
    point.y = near?.y ?? 0;
  });
  const demo = ["interview", "eunju1_5f_front"];
  return points.map((point, index) => {
    const nextPoint = points[index + 1];
    const branch = nextPoint && branchDetails[point.id]?.[nextPoint.id];
    if (branch) point.detail = branch;
    // 시연 목적지가 아니면 '다음 지점 방향으로' 안내. 도중에 지나는 시연 도착 지점도 같게
    if (
      nextPoint &&
      point.photo &&
      (!demo.includes(arrival) || demo.includes(point.id))
    ) {
      point.instruction = `${nextPoint.name} 방향으로 이동하세요`;
      point.detail = GENERIC_DETAIL;
    }
    if (!nextPoint) {
      point.instruction = "목적지에 도착했어요";
      point.detail = "주변 안내 표지와 목적지를 확인해 주세요.";
    }
    return point;
  });
}

// 노드 목록으로 만든 짧은 id
function optionId(nodes: string[]) {
  let hash = 5381;
  for (const char of nodes.join(">"))
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return `route-${hash.toString(36)}`;
}

function toOption(
  path: GraphPath,
  elevator: boolean,
  start: string,
  destination: string,
): RouteOption {
  const edges = path.hops.map((h) => h.edge);
  const legs: RouteOption["legs"] = [];
  for (const node of path.nodes) {
    const area = nodeArea(node);
    if (!buildingById(area) && area !== PLAZA && area !== PARKING) continue;
    const name = buildingById(area)?.name ?? area;
    const last = legs.at(-1);
    if (last?.building === name) last.to = floorLabel(node);
    else legs.push({ building: name, from: floorLabel(node), to: floorLabel(node) });
  }
  return {
    id: optionId(path.nodes),
    name: path.nodes.includes(PARKING)
      ? "지하통로 길"
      : elevator
        ? "엘리베이터 길"
        : "연결통로 길",
    nodes: path.nodes,
    links: path.hops.map((h) =>
      isFloorMove(h.edge) ? `${h.from}>${h.to}` : h.edge.id,
    ),
    legs,
    steps: buildSteps(path, start, destination),
    connections: edges.filter((e) => e.kind === "link").length,
    // 같은 건물에서 이어지는 층 이동은 한 번으로 셈
    floorMoves: edges.filter(
      (e, i) => isFloorMove(e) && !(i > 0 && isFloorMove(edges[i - 1])),
    ).length,
    stepFree: edges.some((e) => e.stepFree === false)
      ? false
      : edges.some((e) => e.stepFree === null)
        ? null
        : true,
    approximate: edges.some((e) => e.approximate),
  };
}

// list: 목적지를 찾을 장소 목록. 서버는 호실 · 편의시설까지 넣어서 넘김
export function calculateRoute(
  start: string,
  destination: string,
  elevator: boolean,
  list: Place[] = places,
  choice: RouteChoice = {},
): Route {
  const from = startPoint(start);
  const targets = destinationNodes(destination, list);
  if (!from || !targets)
    throw new AppError("출발지 또는 목적지를 확인해 주세요.");
  const paths = findPaths(from, targets, {
    elevator,
    statuses: choice.statuses,
  });
  if (!paths.length)
    throw new AppError(
      "이 장소의 안내 경로는 아직 등록되지 않았어요. 공식 캠퍼스 지도를 확인해 주세요.",
      422,
      "ROUTE_UNAVAILABLE",
    );
  const options = paths.map((path) =>
    toOption(path, elevator, start, destination),
  );
  const chosen = choice.option
    ? options.find((o) => o.id === choice.option)
    : options[0];
  if (!chosen) throw new AppError("경로 후보를 확인해 주세요.");
  const path = paths[options.indexOf(chosen)];
  return {
    steps: chosen.steps,
    // 층 이동을 뺀 건물 사이 거리(m)
    distance: Math.round(
      path.hops
        .filter((h) => !isFloorMove(h.edge))
        .reduce((sum, h) => sum + h.edge.cost, 0),
    ),
    connections: chosen.connections,
    floorMoves: chosen.floorMoves,
    verified: false,
    elevator,
    option: chosen.id,
    options,
  };
}
