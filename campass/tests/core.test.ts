import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("catalog finds official Hyein rooms and accepts the Figma spelling alias", async () => {
  const { searchPlaces } = await import("../lib/catalog.ts");
  assert.ok(searchPlaces("혜인관 301").some((p) => p.id === "hyein-301"));
  assert.ok(searchPlaces("헤인관 면접").some((p) => p.id === "interview"));
  assert.equal(searchPlaces("헤인관 면접")[0].id, "interview");
  assert.equal(searchPlaces("존재하지않는장소xyz").length, 0);
});

test("routing is connected, excludes stairs when requested, and rejects unknown/unreachable nodes", async () => {
  const { calculateRoute } = await import("../lib/routing.ts");
  const normal = calculateRoute("bus", "interview", false);
  const accessible = calculateRoute("bus", "interview", true);
  assert.equal(normal.steps.at(-1)?.id, "interview");
  assert.ok(accessible.steps.some((s) => s.id === "elevator"));
  assert.ok(!accessible.steps.some((s) => s.id === "stairs"));
  assert.equal(accessible.verified, false);
  assert.throws(() => calculateRoute("bus", "unknown", false));
  assert.throws(() => calculateRoute("bus", "bukak", false), /경로/);
});

test("sessions persist, reject other owners and stale progress, deduplicate confusion and feedback", async () => {
  const { Store } = await import("../lib/store.ts");
  const path = join(
    mkdtempSync(join(tmpdir(), "campass-test-")),
    "test.sqlite",
  );
  let store = new Store(path);
  let session = store.create("owner", "bus", "interview", true);
  assert.throws(() => store.get(session.id, "other"), /찾을/);
  assert.throws(() => store.advance(session.id, "owner", 4), /단계/);
  store.confusion(session.id, "owner");
  store.confusion(session.id, "owner");
  assert.equal(store.insights().confusions, 1);
  assert.throws(
    () => store.feedback(session.id, "owner", { confused: false }),
    /도착/,
  );
  while (session.status !== "completed")
    session = store.advance(session.id, "owner", session.version);
  const input = {
    confused: true,
    waypointId: "bus",
    reason: "방향 혼란",
    comment: "표지판이 필요해요",
  };
  store.feedback(session.id, "owner", input);
  store.feedback(session.id, "owner", input);
  assert.equal(store.insights().feedbacks, 1);
  assert.equal(store.insights().confusions, 1);
  store.close();
  store = new Store(path);
  assert.equal(store.get(session.id, "owner").status, "completed");
  assert.ok(store.insights().passages > 0);
  store.close();
});

test("recovery only accepts valid locations and does not erase observed history", async () => {
  const { Store } = await import("../lib/store.ts");
  const store = new Store(":memory:");
  const session = store.create("owner", "bus", "interview", true);
  assert.throws(() =>
    store.recover(session.id, "owner", "missing", session.version),
  );
  const recovered = store.recover(
    session.id,
    "owner",
    "parking-entry",
    session.version,
  );
  assert.equal(recovered.route.steps[0].id, "parking-entry");
  assert.equal(recovered.destination, "interview");
  assert.equal(store.insights().passages, 2);
  store.close();
});

test("unconfigured AI never fabricates predictions and invalid provider responses fail closed", async () => {
  const { recognizePhoto, validatePrediction } =
    await import("../lib/providers.ts");
  const result = await recognizePhoto(
    new Blob(["test"], { type: "image/jpeg" }),
    {},
  );
  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.candidates, []);
  assert.throws(() =>
    validatePrediction({
      candidates: [
        { waypointId: "missing", confidence: 0.9, direction: "forward" },
      ],
    }),
  );
  assert.throws(() =>
    validatePrediction({
      candidates: [{ waypointId: "bus", confidence: 92, direction: "forward" }],
    }),
  );
});

test("recovery orientation belongs to the confirmed location and is cleared on next step", async () => {
  const { Store } = await import("../lib/store.ts");
  const store = new Store(":memory:");
  const s = store.create("owner", "bus", "interview", true);
  const recovered = store.recover(
    s.id,
    "owner",
    "parking-entry",
    s.version,
    "backward",
  );
  assert.equal(recovered.recoveryDirection, "backward");
  assert.equal(store.get(s.id, "owner").recoveryDirection, "backward");
  const manual = store.recover(s.id, "owner", "main", recovered.version);
  assert.equal(manual.recoveryDirection, "unknown");
  assert.equal(
    store.advance(s.id, "owner", manual.version).recoveryDirection,
    "unknown",
  );
  store.close();
});

test("same-origin requests use public host instead of the Next internal hostname", async () => {
  const { assertRequestOrigin } = await import("../lib/server.ts");
  const request = new Request("http://localhost:3000/api/intent", {
    headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
  });
  assert.doesNotThrow(() => assertRequestOrigin(request));
  assert.throws(
    () => assertRequestOrigin(request, "https://campass.example"),
    /출처/,
  );
  assert.throws(
    () =>
      assertRequestOrigin(
        new Request("http://localhost:3000/api/intent", {
          headers: {
            host: "127.0.0.1:3000",
            origin: "https://attacker.example",
          },
        }),
      ),
    /출처/,
  );
});
