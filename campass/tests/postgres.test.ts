import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/db/store.ts";
import { testStore } from "./postgres-helper.ts";

test("concurrent navigation updates serialize and reject a stale version", async (t) => {
  const secondary: Store[] = [];
  t.after(async () => { await Promise.all(secondary.map((store) => store.close())); });
  const fixture = await testStore(t);
  if (!fixture) return;
  const other = new Store(fixture.url);
  secondary.push(other);
  const session = await fixture.store.create("owner", "bus_stop_2115", "interview", true);
  const results = await Promise.allSettled([
    fixture.store.advance(session.id, "owner", session.version),
    other.advance(session.id, "owner", session.version),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected?.reason.code, "STALE_VERSION");
  assert.equal((await fixture.store.get(session.id, "owner")).version, session.version + 1);
  await assert.rejects(other.previous(session.id, "intruder", session.version + 1), { status: 404 });
});

test("concurrent feedback saves once and preserves one confusion record", async (t) => {
  const secondary: Store[] = [];
  t.after(async () => { await Promise.all(secondary.map((store) => store.close())); });
  const fixture = await testStore(t);
  if (!fixture) return;
  const other = new Store(fixture.url);
  secondary.push(other);
  let session = await fixture.store.create("owner", "bus_stop_2115", "interview", true);
  while (session.status !== "completed")
    session = await fixture.store.advance(session.id, "owner", session.version);
  const input = { confused: true, waypointId: session.visited[0], reason: "방향 혼란" };
  const results = await Promise.all([
    fixture.store.feedback(session.id, "owner", input),
    other.feedback(session.id, "owner", input),
  ]);
  assert.deepEqual(results.map((result) => result.duplicate).sort(), [false, true]);
  const rows = await fixture.store.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM feedback WHERE session_id=$1", [session.id],
  );
  assert.equal(rows[0].count, "1");
  assert.equal((await fixture.store.insights()).confusions, 1);
});

test("rate limiting is atomic across independent server instances", async (t) => {
  const secondary: Store[] = [];
  t.after(async () => { await Promise.all(secondary.map((store) => store.close())); });
  const fixture = await testStore(t);
  if (!fixture) return;
  const other = new Store(fixture.url);
  secondary.push(other);
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) =>
    (index % 2 ? other : fixture.store).limit("shared-client", 5, 60_000)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 5);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("transaction rolls back all writes and migration enforces foreign keys and RLS", async (t) => {
  const fixture = await testStore(t);
  if (!fixture) return;
  const { store } = fixture;
  await assert.rejects(store.transaction(async (client) => {
    await client.query("INSERT INTO sessions(id,owner,data) VALUES ('rollback','owner','{}')");
    throw new Error("abort");
  }), /abort/);
  assert.equal((await store.query("SELECT 1 FROM sessions WHERE id='rollback'")).length, 0);
  await assert.rejects(store.query(
    "INSERT INTO passages(session_id,waypoint_id) VALUES ('missing','point')",
  ), { code: "23503" });
  const rls = await store.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM pg_class
       WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[]) AND relrowsecurity`,
    [["sessions", "passages", "confusions", "feedback", "recognition_feedback", "rate_limits", "admin_sessions"]],
  );
  assert.equal(rls[0].count, "7");
});
