import { routeMode, routeEnvironment } from "./route-presentation.ts";
import type { RouteOption, Waypoint } from "./routing.ts";
import { campusMap, routeCoordinate, routeSegments } from "./campus-map.ts";
import { graphEdges, nodeArea } from "./campus3d/route.ts";

export type MovementKind = "walk" | "hill" | "stairs" | "indoor" | "elevator";

function movement(option: RouteOption, index: number): MovementKind {
  const from = option.nodes[index],
    to = option.nodes[index + 1];
  if (!from || !to) return "walk";
  const candidates = graphEdges.filter(
    (edge) =>
      ((edge.a === from && edge.b === to) ||
        (edge.b === from && edge.a === to)) &&
      (!option.links[index] ||
        edge.id === option.links[index] ||
        edge.kind === "stairs" ||
        edge.kind === "elevator"),
  );
  if (nodeArea(from) === nodeArea(to) && from.includes("|") && from !== to) {
    if (option.lifts.length === 1) return option.lifts[0];
    const instructions = option.steps
      .filter((step) => step.node === from)
      .map((step) => step.instruction)
      .join(" ");
    return instructions.includes("엘리베이터") ? "elevator" : "stairs";
  }
  const edge = candidates[0];
  if (edge?.hillMode === "stairs") return "stairs";
  if (edge?.hillMode === "hill") return "hill";
  if (
    edge?.kind === "start" ||
    edge?.approximate ||
    from === "스콘스퀘어" ||
    to === "스콘스퀘어"
  )
    return "walk";
  return "indoor";
}

export function routeStepKind(
  option: RouteOption,
  step: Waypoint,
): MovementKind {
  const index = step.link
    ? option.links.indexOf(step.link)
    : option.nodes.indexOf(step.node ?? "");
  return index < 0 ? "walk" : movement(option, index);
}

