import { currentPosition, routeSegments } from "./campus-map.ts";
import {
  campusBuildings,
  campusEntrances,
  campusExtraNodes,
  campusLinks,
  type LinkStatus,
  type LocalPoint,
} from "./campus3d/types.ts";
import { nodeArea, PARKING } from "./campus3d/route.ts";
import type { GuideMapData } from "./guide-view.ts";

// 캠퍼스 개요도(B2)에 그릴 도형과 색. 좌표는 지도 픽셀로 바꿔서 돌려줌
export const MAP_WIDTH = 360;
export const MAP_HEIGHT = 381;
const PADDING = 18;

// 대표 학과색 45% + 흰색 55%. 범례와 건물에 같은 색을 쓴다.
const pastel = (hex: string) => "#" + [1, 3, 5].map((i) =>
  Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.45 + 255 * 0.55).toString(16).padStart(2, "0"),
).join("");

export const LEGEND = [
  { label: "컴퓨터·전자 등 공학", color: "#C4DBFF" },
  { label: "토목·도시공학", color: "#BAE5E0" },
  { label: "음악", color: "#D9C9FC" },
  { label: "연기·뮤지컬·무용", color: "#FCC7CC" },
  { label: "디자인·영상", color: "#FFDBAD" },
  { label: "헤어·메이크업·뷰티", color: "#FACCED" },
  { label: "어학·경영·공공·광고", color: "#FAF2B2" },
  { label: "군사학", color: "#D6DEB8" },
  { label: "공용·행정", color: "#E3E8ED" },
].map((item) => ({ ...item, color: pastel(item.color) }));

// 광장·운동장 녹지와 학과가 정해지지 않은 건물 색. 범례에는 넣지 않음
export const GROUND_COLORS = ["#d6ebcf", pastel("#E4E8EE")];

type BuildingStyle = {
  colors: string[];
  label?: string;
};

const styles: Record<string, BuildingStyle> = {
  bukak: { colors: ["#C4DBFF", "#FCC7CC"] },
  munye: { colors: ["#D9C9FC", "#FCC7CC"] },
  daeil: { colors: ["#D9C9FC", "#BAE5E0"] },
  bon: { colors: ["#E3E8ED", "#D6DEB8"] },
  eunju1: { colors: ["#FCC7CC", "#C4DBFF"] },
  hyein: { colors: ["#FFDBAD", "#FAF2B2"] },
  sangseung: { colors: ["#E3E8ED"] },
  chungwoon: { colors: ["#E3E8ED"] },
  hallim: { colors: ["#FAF2B2"] },
  yudam: { colors: ["#FACCED"] },
  eunju2: { colors: ["#BAE5E0"] },
  suin: { colors: ["#D1EBC7", "#C2E3B8"], label: "수인관·체육관" },
  creative: { colors: ["#E4E8EE"] },
};

const plaza = campusExtraNodes().find((n) => n.kind === "plaza")!;
const entrance = (id: string) => campusEntrances().find((e) => e.id === id)!;

export type MarkerKind = "bus" | "parking" | "gate";
const markerList: { id: string; label: string; kind: MarkerKind }[] = [
  { id: "bus_stop_2115", label: "2115번", kind: "bus" },
  { id: "parking_entrance_1", label: "1주차장", kind: "parking" },
  { id: "parking_entrance_2", label: "2주차장", kind: "parking" },
  { id: "gate_main", label: "정문", kind: "gate" },
];

