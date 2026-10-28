import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Store } from "../server/db/store.ts";

const migrationsDir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));

export async function applyMigrations(url: string) {
  const store = new Store(url);
  try {
    const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
    await store.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('campass_migrations'))");
      await client.query("CREATE SCHEMA IF NOT EXISTS campass_private");
      await client.query("REVOKE ALL ON SCHEMA campass_private FROM PUBLIC");
      await client.query(`CREATE TABLE IF NOT EXISTS campass_private.schema_migrations (
        name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query("REVOKE ALL ON campass_private.schema_migrations FROM PUBLIC");
      for (const file of files) {
        const sql = await readFile(join(migrationsDir, file), "utf8");
        const checksum = createHash("sha256").update(sql).digest("hex");
        const applied = await client.query<{ checksum: string }>(
          "SELECT checksum FROM campass_private.schema_migrations WHERE name=$1", [file],
        );
        if (applied.rows[0]) {
          if (applied.rows[0].checksum !== checksum)
            throw new Error(`Migration ${file} has changed since it was applied`);
          continue;
        }
        await client.query(sql);
        await client.query(
          "INSERT INTO campass_private.schema_migrations(name,checksum) VALUES ($1,$2)",
          [file, checksum],
        );
        console.log(`Applied migration: ${file}`);
      }
    });
  } finally {
    await store.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("Set MIGRATION_DATABASE_URL in .env.local before running migrations");
  await applyMigrations(url);
}
