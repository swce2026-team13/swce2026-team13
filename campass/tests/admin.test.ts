import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/db/store.ts";
import * as server from "../server/services/request.ts";
import { testStore } from "./postgres-helper.ts";

const credentials = { id: "administrator", password: "test-password-12345" };

async function setup(t: TestContext) {
  const previous = { ADMIN_ID: process.env.ADMIN_ID, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD };
  Object.assign(process.env, { ADMIN_ID: credentials.id, ADMIN_PASSWORD: credentials.password });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  return testStore(t);
}

test("admin login creates independent sessions that survive reopening PostgreSQL", async (t) => {
  const fixture = await setup(t);
  if (!fixture) return;
  const db = fixture.store;
  const first = await server.loginAdmin(db, credentials, "client-a");
  const second = await server.loginAdmin(db, credentials, "client-a");
  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^[0-9a-f]{64}$/);
  const reopened = new Store(fixture.url);
  try {
    await server.requireAdmin(first.id, reopened);
    await server.requireAdmin(second.id, reopened);
  } finally {
    await reopened.close();
  }
});

test("admin sessions reject missing, unknown, expired and revoked cookies", async (t) => {
  const fixture = await setup(t);
  if (!fixture) return;
  const db = fixture.store;
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  for (const id of [undefined, "unknown"])
    await assert.rejects(server.requireAdmin(id, db), { status: 401 });
  const session = await server.loginAdmin(db, credentials, "client-a");
  now += 8 * 60 * 60 * 1000 - 1;
  await server.requireAdmin(session.id, db);
  now++;
  await assert.rejects(server.requireAdmin(session.id, db), { status: 401 });
  const other = await server.loginAdmin(db, credentials, "client-a");
  await db.deleteAdminSession(other.id);
  await assert.rejects(server.requireAdmin(other.id, db), { status: 401 });
});

test("wrong ID, wrong password and malformed credentials use the same error", async (t) => {
  const fixture = await setup(t);
  if (!fixture) return;
  const db = fixture.store;
  const errors = await Promise.all([
    { ...credentials, id: "wrong" },
    { ...credentials, password: "wrong" },
    { id: null, password: [] },
    { ...credentials, password: `${credentials.password} ` },
  ].map(async (input, index) => {
    try {
      await server.loginAdmin(db, input, `client-${index}`);
      assert.fail("invalid credentials were accepted");
    } catch (error) {
      assert.ok(error instanceof Error && "status" in error);
      assert.equal(error.status, 401);
      return error.message;
    }
  }));
  assert.equal(new Set(errors).size, 1);
});

test("fifth failure blocks only that address for ten minutes from the fifth failure", async (t) => {
  const fixture = await setup(t);
  if (!fixture) return;
  const db = fixture.store;
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  for (let i = 0; i < 4; i++)
    await assert.rejects(server.loginAdmin(db, {}, "client-a"), { status: 401 });
  now += 60_000;
  await assert.rejects(server.loginAdmin(db, {}, "client-a"), { status: 429 });
  await assert.rejects(server.loginAdmin(db, credentials, "client-a"), { status: 429 });
  await server.loginAdmin(db, credentials, "client-b");
  now += 600_000 - 1;
  await assert.rejects(server.loginAdmin(db, credentials, "client-a"), { status: 429 });
  now++;
  await server.loginAdmin(db, credentials, "client-a");
});

test("successful login resets failures and successful requests do not consume failures", async (t) => {
  const fixture = await setup(t);
  if (!fixture) return;
  const db = fixture.store;
  for (let cycle = 0; cycle < 6; cycle++) {
    for (let i = 0; i < 4; i++)
      await assert.rejects(server.loginAdmin(db, {}, "client-a"), { status: 401 });
    await server.loginAdmin(db, credentials, "client-a");
  }
});

test("admin login fails closed when credentials are missing or password is too short", async (t) => {
  const fixture = await setup(t);
  if (!fixture) return;
  const db = fixture.store;
  for (const password of ["", "short"]) {
    process.env.ADMIN_PASSWORD = password;
    await assert.rejects(server.loginAdmin(db, credentials, "client-a"), { status: 503 });
  }
  process.env.ADMIN_PASSWORD = credentials.password;
  process.env.ADMIN_ID = "";
  await assert.rejects(server.loginAdmin(db, credentials, "client-a"), { status: 503 });
});