// 건물 윤곽과 지도 표시가 모두 들어오는 범위로 축척을 정함. 이름표가 오른쪽에 붙으니 오른쪽 여백을 더 둠
const allPoints: LocalPoint[] = [
  ...campusBuildings().flatMap((b) => b.footprint.polygon),
  ...(plaza.polygon ?? []),
  ...markerList.map((m) => entrance(m.id).local),
  // 표시만 합치고 기존 투영 좌표는 그대로 유지한다.
  entrance("bus_stop_1164").local,
];
const minEast = Math.min(...allPoints.map((p) => p[0]));
const maxEast = Math.max(...allPoints.map((p) => p[0]));
const minNorth = Math.min(...allPoints.map((p) => p[1]));
const maxNorth = Math.max(...allPoints.map((p) => p[1]));
const scale = Math.min(
  (MAP_WIDTH - PADDING * 2 - 24) / (maxEast - minEast),
  (MAP_HEIGHT - PADDING * 2) / (maxNorth - minNorth),
);
const offsetX = (MAP_WIDTH - 24 - (maxEast - minEast) * scale) / 2;
const offsetY = (MAP_HEIGHT - (maxNorth - minNorth) * scale) / 2;

// 북쪽이 위: SVG y는 북쪽 값의 반대
export function project([east, north]: LocalPoint): [number, number] {
  return [
    round(offsetX + (east - minEast) * scale),
    round(offsetY + (maxNorth - north) * scale),
  ];
}

const round = (value: number) => Math.round(value * 100) / 100;
const pointsAttr = (polygon: LocalPoint[]) =>
  polygon.map((p) => project(p).join(",")).join(" ");

export type OverviewBuilding = {
  id: string;
  name: string;
  label: string;
  colors: string[];
  points: string;
  center: [number, number];
};

export const overviewBuildings: OverviewBuilding[] = campusBuildings().map(
  (b) => {
    const style = styles[b.id];
    return {
      id: b.id,
      name: b.name,
      label: style?.label ?? b.name,
      colors: [b.id === "suin" ? "#d6ebcf" : pastel(style?.colors[0] ?? "#E4E8EE")],
      points: pointsAttr(b.footprint.polygon),
      center: project(b.footprint.center),
    };
  },
);

// 광장 둘레 점선은 광장보다 조금 크게 그림
const plazaCenter = plaza.approxLocal!;
export const overviewPlaza = {
  points: pointsAttr(plaza.polygon!),
  outline: pointsAttr(
    plaza.polygon!.map(([e, n]): LocalPoint => [
      plazaCenter[0] + (e - plazaCenter[0]) * 1.08,
      plazaCenter[1] + (n - plazaCenter[1]) * 1.08,
    ]),
  ),
  center: project(plazaCenter),
};

export type OverviewMarker = {
  id: string;
  label: string;
  kind: MarkerKind;
  position: [number, number];
  labelAt: "right" | "left" | "below";
};

// 두 정류장처럼 가까이 붙은 표시는 이름표만 옮김: 서쪽 것은 왼쪽, 동쪽 것은 아래
export const overviewMarkers: OverviewMarker[] = markerList.map((m) => {
  const position = project(entrance(m.id).local);
  const near = markerList
    .filter((other) => other.id !== m.id)
    .map((other) => project(entrance(other.id).local))
    .filter(
      ([x, y]) =>
        Math.abs(x - position[0]) < 40 && Math.abs(y - position[1]) < 12,
    );
  const labelAt = near.some(([x]) => x > position[0])
    ? "left"
    : near.length
      ? "below"
      : "right";
  return { id: m.id, label: m.label, kind: m.kind, position, labelAt };
});

export type OverviewLink = {
  id: string;
  status: LinkStatus;
  from: [number, number];
  to: [number, number];
};

const statusRank: Record<LinkStatus, number> = {
  확인: 0,
  "확인 필요": 1,
  추정: 2,
  삭제: 3,
};

// 지하주차장은 스콘스퀘어 아래라 광장 윤곽으로 이음
const area = (id: string) => (id === "지하주차장" ? "스콘스퀘어" : id);

// 층이 다른 연결도 개요도에서는 같은 두 건물 사이 선으로 표시함
export function overviewLinkPair(id: string): string | undefined {
  const link = campusLinks().find((link) => link.id === id);
  return link
    ? [area(link.from.building), area(link.to.building)].sort().join("|")
    : undefined;
}

