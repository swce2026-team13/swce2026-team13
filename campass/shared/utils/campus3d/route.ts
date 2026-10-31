import {
  buildingPosition,
  campusBuildings,
  campusEntrances,
  campusExtraNodes,
  campusLinks,
  nodeKey,
  type LinkEnd,
  type LinkStatus,
  type LocalPoint,
} from "./types.ts";
import { HILL_ENTRY_BUILDINGS, hillEntry } from "../campus-map.ts";

// 캠퍼스 이동 그래프. 노드는 '건물ID|층', 스콘스퀘어, 지하주차장, 출발 지점(2115 정류장 · 정문)
export const PLAZA = "스콘스퀘어";
export const PARKING = "지하주차장";

const STAIRS_COST = 16;
const ELEVATOR_COST = 50;
const ELEVATOR_PER_FLOOR = 3;
const MAX_OPTIONS = 3;

export type HillMode = "hill" | "stairs" | "elevator";

export type EdgeKind = "link" | "start" | "stairs" | "elevator";

export type Edge = {
  id: string;
  a: string;
  b: string;
  cost: number;
  kind: EdgeKind;
  stepFree: boolean | null;
  status: LinkStatus;
  // '추정' 출발 연결(실외 길 대략)
  approximate: boolean;
  hillMode?: HillMode;
};

// 지나간 방향까지 담은 연결
export type Hop = { edge: Edge; from: string; to: string };

export type GraphPath = {
  nodes: string[];
  hops: Hop[];
  cost: number;
  hillMode?: HillMode;
};

export type SearchOptions = {
  elevator: boolean;
  hillMode?: HillMode;
  // 기본은 '확인'만. '확인 필요' · '추정'을 더할 수 있음
  statuses?: LinkStatus[];
  // 엘리베이터 이동과 '확인' + 단차 없는 연결만 씀(계단 · 언덕 · 추정 연결 제외)
  stepFreeOnly?: boolean;
};

const buildings = campusBuildings();
const plaza = campusExtraNodes().find((n) => n.id === PLAZA)!;
const startEntrances = campusEntrances().filter((e) => e.connectsTo);

export const isFloorMove = (edge: Edge) =>
  edge.kind === "stairs" || edge.kind === "elevator";

// 노드가 속한 곳: 건물 id, 스콘스퀘어, 지하주차장, 출발 지점 id
export const nodeArea = (node: string) => node.split("|")[0];

export const buildingById = (id: string) => buildings.find((b) => b.id === id);

export function nodeLabel(node: string) {
  if (node === PLAZA) return PLAZA;
  if (node === PARKING) return PARKING;
  const building = buildingById(nodeArea(node));
  if (!building)
    return campusEntrances().find((e) => e.id === node)?.name ?? node;
  return `${building.name} ${floorLabel(node)}`;
}

export function floorLabel(node: string) {
  if (node === PLAZA) return "광장";
  if (node === PARKING) return "지하 1층";
  const [id, floor] = node.split("|");
  return buildingById(id)?.floors.find((f) => f.floor === floor)?.label ?? "";
}

function position(node: string): LocalPoint {
  if (node === PLAZA || node === PARKING) return plaza.approxLocal!;
  const entrance = startEntrances.find((e) => e.id === node);
  if (entrance) return entrance.local;
  return buildingPosition(buildingById(nodeArea(node))!);
}

const distance = (a: string, b: string) => {
  const [ax, ay] = position(a);
  const [bx, by] = position(b);
  return Math.round(Math.hypot(ax - bx, ay - by) * 10) / 10;
};

// 링크 끝이 스콘스퀘어(광장) · 지하주차장(B1)이면 그 노드로
const endNode = (end: LinkEnd) =>
  end.building === PLAZA || end.building === PARKING
    ? end.building
    : nodeKey(end.building, end.floor);

export const graphNodes = [
  ...buildings.flatMap((b) => b.floors.map((f) => nodeKey(b.id, f.floor))),
  PLAZA,
  PARKING,
  ...startEntrances.map((e) => e.id),
];

