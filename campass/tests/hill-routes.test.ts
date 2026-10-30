import test from "node:test";
import assert from "node:assert/strict";
import { calculateRoute } from "../shared/utils/routing.ts";

test("hill crossings offer three distinct travel methods", () => {
  for (const [start, destination] of [
    ["bus_stop_2115", "interview"],
    ["bon", "hallim"],
    ["hyein", "bon|1"],
    ["hyein", "bon"],
    ["bus_stop_2115", "eunju1"],
  ]) {
    const route = calculateRoute(start, destination, false);
    assert.deepEqual(
      route.options.map((o) => o.hillMode),
      ["hill", "stairs", "elevator"],
    );
    assert.equal(new Set(route.options.map((o) => o.id)).size, 3);
    const [hill, stairs, lift] = route.options;
    assert.ok(hill.links.includes("hill-bus-plaza"));
    assert.ok(stairs.links.includes("stairs-bus-hallim"));
    assert.ok(!stairs.lifts.includes("elevator"));
    assert.ok(lift.nodes.includes("bon|1"));
    assert.ok(lift.lifts.includes("elevator"));
    assert.ok(!lift.lifts.includes("stairs"));
    for (const option of route.options) {
      assert.equal(new Set(option.nodes).size, option.nodes.length);
      assert.equal(
        calculateRoute(start, destination, false, undefined, {
          option: option.id,
        }).option,
        option.id,
      );
    }
  }
});

test("step-free and same-level routes retain their constraints", () => {
  assert.ok(
    calculateRoute("bus_stop_2115", "interview", true).options.every(
      (o) => o.stepFree !== false,
    ),
  );
  assert.ok(
    calculateRoute("hallim|6", "eunju1|5", false).options.every(
      (o) => !o.hillMode,
    ),
  );
});

test("언덕길로 문예관·북악관에 갈 때는 정류장·본관을 거치지 않고 언덕과 같은 높이 층으로 들어간다", () => {
  for (const [destination, entry] of [
    ["munye", "munye|2"],
    ["bukak", "bukak|1"],
  ]) {
    const hill = calculateRoute("hyein", destination, false).options.find(
      (o) => o.hillMode === "hill",
    )!;
    assert.ok(hill.links.includes(`hill-plaza-${destination}`));
    assert.ok(!hill.nodes.includes("bus_stop_2115"));
    assert.ok(!hill.nodes.some((n) => n.startsWith("bon|")));
    assert.ok(hill.nodes.includes(entry));
  }
});