export function overviewRouteHighlight(map: GuideMapData) {
  const marker = (node: string) =>
    node === PARKING ? "parking_entrance_1" : node;
  const here = currentPosition(map.nodes, map.current);
  return {
    // 안내 중 내 위치 점(지금 단계). 미리보기처럼 지금 단계가 없으면 undefined
    position: here ? project([here.east, here.north]) : undefined,
    segments: routeSegments(map.nodes).map(([a, b]) => [project([a.east, a.north]), project([b.east, b.north])]),
    areas: new Set(map.nodes.map((node) => area(nodeArea(node)))),
    currentArea: map.current.node
      ? area(nodeArea(map.current.node))
      : undefined,
    pairs: new Set(
      map.links.map(overviewLinkPair).filter((pair) => pair !== undefined),
    ),
    currentPair: map.current.link
      ? overviewLinkPair(map.current.link)
      : undefined,
    markers: new Set(map.nodes.map(marker)),
    currentMarker: map.current.node ? marker(map.current.node) : undefined,
  };
}

export type OverviewRouteHighlight = ReturnType<typeof overviewRouteHighlight>;
function outline(id: string) {
  if (id === "스콘스퀘어") return plaza.polygon!;
  return campusBuildings().find((b) => b.id === id)?.footprint.polygon;
}

function closestOnSegment(
  p: LocalPoint,
  a: LocalPoint,
  b: LocalPoint,
): LocalPoint {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
      )
    : 0;
  return [a[0] + dx * t, a[1] + dy * t];
}

// 두 윤곽에서 서로 가장 가까운 점 한 쌍
export function closestPoints(
  a: LocalPoint[],
  b: LocalPoint[],
): [LocalPoint, LocalPoint] {
  let best: [LocalPoint, LocalPoint] = [a[0], b[0]];
  let bestDistance = Infinity;
  const check = (from: LocalPoint[], to: LocalPoint[], swap: boolean) => {
    for (const p of from)
      for (let i = 0; i < to.length; i++) {
        const q = closestOnSegment(p, to[i], to[(i + 1) % to.length]);
        const distance = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = swap ? [q, p] : [p, q];
        }
      }
  };
  check(a, b, false);
  check(b, a, true);
  return best;
}

// 같은 두 곳을 잇는 연결이 여러 층에 있으면 가장 확실한 것 하나만 그림
const pairs = new Map<
  string,
  { id: string; status: LinkStatus; a: string; b: string }
>();
for (const link of campusLinks()) {
  const a = area(link.from.building);
  const b = area(link.to.building);
  const key = [a, b].sort().join("|");
  const current = pairs.get(key);
  if (!current || statusRank[link.status] < statusRank[current.status])
    pairs.set(key, { id: link.id, status: link.status, a, b });
}

const center = (id: string) =>
  id === "스콘스퀘어"
    ? plazaCenter
    : campusBuildings().find((b) => b.id === id)!.footprint.center;

// 붙어 있는 건물은 가장 가까운 점이 거의 같아서, 두 건물 중심 방향으로 최소 길이만큼 늘림
const MIN_LINK = 8;
export const overviewLinks: OverviewLink[] = [...pairs.values()].flatMap(
  (pair) => {
    const a = outline(pair.a);
    const b = outline(pair.b);
    if (!a || !b || a === b) return [];
    const [near, far] = closestPoints(a, b);
    let from = project(near);
    let to = project(far);
    if (Math.hypot(to[0] - from[0], to[1] - from[1]) < MIN_LINK) {
      const [ax, ay] = project(center(pair.a));
      const [bx, by] = project(center(pair.b));
      const length = Math.hypot(bx - ax, by - ay);
      const mx = (from[0] + to[0]) / 2;
      const my = (from[1] + to[1]) / 2;
      const ux = ((bx - ax) / length) * (MIN_LINK / 2);
      const uy = ((by - ay) / length) * (MIN_LINK / 2);
      from = [round(mx - ux), round(my - uy)];
      to = [round(mx + ux), round(my + uy)];
    }
    return [{ id: pair.id, status: pair.status, from, to }];
  },
);
