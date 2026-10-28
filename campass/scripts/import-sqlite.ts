import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Store } from "../server/db/store.ts";
import { applyMigrations } from "./migrate.ts";

const tables = [
  "sessions", "passages", "confusions", "feedback",
  "recognition_feedback", "rate_limits", "admin_sessions",
] as const;

function timestamp(value: string) {
  return /[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
}

const sourcePath = process.env.SQLITE_SOURCE_PATH;
if (!sourcePath || !existsSync(resolve(sourcePath)))
  throw new Error("Set SQLITE_SOURCE_PATH to the preserved SQLite file");
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
const apply = process.argv.includes("--apply");
try {
  source.exec("BEGIN");
  const records = Object.fromEntries(tables.map((table) => [
    table, source.prepare(`SELECT * FROM ${table}`).all(),
  ])) as Record<(typeof tables)[number], Record<string, unknown>[]>;
  const counts = Object.fromEntries(tables.map((table) => [table, records[table].length]));
  console.log("SQLite source counts:", counts);
  if (!apply) {
    console.log("Dry run only. Set MIGRATION_DATABASE_URL and pass --apply to import into an empty migrated database.");
  } else {
    const url = process.env.MIGRATION_DATABASE_URL;
    if (!url) throw new Error("Set MIGRATION_DATABASE_URL before --apply");
    await applyMigrations(url);
    const store = new Store(url);
    try {
      await store.transaction(async (client) => {
        for (const table of tables) {
          const result = await client.query(`SELECT count(*)::int AS count FROM public.${table}`);
          if (result.rows[0].count !== 0)
            throw new Error(`Target table ${table} is not empty; import cancelled`);
        }
        for (const row of records.sessions)
          await client.query(
            "INSERT INTO sessions(id,owner,data,created_at) VALUES ($1,$2,$3::jsonb,$4)",
            [row.id, row.owner, row.data, timestamp(String(row.created_at))],
          );
        for (const row of records.passages)
          await client.query(
            "INSERT INTO passages(session_id,waypoint_id,created_at) VALUES ($1,$2,$3)",
            [row.session_id, row.waypoint_id, timestamp(String(row.created_at))],
          );
        for (const row of records.confusions)
          await client.query(
            "INSERT INTO confusions(session_id,waypoint_id,reason,created_at) VALUES ($1,$2,$3,$4)",
            [row.session_id, row.waypoint_id, row.reason, timestamp(String(row.created_at))],
          );
        for (const row of records.feedback)
          await client.query(
            "INSERT INTO feedback(session_id,data,created_at) VALUES ($1,$2::jsonb,$3)",
            [row.session_id, row.data, timestamp(String(row.created_at))],
          );
        for (const row of records.recognition_feedback)
          await client.query(
            "INSERT INTO recognition_feedback(id,data,created_at) VALUES ($1,$2::jsonb,$3)",
            [row.id, row.data, timestamp(String(row.created_at))],
          );
        await client.query(`SELECT setval(pg_get_serial_sequence('public.recognition_feedback','id'),
          GREATEST(COALESCE(MAX(id),1),1), MAX(id) IS NOT NULL) FROM public.recognition_feedback`);
        for (const row of records.rate_limits)
          await client.query(
            "INSERT INTO rate_limits(key,hits,expires) VALUES ($1,$2,$3)",
            [row.key, row.hits, row.expires],
          );
        for (const row of records.admin_sessions)
          await client.query(
            "INSERT INTO admin_sessions(id,expires) VALUES ($1,$2)",
            [row.id, row.expires],
          );
        for (const table of tables) {
          const result = await client.query(`SELECT count(*)::int AS count FROM public.${table}`);
          if (result.rows[0].count !== records[table].length)
            throw new Error(`Count mismatch in ${table}; import rolled back`);
        }
      });
      console.log("Import committed; all seven table counts match the SQLite snapshot.");
    } finally {
      await store.close();
    }
  }
  source.exec("COMMIT");
} catch (error) {
  source.exec("ROLLBACK");
  throw error;
} finally {
  source.close();
}
