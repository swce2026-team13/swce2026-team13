import { routeCoordinate, routeSegments, type CampusCoordinate } from "./campus-map.ts";

export type GuideRouteMotion = { from: number; to: number };

const distance = (a: CampusCoordinate, b: CampusCoordinate) =>
  Math.hypot(a.east - b.east, a.north - b.north, a.elevation - b.elevation);

/** 안내 단계의 두 지점을 실제 지도 경로선 위의 길이 비율로 옮긴다. */
export function guideRouteMotion(
  nodes: string[],
  currentNode?: string,
  nextNode?: string,
): GuideRouteMotion | undefined {
  const segments = routeSegments(nodes);
  if (!segments.length || !currentNode) return;
  const lengths = segments.map(([a, b]) => distance(a, b));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return;
  if (!nextNode) return { from: 1, to: 1 };

  const nearest = (node: string, after = 0) => {
    const coordinate = routeCoordinate(node);
    if (!coordinate) return after;
    let travelled = 0;
    let best = { gap: Infinity, progress: after };
    segments.forEach(([a, b], index) => {
      const length = lengths[index];
      const vector = {
        east: b.east - a.east,
        north: b.north - a.north,
        elevation: b.elevation - a.elevation,
      };
      const projection = length
        ? Math.max(0, Math.min(1, (
          (coordinate.east - a.east) * vector.east +
          (coordinate.north - a.north) * vector.north +
          (coordinate.elevation - a.elevation) * vector.elevation
        ) / (length * length)))
        : 0;
      const progress = (travelled + projection * length) / total;
      if (progress >= after - 0.001) {
        const onPath = {
          east: a.east + vector.east * projection,
          north: a.north + vector.north * projection,
          elevation: a.elevation + vector.elevation * projection,
        };
        const gap = distance(coordinate, onPath);
        if (gap < best.gap) best = { gap, progress };
      }
      travelled += length;
    });
    return best.progress;
  };

  const from = nearest(currentNode);
  let to = nearest(nextNode, from);
  // 같은 지도 좌표인 실내 지점은 다음 길을 임의로 앞당겨 보여 주지 않는다.
  if (to - from < 0.005) to = from;
  return { from, to };
}

/** 경로의 길이 비율에 맞춰 선을 자른다. 2D·3D가 같은 단계 구간을 사용한다. */
export function sliceRouteSegments(
  segments: [CampusCoordinate, CampusCoordinate][],
  from: number,
  to: number,
) {
  const lengths = segments.map(([a, b]) => distance(a, b));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let travelled = 0;
  return segments.flatMap(([a, b], index) => {
    const length = lengths[index];
    const start = Math.max(travelled, from * total);
    const end = Math.min(travelled + length, to * total);
    travelled += length;
    if (end <= start || !length) return [];
    const at = (offset: number): CampusCoordinate => {
      const t = (offset - (travelled - length)) / length;
      return {
        east: a.east + (b.east - a.east) * t,
        north: a.north + (b.north - a.north) * t,
        elevation: a.elevation + (b.elevation - a.elevation) * t,
      };
    };
    return [[at(start), at(end)] as [CampusCoordinate, CampusCoordinate]];
  });
}
