import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/db/store.ts";
import * as server from "../server/services/request.ts";

const credentials = { id: "administrator", password: "test-password-12345" };
function setup(t: TestContext, path = ":memory:") {
  const previous = {
    ADMIN_ID: process.env.ADMIN_ID,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  };
  Object.assign(process.env, {
    ADMIN_ID: credentials.id,
    ADMIN_PASSWORD: credentials.password,
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const db = new Store(path);
  t.after(() => db.close());
  return db;
}

test("admin login creates independent sessions that survive reopening SQLite", (t) => {
  const path = join(
    mkdtempSync(join(tmpdir(), "campass-admin-")),
    "test.sqlite",
  );
  const db = setup(t, path);
  const first = server.loginAdmin(db, credentials, "client-a");
  const second = server.loginAdmin(db, credentials, "client-a");
  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^[0-9a-f]{64}$/);
  const reopened = new Store(path);
  try {
    assert.doesNotThrow(() => server.requireAdmin(first.id, reopened));
    assert.doesNotThrow(() => server.requireAdmin(second.id, reopened));
  } finally {
    reopened.close();
  }
});

test("admin sessions reject missing, unknown, expired and revoked cookies", (t) => {
  const db = setup(t);
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  for (const id of [undefined, "unknown"])
    assert.throws(() => server.requireAdmin(id, db), { status: 401 });
  const session = server.loginAdmin(db, credentials, "client-a");
  now += 8 * 60 * 60 * 1000 - 1;
  assert.doesNotThrow(() => server.requireAdmin(session.id, db));
  now++;
  assert.throws(() => server.requireAdmin(session.id, db), { status: 401 });
  const other = server.loginAdmin(db, credentials, "client-a");
  db.deleteAdminSession(other.id);
  assert.throws(() => server.requireAdmin(other.id, db), { status: 401 });
});

test("wrong ID, wrong password and malformed credentials use the same error", (t) => {
  const db = setup(t);
  const errors = [
    { ...credentials, id: "wrong" },
    { ...credentials, password: "wrong" },
    { id: null, password: [] },
    { ...credentials, password: `${credentials.password} ` },
  ].map((input, i) => {
    try {
      server.loginAdmin(db, input, `client-${i}`);
      assert.fail("invalid credentials were accepted");
    } catch (error) {
      assert.ok(error instanceof Error && "status" in error);
      assert.equal(error.status, 401);
      return error.message;
    }
  });
  assert.equal(new Set(errors).size, 1);
});

test("fifth failure blocks only that address for ten minutes from the fifth failure", (t) => {
  const db = setup(t);
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  for (let i = 0; i < 4; i++)
    assert.throws(() => server.loginAdmin(db, {}, "client-a"), { status: 401 });
  now += 60_000;
  assert.throws(() => server.loginAdmin(db, {}, "client-a"), { status: 429 });
  assert.throws(() => server.loginAdmin(db, credentials, "client-a"), {
    status: 429,
  });
  assert.doesNotThrow(() => server.loginAdmin(db, credentials, "client-b"));
  now += 600_000 - 1;
  assert.throws(() => server.loginAdmin(db, credentials, "client-a"), {
    status: 429,
  });
  now++;
  assert.doesNotThrow(() => server.loginAdmin(db, credentials, "client-a"));
});

test("successful login resets failures and successful requests do not consume failures", (t) => {
  const db = setup(t);
  for (let cycle = 0; cycle < 6; cycle++) {
    for (let i = 0; i < 4; i++)
      assert.throws(() => server.loginAdmin(db, {}, "client-a"), {
        status: 401,
      });
    assert.doesNotThrow(() => server.loginAdmin(db, credentials, "client-a"));
  }
});

test("admin login fails closed when credentials are missing or password is too short", (t) => {
  const db = setup(t);
  for (const password of ["", "short"]) {
    process.env.ADMIN_PASSWORD = password;
    assert.throws(() => server.loginAdmin(db, credentials, "client-a"), {
      status: 503,
    });
  }
  process.env.ADMIN_PASSWORD = credentials.password;
  process.env.ADMIN_ID = "";
  assert.throws(() => server.loginAdmin(db, credentials, "client-a"), {
    status: 503,
  });
});