export const graphEdges: Edge[] = [
  ...campusLinks().map((link): Edge => {
    const a = endNode(link.from);
    const b = endNode(link.to);
    return {
      id: link.id,
      a,
      b,
      cost: distance(a, b),
      kind: "link",
      stepFree: link.stepFree,
      status: link.status,
      approximate: false,
    };
  }),
  ...buildings.flatMap((b) => {
    const floors = b.floors.map((f) => nodeKey(b.id, f.floor));
    const edges: Edge[] = floors.slice(1).map((node, i) => ({
      id: `${floors[i]}>${node}`,
      a: floors[i],
      b: node,
      cost: STAIRS_COST,
      kind: "stairs",
      stepFree: false,
      status: "확인",
      approximate: false,
    }));
    if (b.elevator === true)
      floors.forEach((from, i) =>
        floors.slice(i + 1).forEach((to, j) =>
          edges.push({
            id: `${from}>${to}`,
            a: from,
            b: to,
            cost: ELEVATOR_COST + (j + 1) * ELEVATOR_PER_FLOOR,
            kind: "elevator",
            stepFree: true,
            status: "확인",
            approximate: false,
          }),
        ),
      );
    return edges;
  }),
  // 출발 지점 연결은 상태와 상관없이 씀
  ...startEntrances.map((e): Edge => {
    const to = nodeKey(e.connectsTo!.building, e.connectsTo!.floor);
    return {
      id: `${e.id}>${to}`,
      a: e.id,
      b: to,
      cost: distance(e.id, to),
      kind: "start",
      stepFree: e.stepFree,
      status: e.connectsStatus ?? "추정",
      approximate: e.connectsStatus === "추정",
    };
  }),
];

// 사용자 제공 동선. 연결 지점은 기존 좌표를 쓰며 실외 선형은 대략적인 안내다.
const hillEdges: Edge[] = [
  { id: "hill-bus-plaza", a: "bus_stop_2115", b: PLAZA, hillMode: "hill" },
  {
    id: "stairs-bus-hallim",
    a: "bus_stop_2115",
    b: "hallim|3",
    hillMode: "stairs",
  },
  {
    id: "stairs-hallim-eunju",
    a: "hallim|3",
    b: "eunju1|5",
    hillMode: "stairs",
  },
].map((edge) => ({
  ...edge,
  hillMode: edge.hillMode as HillMode,
  cost: distance(edge.a, edge.b),
  kind: "link",
  stepFree: false,
  status: "확인",
  approximate: true,
}));
graphEdges.push(...hillEdges);

// 언덕길 가운데에서 문예관 앞 · 북악관 앞 입구로 바로 들어가는 길. 입구는 언덕과 같은 높이
for (const id of HILL_ENTRY_BUILDINGS) {
  const entry = hillEntry(id);
  if (!entry) continue;
  graphEdges.push({
    id: `hill-plaza-${id}`,
    a: PLAZA,
    b: nodeKey(id, entry.floor),
    cost: entry.length,
    kind: "link",
    stepFree: false,
    // 입구 층은 언덕 높이로 정한 값이라 현장 확인 전까지 '추정'
    status: "추정",
    approximate: true,
    hillMode: "hill",
  });
}

const adjacency = new Map<string, Edge[]>();
for (const edge of graphEdges)
  for (const node of [edge.a, edge.b])
    adjacency.set(node, [...(adjacency.get(node) ?? []), edge]);

function usable(edge: Edge, options: SearchOptions) {
  if (options.stepFreeOnly)
    return edge.kind === "elevator" ||
      ((edge.kind === "link" || edge.kind === "start") && !edge.hillMode &&
        edge.status === "확인" && edge.stepFree === true);
  if (edge.hillMode && edge.hillMode !== options.hillMode) return false;
  if (
    options.hillMode === "stairs" &&
    (edge.kind === "elevator" ||
      ["hallim-3__eunju1-2", "hallim-6__eunju1-5"].includes(edge.id))
  )
    return false;
  if (options.hillMode === "hill" || options.hillMode === "stairs") {
    // 실외 방식을 골랐을 때 실내 통로나 지하주차장으로 우회하지 않는다.
    if (["bon-5__hallim-3", "bon-1__지하주차장-B1"].includes(edge.id))
      return false;
  }
  if (options.elevator && edge.stepFree === false) return false;
  if (edge.kind !== "link") return true;
  return (options.statuses ?? []).concat("확인").includes(edge.status);
}

// 출발이 연결통로 위(사진 안내 지점)이면 그 연결의 양 끝을 절반 비용으로 시작
type Start = { node: string; link?: string };

