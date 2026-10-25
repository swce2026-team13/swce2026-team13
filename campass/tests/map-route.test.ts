import test from "node:test";
import assert from "node:assert/strict";
import {
  selectRouteBuilding,
  buildingRoute,
} from "../shared/utils/map-route.ts";

test("building taps choose start then destination, ignore repeats and allow reset", () => {
  const first = selectRouteBuilding([], "본관");
  assert.deepEqual(first, ["본관"]);
  assert.deepEqual(selectRouteBuilding(first, "본관"), first);
  const pair = selectRouteBuilding(first, "혜인관");
  assert.deepEqual(pair, ["본관", "혜인관"]);
  assert.deepEqual(selectRouteBuilding(pair, "유담관"), ["유담관"]);
});

test("building routes use existing graph in both directions without inventing paths", () => {
  const route = buildingRoute(["본관", "혜인관"]);
  assert.equal(route.start, "main");
  assert.equal(route.destination, "hyein");
  assert.equal(route.route.steps.at(-1)?.id, "hyein");
  assert.equal(
    buildingRoute(["혜인관", "본관"]).route.steps.at(-1)?.id,
    "main",
  );
  assert.throws(() => buildingRoute(["본관", "유담관"]), /등록/);
  assert.throws(() => buildingRoute(["상승관", "혜인관"]), /등록/);
  assert.throws(() => buildingRoute(["본관", "본관"]), /다른/);
});
