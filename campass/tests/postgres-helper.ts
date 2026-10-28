import { randomUUID } from "node:crypto";
import { Client } from "pg";
import type { TestContext } from "node:test";
import { Store } from "../server/db/store.ts";
import { applyMigrations } from "../scripts/migrate.ts";

export function testDatabaseAvailable() {
  return Boolean(process.env.TEST_DATABASE_URL);
}

export async function testStore(t: TestContext) {
  if (!testDatabaseAvailable()) {
    t.skip("Set TEST_DATABASE_URL to run PostgreSQL integration tests");
    return null;
  }
  const fixture = await createTestDatabase();
  t.after(async () => {
    await fixture.store.close();
    await fixture.cleanup();
  });
  return fixture;
}

export async function createTestDatabase() {
  const source = process.env.TEST_DATABASE_URL;
  if (!source) throw new Error("TEST_DATABASE_URL is required for PostgreSQL tests");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL)
    throw new Error("PostgreSQL tests cannot run in a production or Vercel environment");
  const base = new URL(source);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(base.hostname) ||
    base.pathname !== "/campass_test")
    throw new Error("TEST_DATABASE_URL must target a local campass_test database");
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === source)
    throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
  const name = `campass_test_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const testUrl = new URL(source);
  testUrl.pathname = `/${name}`;
  try {
    await applyMigrations(testUrl.toString());
  } catch (error) {
    await dropTestDatabase(source, name);
    throw error;
  }
  return {
    url: testUrl.toString(),
    store: new Store(testUrl.toString()),
    async cleanup() { await dropTestDatabase(source, name); },
  };
}

async function dropTestDatabase(source: string, name: string) {
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}
