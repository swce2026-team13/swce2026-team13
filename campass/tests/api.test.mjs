import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
let server,
  origin,
  cookie,
  output = "";
const admin = randomUUID() + randomUUID();
before(async () => {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    {
      env: {
        ...process.env,
        DATABASE_PATH: join(
          mkdtempSync(join(tmpdir(), "campass-api-")),
          "test.sqlite",
        ),
        ADMIN_TOKEN: admin,
        APP_ORIGIN: origin,
        VISION_API_URL: "",
        INTENT_API_URL: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout.on("data", (d) => (output += d));
  server.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${origin}/api/health`);
      if (r.ok) {
        cookie = r.headers.get("set-cookie").split(";")[0];
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start: ${output}`);
});
after(() => server?.kill());
async function request(path, body, options = {}) {
  return fetch(`${origin}/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: options.cookie ?? cookie,
      Origin: options.origin ?? origin,
      ...(body === undefined || body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
}
test("HTTP catalog and intent expose sources and honest keyword mode", async () => {
  const catalog = await (await request("catalog")).json();
  assert.equal(catalog.campus.name, "서경대학교");
  assert.equal(catalog.visionEnabled, false);
  const intent = await (
    await request("intent", { query: "헤인관 면접" })
  ).json();
  assert.equal(intent.mode, "keyword");
  assert.equal(intent.places[0].id, "interview");
  assert.equal((await request("intent", { query: { bad: true } })).status, 400);
});
test("HTTP enforces origin, route availability, and typed inputs", async () => {
  assert.equal(
    (
      await request(
        "sessions",
        { start: "bus", destination: "interview", elevator: true },
        { origin: "https://untrusted.invalid" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("routes", {
        start: "bus",
        destination: "bukak",
        elevator: true,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await request("sessions", {
        start: "bus",
        destination: "interview",
        elevator: "yes",
      })
    ).status,
    400,
  );
});
test("HTTP complete journey rejects IDOR/stale requests and persists deduplicated feedback", async () => {
  const created = await request("sessions", {
    start: "bus",
    destination: "interview",
    elevator: true,
  });
  assert.equal(created.status, 201);
  let s = await created.json();
  assert.equal(
    (
      await request(`sessions/${s.id}`, undefined, {
        cookie: `campass_owner=${randomUUID()}`,
      })
    ).status,
    404,
  );
  assert.equal(
    (await request(`sessions/${s.id}/advance`, { version: 99 })).status,
    409,
  );
  assert.equal(
    (await request(`sessions/${s.id}/feedback`, { confused: false })).status,
    409,
  );
  await request(`sessions/${s.id}/confusion`, {});
  await request(`sessions/${s.id}/confusion`, {});
  while (s.status !== "completed") {
    const r = await request(`sessions/${s.id}/advance`, { version: s.version });
    assert.equal(r.status, 200);
    s = await r.json();
  }
  assert.equal(
    (await request(`sessions/${s.id}/advance`, { version: s.version })).status,
    409,
  );
  assert.equal(
    (
      await request(`sessions/${s.id}/feedback`, {
        confused: true,
        waypointId: "unknown",
        reason: "방향 혼란",
      })
    ).status,
    400,
  );
  const feedback = {
    confused: true,
    waypointId: "bus",
    reason: "방향 혼란",
    comment: "테스트",
  };
  assert.equal(
    (await request(`sessions/${s.id}/feedback`, feedback)).status,
    200,
  );
  assert.equal(
    (await (await request(`sessions/${s.id}/feedback`, feedback)).json())
      .duplicate,
    true,
  );
  assert.equal((await request("admin/insights")).status, 401);
  const stats = await (
    await request("admin/insights", undefined, {
      headers: { Authorization: `Bearer ${admin}` },
    })
  ).json();
  assert.equal(stats.feedbacks, 1);
  assert.equal(stats.confusions, 1);
  assert.equal(stats.passages, s.route.steps.length);
  assert.ok(stats.rate <= 100);
});
test("HTTP photo validates uploads and unconfigured model returns unavailable", async () => {
  const bad = new FormData();
  bad.append(
    "image",
    new Blob(["not a photo at all"], { type: "image/jpeg" }),
    "bad.jpg",
  );
  assert.equal((await request("recognize", bad)).status, 400);
  const good = new FormData();
  good.append(
    "image",
    new Blob([readFileSync("public/images/bus.jpg")], { type: "image/jpeg" }),
    "bus.jpg",
  );
  const response = await request("recognize", good);
  assert.equal(response.status, 200);
  const r = await response.json();
  assert.equal(r.status, "unavailable");
  assert.deepEqual(r.candidates, []);
});
