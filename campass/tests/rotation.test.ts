import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createRotation } from "../shared/utils/rotation.ts";

function setup(count = 3) {
  mock.timers.enable({ apis: ["setTimeout"] });
  const seen: number[] = [];
  const rotation = createRotation(count, (index) => seen.push(index));
  return { rotation, seen };
}

test.afterEach(() => mock.timers.reset());

test("10초가 지나면 다음 행사로, 마지막 다음은 처음 행사", () => {
  const { rotation, seen } = setup(2);
  mock.timers.tick(9_999);
  assert.deepEqual(seen, []);
  mock.timers.tick(1);
  assert.equal(rotation.index, 1);
  mock.timers.tick(10_000);
  assert.equal(rotation.index, 0);
  assert.deepEqual(seen, [1, 0]);
  rotation.stop();
});

test("행사를 누르면 그 행사로 가고 10초를 다시 셈", () => {
  const { rotation, seen } = setup();
  mock.timers.tick(7_000);
  rotation.select(2);
  assert.equal(rotation.index, 2);
  mock.timers.tick(7_000);
  assert.equal(rotation.index, 2);
  mock.timers.tick(3_000);
  assert.equal(rotation.index, 0);
  assert.deepEqual(seen, [2, 0]);
  rotation.stop();
});

test("화면이 안 보이면 넘어가지 않고, 다시 보이면 처음부터 셈", () => {
  const { rotation } = setup();
  mock.timers.tick(5_000);
  rotation.hold("hidden", true);
  mock.timers.tick(60_000);
  assert.equal(rotation.index, 0);
  rotation.hold("hidden", false);
  mock.timers.tick(9_000);
  assert.equal(rotation.index, 0);
  mock.timers.tick(1_000);
  assert.equal(rotation.index, 1);
  rotation.stop();
});

test("행사가 하나뿐이면 넘기지 않고, 정리하면 타이머가 멈춤", () => {
  const single = setup(1);
  mock.timers.tick(30_000);
  assert.deepEqual(single.seen, []);
  single.rotation.stop();
  mock.timers.reset();

  const { rotation, seen } = setup();
  rotation.stop();
  mock.timers.tick(30_000);
  assert.deepEqual(seen, []);
});