export function routeSummary(option: RouteOption) {
  const first = routeCoordinate(option.nodes[0] ?? "");
  const last = routeCoordinate(option.nodes.at(-1) ?? "");
  const rise = first && last ? last.elevation - first.elevation : null;
  const kinds = option.nodes.slice(1).map((_, i) => movement(option, i));
  const hopSegments = option.nodes.slice(1).flatMap((node, i) => {
    const kind = kinds[i];
    const edge = graphEdges.find((edge) => edge.id === option.links[i]);
    const outdoor =
      kind === "hill" || kind === "walk" || edge?.hillMode === "stairs";
    return routeSegments([option.nodes[i], node]).map(([a, b]) => {
      const horizontal = Math.hypot(b.east - a.east, b.north - a.north);
      return {
        a,
        b,
        kind,
        outdoor,
        horizontal,
        length: Math.hypot(horizontal, b.elevation - a.elevation),
      };
    });
  });
  // 지도에서 생략한 중심 왕복·언덕 우회도 요약에서 똑같이 생략한다.
  const samePoint = (
    a: { east: number; north: number; elevation: number },
    b: typeof a,
  ) =>
    Math.hypot(a.east - b.east, a.north - b.north, a.elevation - b.elevation) <
    0.001;
  const segments = routeSegments(option.nodes).map(([a, b]) => {
    const hop = hopSegments.find((s) => samePoint(s.a, a) && samePoint(s.b, b));
    const horizontal = Math.hypot(b.east - a.east, b.north - a.north);
    return {
      a,
      b,
      horizontal,
      length: Math.hypot(horizontal, b.elevation - a.elevation),
      kind: hop?.kind ?? (option.hillMode === "hill" ? "hill" : "walk"),
      outdoor: hop?.outdoor ?? true,
    };
  });
  // 표시용 수평 실외 길이. 경로 비용/순위나 안내 세션에는 사용하지 않는다.
  const outdoorLength = segments
    .filter((s) => s.outdoor)
    .reduce((sum, s) => sum + s.horizontal, 0);
  // 광장 등 평지는 분모에서 제외한다. 계단·실내·엘리베이터 높이는 경사율로 표현하지 않는다.
  const slopedOutdoorLength = segments
    .filter(
      (s) =>
        s.outdoor &&
        s.kind !== "stairs" &&
        s.kind !== "elevator" &&
        Math.abs(s.b.elevation - s.a.elevation) > 0.001,
    )
    .reduce((sum, s) => sum + s.horizontal, 0);
  const indoorElevationChange = segments.some(
    (s) => !s.outdoor && Math.abs(s.b.elevation - s.a.elevation) > 0.001,
  );
  const grade =
    rise !== null &&
    slopedOutdoorLength > 0.01 &&
    !indoorElevationChange &&
    !kinds.includes("stairs") &&
    !kinds.includes("elevator")
      ? Math.round((Math.abs(rise) / slopedOutdoorLength) * 1000) / 10
      : null;
  const countRuns = (kind: MovementKind) =>
    kinds.filter(
      (value, i) =>
        value === kind &&
        (i === 0 ||
          kinds[i - 1] !== kind ||
          nodeArea(option.nodes[i - 1]) !== nodeArea(option.nodes[i])),
    ).length;
  const total = segments.reduce((sum, s) => sum + s.length, 0);
  const bars =
    first && last && segments.length
      ? Array.from({ length: 14 }, (_, i) => {
          let remaining = (total * i) / 13;
          let segment = segments.at(-1)!;
          for (const candidate of segments) {
            segment = candidate;
            if (remaining <= candidate.length) break;
            remaining -= candidate.length;
          }
          const ratio = segment.length
            ? Math.min(1, remaining / segment.length)
            : 0;
          const elevation =
            i === 0
              ? first.elevation
              : i === 13
                ? last.elevation
                : segment.a.elevation +
                  (segment.b.elevation - segment.a.elevation) * ratio;
          const steep =
            segment.horizontal > 0
              ? Math.abs(segment.b.elevation - segment.a.elevation) /
                  segment.horizontal >
                0.08
              : segment.a.elevation !== segment.b.elevation;
          return {
            elevation,
            kind:
              segment.kind === "elevator"
                ? ("elevator" as const)
                : steep
                  ? ("steep" as const)
                  : ("flat" as const),
          };
        })
      : [];
  const destinationArea = nodeArea(option.nodes.at(-1) ?? "");
  const buildings = new Set(
    option.nodes
      .map(nodeArea)
      .filter(
        (area) =>
          area !== destinationArea &&
          campusMap.buildings.some((b) => b.id === area),
      ),
  ).size;
  return {
    totalLength: total,
    startElevation: first?.elevation ?? null,
    endElevation: last?.elevation ?? null,
    rise,
    outdoorLength,
    slopedOutdoorLength,
    indoorElevationChange,
    grade,
    bars,
    stairs: countRuns("stairs"),
    elevators: countRuns("elevator"),
    buildings,
    indoorMostly:
      segments.filter((s) => !s.outdoor).reduce((sum, s) => sum + s.length, 0) >
      total / 2,
  };
}

export function routeHeightText(
  option: RouteOption,
  summary = routeSummary(option),
) {
  if (summary.rise === null) return "높이 정보가 없어요";
  const height = Math.round(Math.abs(summary.rise));
  if (height === 0) return "같은 높이로 이동해요";
  const direction = summary.rise < 0 ? "내려가요" : "올라가요";
  if (routeMode(option) === "elevator")
    return `엘리베이터로 ${height}m ${direction}`;
  if (summary.stairs > 0 || option.hillMode === "stairs")
    return `계단으로 ${height}m ${direction}`;
  if (summary.indoorElevationChange) return `실내에서 ${height}m ${direction}`;
  return `${summary.rise < 0 ? "내리막" : "오르막"} ${height}m${summary.grade !== null ? ` · 평균 경사 ${summary.grade}%` : ""}`;
}

export function routeChips(
  option: RouteOption,
  summary = routeSummary(option),
): string[] {
  const environment = routeEnvironment(option);
  return [
    summary.grade !== null && summary.grade > 8 ? "경사 있음" : "",
    environment === "elevator"
      ? "엘리베이터"
      : environment === "outdoor"
        ? "실외 길"
        : "실내 위주",
    summary.stairs === 0 && option.stepFree !== null ? "계단 없음" : "",
    option.unverified || option.approximate ? "현장 확인 전" : "",
  ].filter(Boolean);
}
