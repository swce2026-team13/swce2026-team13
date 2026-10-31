import {
  PLAZA,
  buildingById,
  findPaths,
  floorLabel,
  graphEdges,
  nodeArea,
  type Edge,
} from "./campus3d/route.ts";
import { campusBuildings, campusEntrances } from "./campus3d/types.ts";
import { MAP_MARKERS, routeCoordinate } from "./campus-map.ts";

// 엘리베이터 지름길: 계단·언덕 없이 엘리베이터와 '확인'된 단차 없는 연결만으로 이어지는 곳

export type ShortcutArea = {
  // 건물 id, 스콘스퀘어, 출발 지점 id
  id: string;
  name: string;
  // 이곳에서 출발·도착할 때 쓰는 지점(건물은 연결이 닿는 가장 낮은 층)
  node: string;
  // 정류장처럼 출발로만 고를 수 있는 곳
  startOnly: boolean;
};

export type ShortcutAreas = { areas: ShortcutArea[]; pairs: [string, string][] };

// 엘리베이터 이동과 '확인' + 단차 없음 연결만 씀. 계단 · 언덕 · '추정' · '확인 필요'는 빼요.
export function isStepFreeEdge(edge: Edge) {
  if (edge.kind === "elevator") return true;
  return (edge.kind === "link" || edge.kind === "start") && !edge.hillMode &&
    edge.status === "확인" && edge.stepFree === true;
}

const startPoints = new Set(campusEntrances().map((e) => e.id));

function areaName(area: string) {
  if (area === PLAZA) return PLAZA;
  const building = buildingById(area);
  if (building) return building.name;
  return MAP_MARKERS.find((m) => m.routeId === area)?.label ??
    campusEntrances().find((e) => e.id === area)?.name ?? area;
}

// 층 순서로 정렬. 건물이 아닌 곳은 지점 하나뿐
function floorIndex(node: string) {
  const [id, floor] = node.split("|");
  return buildingById(id)?.floors.findIndex((f) => f.floor === floor) ?? 0;
}

// links.json · buildings.json에서 만든 연결로 계산해요. 연결이 '확인'으로 바뀌면 목록이 저절로 늘어나요.
export function elevatorShortcutAreas(edges: Edge[] = graphEdges): ShortcutAreas {
  const usable = edges.filter(isStepFreeEdge);
  const neighbors = new Map<string, string[]>();
  for (const edge of usable)
    for (const [from, to] of [[edge.a, edge.b], [edge.b, edge.a]])
      neighbors.set(from, [...(neighbors.get(from) ?? []), to]);
  // 다른 곳과 이어지는 지점(연결의 끝)
  const crossings = usable.filter((e) => e.kind !== "elevator" && nodeArea(e.a) !== nodeArea(e.b))
    .flatMap((e) => [e.a, e.b]);

  const seen = new Set<string>();
  const areas: ShortcutArea[] = [];
  for (const first of new Set(crossings)) {
    if (seen.has(first)) continue;
    const group: string[] = [];
    for (const queue = [first]; queue.length;) {
      const node = queue.pop()!;
      if (seen.has(node)) continue;
      seen.add(node);
      group.push(node);
      queue.push(...(neighbors.get(node) ?? []));
    }
    const ends = new Map<string, string[]>();
    for (const node of crossings.filter((n) => group.includes(n)))
      ends.set(nodeArea(node), [...new Set([...(ends.get(nodeArea(node)) ?? []), node])]);
    // 한 곳 안에서 서로 다른 층의 연결을 이어야 할 때만 엘리베이터를 지나요.
    // 예: 은주2관 1층 ↔ 수인관 1층은 같은 높이 실외 연결이라 지름길이 아니에요.
    if (ends.size < 2 || ![...ends.values()].some((nodes) => nodes.length > 1)) continue;
    for (const [area, nodes] of ends)
      areas.push({
        id: area,
        name: areaName(area),
        node: [...nodes].sort((a, b) => floorIndex(a) - floorIndex(b))[0],
        startOnly: startPoints.has(area),
      });
  }
  // 출발 전용 지점을 앞에 둬요.
  areas.sort((a, b) => Number(b.startOnly) - Number(a.startOnly));
  const pairs = areas.flatMap((a, i) => areas.slice(i + 1)
    .filter((b) => groupOf(a) === groupOf(b))
    .map((b): [string, string] => [a.id, b.id]));
  return { areas, pairs };

  function groupOf(area: ShortcutArea) {
    // 같은 묶음끼리만 쌍을 만들어요.
    const queue = [area.node];
    const reach = new Set<string>();
    while (queue.length) {
      const node = queue.pop()!;
      if (reach.has(node)) continue;
      reach.add(node);
      queue.push(...(neighbors.get(node) ?? []));
    }
    return [...reach].sort()[0];
  }
}