function shortest(
  start: Start,
  targets: Set<string>,
  options: SearchOptions,
  blocked?: Edge,
): GraphPath | undefined {
  const dist = new Map<string, number>();
  const previous = new Map<string, Hop>();
  const startLink = start.link
    ? graphEdges.find((e) => e.kind === "link" && e.id === start.link)
    : undefined;
  if (startLink) {
    if (startLink === blocked || !usable(startLink, options)) return;
    for (const end of [startLink.a, startLink.b]) {
      dist.set(end, startLink.cost / 2);
      previous.set(end, { edge: startLink, from: start.node, to: end });
    }
  } else dist.set(start.node, 0);
  const done = new Set<string>();
  let reached: string | undefined;
  while (!reached) {
    let node: string | undefined;
    for (const [candidate, value] of dist)
      if (
        !done.has(candidate) &&
        (node === undefined || value < dist.get(node)!)
      )
        node = candidate;
    if (node === undefined) return;
    if (targets.has(node)) {
      reached = node;
      break;
    }
    done.add(node);
    for (const edge of adjacency.get(node) ?? []) {
      if (edge === blocked || !usable(edge, options)) continue;
      const next = edge.a === node ? edge.b : edge.a;
      if (done.has(next)) continue;
      const value = dist.get(node)! + edge.cost;
      if (value < (dist.get(next) ?? Infinity)) {
        dist.set(next, value);
        previous.set(next, { edge, from: node, to: next });
      }
    }
  }
  const hops: Hop[] = [];
  for (let node = reached; node !== start.node;) {
    const hop = previous.get(node)!;
    hops.unshift(hop);
    node = hop.from;
  }
  return {
    nodes: [start.node, ...hops.map((h) => h.to)],
    hops,
    cost: dist.get(reached)!,
  };
}

// 건물 순서. 같은 건물에 이어 머무는 노드는 하나로 셈
export const areaOrder = (path: GraphPath) =>
  path.nodes
    .map(nodeArea)
    .filter((area, i, list) => i === 0 || area !== list[i - 1])
    .join(">");

const cache = new Map<string, GraphPath[]>();

// 가장 싼 길을 찾고, 그 길의 연결을 하나씩 막아 다른 길을 찾음. 건물 순서가 같은 길은 하나로 합침
export function findPaths(
  start: Start,
  targets: string[],
  options: SearchOptions,
): GraphPath[] {
  const key = JSON.stringify([
    start,
    [...targets].sort(),
    options.elevator,
    options.hillMode,
    [...(options.statuses ?? [])].sort(),
    Boolean(options.stepFreeOnly),
  ]);
  const cached = cache.get(key);
  if (cached) return cached;
  const goal = new Set(targets);
  const best = shortest(start, goal, options);
  const found: GraphPath[] = [];
  if (best) {
    const candidates = [
      best,
      ...best.hops.flatMap(
        (hop) => shortest(start, goal, options, hop.edge) ?? [],
      ),
    ].sort((a, b) => a.cost - b.cost);
    const seen = new Set<string>();
    for (const path of candidates) {
      const order = areaOrder(path);
      if (seen.has(order)) continue;
      seen.add(order);
      found.push(path);
      if (found.length === MAX_OPTIONS) break;
    }
  }
  cache.set(key, found);
  return found;
}

// 기존 최단 경로가 본관 저층과 상부 캠퍼스를 잇는 경우에만 세 방식을 제시한다.
export function findHillPaths(
  start: Start,
  targets: string[],
  options: SearchOptions,
  baseline: GraphPath[],
): GraphPath[] {
  if (options.elevator || start.link) return [];
  const crosses = baseline.some(
    (path) =>
      path.nodes.includes("bon|1") &&
      path.nodes.some((node) =>
        ["hallim", "eunju1", "hyein", PLAZA].includes(nodeArea(node)),
      ),
  );
  if (!crosses) return [];
  return (["hill", "stairs", "elevator"] as const).flatMap((hillMode) => {
    const path = shortest(start, new Set(targets), {
      ...options,
      hillMode,
      elevator: hillMode === "elevator",
    });
    if (!path) return [];
    const usesMode =
      hillMode === "elevator"
        ? path.hops.some(
            (h) => h.edge.kind === "elevator" && nodeArea(h.from) === "bon",
          )
        : path.hops.some((h) => h.edge.hillMode === hillMode);
    return usesMode ? [{ ...path, hillMode }] : [];
  });
}
