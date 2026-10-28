import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db/index.ts";

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
