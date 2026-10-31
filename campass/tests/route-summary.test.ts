import test from "node:test";
import assert from "node:assert/strict";
import { calculateRoute } from "../shared/utils/routing.ts";
import {
  displayedRouteOption,
  routeMode,
} from "../shared/utils/route-presentation.ts";
import {
  routeSummary,
  routeHeightText,
} from "../shared/utils/route-summary.ts";
import { routeCoordinate, routeSegments } from "../shared/utils/campus-map.ts";

test("2115 정류장 → 혜인관: 평지를 뺀 실외 경사 구간으로 약 13% 계산", () => {
  const option = calculateRoute("bus_stop_2115", "hyein", false).options.find(
    (o) => o.hillMode === "hill",
  )!;
  const summary = routeSummary(option);
  assert.equal(
    summary.startElevation,
    routeCoordinate(option.nodes[0])!.elevation,
  );
  assert.equal(
    summary.endElevation,
    routeCoordinate(option.nodes.at(-1)!)!.elevation,
  );
  assert.equal(summary.rise, summary.endElevation! - summary.startElevation!);
  assert.ok(summary.outdoorLength > 0);
  assert.equal(
    summary.grade,
    Math.round((Math.abs(summary.rise!) / summary.slopedOutdoorLength) * 1000) /
      10,
  );
  assert.ok(summary.slopedOutdoorLength < summary.outdoorLength);
  const expectedLength = routeSegments(option.nodes)
    .filter(([a, b]) => Math.abs(b.elevation - a.elevation) > 0.001)
    .reduce(
      (sum, [a, b]) => sum + Math.hypot(b.east - a.east, b.north - a.north),
      0,
    );
  assert.ok(Math.abs(summary.slopedOutdoorLength - expectedLength) < 0.001);
  assert.equal(summary.grade, 13.5);
  assert.equal(
    routeHeightText(option, summary),
    "오르막 22m · 평균 경사 13.5%",
  );
  assert.equal(summary.bars.length, 14);
  assert.equal(summary.bars[0].elevation, summary.startElevation);
  assert.equal(summary.bars.at(-1)!.elevation, summary.endElevation);
  assert.equal(summary.stairs, 0);
  assert.equal(summary.elevators, 0);
});

test("엘리베이터 이동은 연결 단계로 세고 수직 구간을 막대에 남김", () => {
  const option = calculateRoute("bus_stop_2115", "hyein", true).options[0];
  const summary = routeSummary(option);
  assert.equal(summary.elevators, 2);
  assert.equal(summary.stairs, 0);
  assert.ok(summary.bars.some((bar) => bar.kind === "elevator"));
  assert.ok(summary.buildings >= 2);
});

test("역방향은 음수 높이 차이, 실외 구간 없는 길은 경사 미표시", () => {
  const option = calculateRoute("bon|5", "bon|1", false).options[0];
  const summary = routeSummary(option);
  assert.ok(summary.rise! < 0);
  assert.equal(summary.grade, null);
  assert.equal(summary.stairs, 1);
  assert.equal(summary.elevators, 0);
});

test("높이 자료가 없으면 0m로 꾸미지 않고 자료 없음으로 처리", () => {
  const option = calculateRoute("bus_stop_2115", "hyein", false).options[0];
  const summary = routeSummary({
    ...option,
    nodes: ["unknown", "missing"],
    links: [],
  });
  assert.equal(summary.rise, null);
  assert.equal(summary.grade, null);
  assert.deepEqual(summary.bars, []);
});

test("언덕 지름길 요약은 미리보기 전체 경로와 같은 길이를 쓴다", () => {
  for (const [start, end] of [
    ["bon", "hyein"],
    ["hyein", "bon"],
    ["hyein", "yudam"],
  ]) {
    const option = calculateRoute(start, end, false).options.find(
      (o) => o.hillMode === "hill",
    )!;
    const length = routeSegments(option.nodes).reduce(
      (sum, [a, b]) =>
        sum +
        Math.hypot(
          b.east - a.east,
          b.north - a.north,
          b.elevation - a.elevation,
        ),
      0,
    );
    assert.ok(Math.abs(routeSummary(option).totalLength - length) < 0.001);
  }
});

test("엘리베이터 후보가 여러 개여도 선택한 유효 후보를 유지", () => {
  const options = calculateRoute("hyein", "bukak", true).options;
  assert.ok(options.length > 1);
  assert.equal(
    displayedRouteOption(options, options[1], true)?.id,
    options[1].id,
  );
});

test("엘리베이터를 끄면 실외·실내 후보로 복귀하고 켜면 엘리베이터만 선택", () => {
  const options = calculateRoute("bus_stop_2115", "hyein", false).options;
  const lift = options.find((o) => routeMode(o) === "elevator")!;
  assert.equal(routeMode(displayedRouteOption(options, lift, false)!), "hill");
  assert.equal(
    routeMode(displayedRouteOption(options, lift, false, "stairs")!),
    "stairs",
  );
  assert.equal(
    routeMode(displayedRouteOption(options, options[0], true)!),
    "elevator",
  );
});

test("계단길은 경사율 대신 계단으로 오르는 높이를 표시", () => {
  const option = calculateRoute("bus_stop_2115", "hyein", false).options.find(
    (o) => o.hillMode === "stairs",
  )!;
  const summary = routeSummary(option);
  assert.equal(summary.grade, null);
  assert.equal(routeHeightText(option, summary), "계단으로 22m 올라가요");
  assert.ok(!routeHeightText(option, summary).includes("%"));
});

test("엘리베이터와 실내 계단의 높이 변화를 실외 경사로 표시하지 않음", () => {
  const lift = calculateRoute("bus_stop_2115", "hyein", true).options[0];
  assert.equal(routeSummary(lift).grade, null);
  assert.equal(routeHeightText(lift), "엘리베이터로 22m 올라가요");
  const stairs = calculateRoute("bon|5", "bon|1", false).options[0];
  assert.match(routeHeightText(stairs), /^계단으로 \d+m 내려가요$/);
});
