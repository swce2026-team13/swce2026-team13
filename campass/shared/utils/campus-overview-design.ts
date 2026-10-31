import { HILL_ROAD, HILL_STOPS } from "./campus-map.ts";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  project,
  overviewBuildings,
} from "./campus-overview.ts";
import {
  campusBuildings,
  campusEntrances,
  campusExtraNodes,
  type LocalPoint,
} from "./campus3d/types.ts";

type Point = LocalPoint;
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pxPerMeter = distance(project([0, 0]), project([1, 0]));
const polygons = campusBuildings().map((b) => b.footprint.polygon.map(project));
const plaza = campusExtraNodes().find((n) => n.kind === "plaza")!;
const plazaPolygon = plaza.polygon!.map(project);
const entranceIds = [
  "gate_west",
  "bus_stop_2115",
  "parking_entrance_2",
  "parking_entrance_1",
  "gate_main",
];
const entrances = entranceIds.map((id) =>
  project(campusEntrances().find((e) => e.id === id)!.local),
);

function hull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length > 1 && cross(out.at(-2)!, out.at(-1)!, p) <= 0)
        out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.toReversed())];
}

// 볼록 껍질에 반지름 17m 원을 더해 둥근 모서리의 땅을 만든다.
const land = hull(
  hull([...polygons.flat(), ...plazaPolygon]).flatMap(([x, y]) =>
    Array.from({ length: 32 }, (_, i): Point => [
      x + Math.cos((i * Math.PI) / 16) * 17 * pxPerMeter,
      y + Math.sin((i * Math.PI) / 16) * 17 * pxPerMeter,
    ]),
  ),
);

export function roundedOutline(points: Point[], radius = 1.8): string {
  const p = points.filter((v, i) => !i || distance(v, points[i - 1]) > 0.01);
  if (distance(p[0], p.at(-1)!) < 0.01) p.pop();
  const corners = p.map((at, i) => {
    const prev = p[(i + p.length - 1) % p.length],
      next = p[(i + 1) % p.length];
    const r = Math.min(radius, distance(prev, at) / 3, distance(next, at) / 3);
    const toward = (other: Point): Point => [
      at[0] + ((other[0] - at[0]) * r) / distance(other, at),
      at[1] + ((other[1] - at[1]) * r) / distance(other, at),
    ];
    return { at, in: toward(prev), out: toward(next) };
  });
  return (
    `M${corners[0].in.join(",")} ` +
    corners
      .map((c) => `L${c.in.join(",")} Q${c.at.join(",")} ${c.out.join(",")}`)
      .join(" ") +
    " Z"
  );
}
export const landPath = roundedOutline(land, 2);
export const buildingPaths = polygons.map((p) => roundedOutline(p));
export const plazaPath = roundedOutline(plazaPolygon);

const extent = [...land, ...entrances];
const minX = Math.min(...extent.map(([x]) => x)) - 28;
const maxX = Math.max(...extent.map(([x]) => x)) + 28;
const minY = Math.min(...extent.map(([, y]) => y)) - 20;
const maxY = Math.max(...extent.map(([, y]) => y)) + 20;
const frameWidth = Math.max(
  maxX - minX,
  ((maxY - minY) * MAP_WIDTH) / MAP_HEIGHT,
);
export const overviewFrame = {
  cx: (minX + maxX) / 2,
  cy: (minY + maxY) / 2,
  width: frameWidth,
  height: (frameWidth * MAP_HEIGHT) / MAP_WIDTH,
};

const hill = [entrances[1], ...HILL_ROAD.map(project)];
const branches = HILL_STOPS.map((stop) => [
  project(HILL_ROAD[stop.from]),
  project(stop.xy),
]);
// 장식용 입구 길. 실제 연결 여부나 경로 그래프는 변경하지 않는다.
const entranceRoads = entrances.map((p) => [
  p,
  polygons
    .flat()
    .reduce((best, q) => (distance(p, q) < distance(p, best) ? q : best)),
]);
export const overviewRoads = [hill, ...branches, ...entranceRoads].map(
  (points, i) => ({
    points,
    hill: i <= branches.length,
    path: points.map((p, j) => `${j ? "L" : "M"}${p.join(",")}`).join(" "),
  }),
);
const hillA = hill[1],
  hillB = hill[2];
export const hillLabel = {
  x: (hillA[0] + hillB[0]) / 2,
  y: (hillA[1] + hillB[1]) / 2 - 8,
  angle: (Math.atan2(hillB[1] - hillA[1], hillB[0] - hillA[0]) * 180) / Math.PI,
};