export type SectionMove = "elevator" | "passage" | "plaza";

export type SectionStop = {
  area: string;
  name: string;
  // 들어온 지점과 나간 지점
  enter: { node: string; floor: string; elevation: number | null };
  exit: { node: string; floor: string; elevation: number | null };
  // 이 곳 안에서의 이동(층이 바뀌면 엘리베이터)
  inside: "elevator" | null;
  // 다음 곳으로 넘어가는 방법. 마지막 곳은 없음
  next: Exclude<SectionMove, "elevator"> | null;
};

export type ElevatorSection = {
  start: ShortcutArea;
  destination: ShortcutArea;
  stops: SectionStop[];
  elevators: number;
  passages: number;
  stairs: 0;
  // 출발과 도착 높이 차(m). 오르막이면 양수
  rise: number | null;
};

const point = (node: string) => ({
  node,
  floor: node.includes("|") ? floorLabel(node) : "",
  // 길찾기 화면 「높이 변화」와 같은 높이 계산
  elevation: routeCoordinate(node)?.elevation ?? null,
});

// 출발·도착 곳을 받아 단면도로 그릴 단계로 바꿔요. 지름길이 없으면 undefined
export function elevatorSection(startId: string, destinationId: string): ElevatorSection | undefined {
  const { areas, pairs } = elevatorShortcutAreas();
  const start = areas.find((a) => a.id === startId);
  const destination = areas.find((a) => a.id === destinationId);
  if (!start || !destination || destination.startOnly || start.id === destination.id ||
      !pairs.some((pair) => pair.includes(start.id) && pair.includes(destination.id))) return;
  const [path] = findPaths({ node: start.node }, [destination.node], { elevator: true, stepFreeOnly: true });
  if (!path) return;
  const stops: SectionStop[] = [];
  path.nodes.forEach((node, i) => {
    const area = nodeArea(node);
    const last = stops.at(-1);
    if (last?.area === area) {
      last.exit = point(node);
      last.inside = "elevator";
      return;
    }
    if (last) {
      const hop = path.hops[i - 1];
      last.next = area === PLAZA || nodeArea(hop.from) === PLAZA ? "plaza" : "passage";
    }
    stops.push({ area, name: areaName(area), enter: point(node), exit: point(node), inside: null, next: null });
  });
  const first = stops[0].enter.elevation;
  const end = stops.at(-1)!.exit.elevation;
  return {
    start,
    destination,
    stops,
    elevators: stops.filter((s) => s.inside === "elevator").length,
    passages: stops.filter((s) => s.next === "passage").length,
    stairs: 0,
    rise: first !== null && end !== null ? Math.round((end - first) * 10) / 10 : null,
  };
}

// 장소가 속한 지름길 곳 id. 건물 안 장소는 그 건물로 봐요.
export function shortcutAreaOf(place: { id: string; building?: string }) {
  if (buildingById(place.id) || place.id === PLAZA) return place.id;
  return campusBuildings().find((b) => b.name === place.building)?.id ?? place.id;
}
