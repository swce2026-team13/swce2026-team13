import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db/index.ts";
import { Store } from "../server/db/store.ts";

test("server store refuses to start without DATABASE_URL", () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.throws(() => database(), /DATABASE_URL/);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("remote PostgreSQL uses a configured CA without disabling server verification", async () => {
  const previous = process.env.DATABASE_CA_CERT;
  process.env.DATABASE_CA_CERT = "test-ca\\nnext-line";
  try {
    const store = new Store("postgresql://example@pooler.supabase.com:6543/postgres");
    try {
      assert.deepEqual(store.pool.options.ssl, {
        rejectUnauthorized: true,
        ca: "test-ca\nnext-line",
      });
    } finally {
      await store.close();
    }
  } finally {
    if (previous === undefined) delete process.env.DATABASE_CA_CERT;
    else process.env.DATABASE_CA_CERT = previous;
  }
});

test("remote PostgreSQL rejects URL SSL parameters that override verified TLS", () => {
  assert.throws(
    () => new Store("postgresql://example@pooler.supabase.com:6543/postgres?sslmode=disable"),
    /SSL parameters/,
  );
});