function inside(p: Point, polygon: Point[]): boolean {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return distance(p, [a[0] + dx * t, a[1] + dy * t]);
}
const edgeDistance = (p: Point, polygon: Point[]) =>
  Math.min(
    ...polygon.map((a, i) =>
      segmentDistance(p, a, polygon[(i + 1) % polygon.length]),
    ),
  );

const courtAngle = -38;
const radians = (courtAngle * Math.PI) / 180;
const rotate = ([x, y]: Point): Point => [
  x * Math.cos(radians) - y * Math.sin(radians),
  x * Math.sin(radians) + y * Math.cos(radians),
];
const plazaCenter = project(plaza.approxLocal!);
function overlaps(a: Point[], b: Point[], gap = 3) {
  return ![a, b].some((polygon) =>
    polygon.some((p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      const length = distance(p, q);
      if (!length) return false;
      const axis: Point = [(q[1] - p[1]) / length, (p[0] - q[0]) / length];
      const projectAxis = (v: Point) => v[0] * axis[0] + v[1] * axis[1];
      const aa = a.map(projectAxis),
        bb = b.map(projectAxis);
      return (
        Math.max(...aa) + gap < Math.min(...bb) ||
        Math.max(...bb) + gap < Math.min(...aa)
      );
    }),
  );
}
const labelHalfWidth = (33 * overviewFrame.width) / 320;
const labelHalfHeight = (10 * overviewFrame.width) / 320;
const labelBox = (x: number, y: number): Point[] => [
  [x - labelHalfWidth, y - labelHalfHeight],
  [x + labelHalfWidth, y - labelHalfHeight],
  [x + labelHalfWidth, y + labelHalfHeight],
  [x - labelHalfWidth, y + labelHalfHeight],
];
const labelCandidates: Point[] = [];
for (let y = plazaCenter[1] - 65; y < plazaCenter[1] + 65; y += 2)
  for (let x = plazaCenter[0] - 50; x < plazaCenter[0] + 50; x += 2)
    if (
      labelBox(x, y).every(
        (p) => inside(p, plazaPolygon) && edgeDistance(p, plazaPolygon) > 2,
      )
    )
      labelCandidates.push([x, y]);
export const plazaLabel =
  labelCandidates.sort(
    (a, b) => distance(a, plazaCenter) - distance(b, plazaCenter),
  )[0] ?? plazaCenter;
const reservedLabel = labelBox(...plazaLabel);

// links.json 스콘스퀘어 note/approxLocalNote의 풋살·농구 코트가 근거.
// 크기는 실제 미터 축척이지만 코트 위치와 선은 대략적인 그림이며 측량 좌표가 아니다.
export const overviewCourts: {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  color: string;
  polygon: Point[];
}[] = [];
for (const [index, [length, breadth, color]] of (
  [
    [38, 20, "#a9d29a"],
    [26, 15, "#d8c6a6"],
  ] as const
).entries()) {
  const width = length * pxPerMeter,
    height = breadth * pxPerMeter;
  const desired: Point = [plazaCenter[0], plazaCenter[1] + (index ? 45 : -35)];
  const candidates: {
    x: number;
    y: number;
    polygon: Point[];
    score: number;
  }[] = [];
  for (let y = plazaCenter[1] - 65; y <= plazaCenter[1] + 65; y += 2)
    for (let x = plazaCenter[0] - 65; x <= plazaCenter[0] + 65; x += 2) {
      const polygon = (
        [
          [-width / 2, -height / 2],
          [width / 2, -height / 2],
          [width / 2, height / 2],
          [-width / 2, height / 2],
        ] as Point[]
      )
        .map(rotate)
        .map(([a, b]): Point => [a + x, b + y]);
      const samples = polygon.flatMap((p, i) => [
        p,
        [
          (p[0] + polygon[(i + 1) % 4][0]) / 2,
          (p[1] + polygon[(i + 1) % 4][1]) / 2,
        ] as Point,
      ]);
      if (
        !samples.every(
          (p) => inside(p, plazaPolygon) && edgeDistance(p, plazaPolygon) > 2,
        )
      )
        continue;
      if (
        overlaps(polygon, reservedLabel) ||
        overviewCourts.some((c) => overlaps(polygon, c.polygon, 5))
      )
        continue;
      candidates.push({ x, y, polygon, score: distance([x, y], desired) });
    }
  const best = candidates.sort((a, b) => a.score - b.score)[0];
  if (best)
    overviewCourts.push({ ...best, width, height, angle: courtAngle, color });
}

export const buildingLabelPositions = overviewBuildings.map((b, i): Point => {
  if (b.id !== "yudam") return b.center;
  const lowest = Math.max(...polygons[i].map(([, y]) => y));
  return [b.center[0], Math.min(lowest - 12, b.center[1] + 18)];
});
