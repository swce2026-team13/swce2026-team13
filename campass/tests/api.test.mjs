import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { DatabaseSync } from "node:sqlite";
let server,
  origin,
  cookie,
  output = "";
const admin = { id: "test-admin", password: randomUUID() + randomUUID() };
const databasePath = join(
  mkdtempSync(join(tmpdir(), "campass-api-")),
  "test.sqlite",
);
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
        DATABASE_PATH: databasePath,
        ADMIN_ID: admin.id,
        ADMIN_PASSWORD: admin.password,
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

test("HTTP pages support direct navigation and unknown paths return 404", async () => {
  for (const path of [
    "/",
    "/search?q=면접",
    "/directions?destination=interview",
    "/directions/photo",
    "/directions/recognition",
    "/directions/failed",
    "/directions/recovery",
    "/guide",
    "/guide/arrival",
    "/guide/map",
    "/map",
    "/map/places?building=본관",
    "/help",
    "/admin",
  ]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), /text\/html/);
  }
  assert.equal((await fetch(`${origin}/missing-page`)).status, 404);
});

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
  assert.equal(intent.intent, "destination");
  assert.deepEqual(intent.conditions, {});
  assert.equal(intent.places[0].id, "interview");
  assert.equal((await request("intent", { query: { bad: true } })).status, 400);
});
test("HTTP intent exposes destination, condition and next responses with travel conditions", async () => {
  for (const [query, expectedIntent, conditions, firstPlace] of [
    ["엘리베이터로 가고 싶어요", "condition", { elevator: true }, undefined],
    ["엘리베이터로 갈래요", "condition", { elevator: true }, undefined],
    ["엘리베이터 어디 있어요", "destination", {}, "elevator"],
    [
      "엘리베이터 타고 혜인관 5층",
      "destination",
      { elevator: true },
      "interview",
    ],
    [
      "계단으로 면접 보러 갈게요",
      "destination",
      { elevator: false },
      "interview",
    ],
    [
      "휠체어라서 엘리베이터 필요해요",
      "condition",
      { elevator: true },
      undefined,
    ],
    ["계단 이용", "condition", { elevator: false }, undefined],
    ["여기서 어디로 가요", "next", {}, undefined],
    ["존재하지않는장소xyz", "destination", {}, undefined],
  ]) {
    const response = await request("intent", { query });
    assert.equal(response.status, 200, query);
    const result = await response.json();
    assert.equal(result.intent, expectedIntent, query);
    assert.deepEqual(result.conditions, conditions, query);
    assert.equal(result.places[0]?.id, firstPlace, query);
    if (!firstPlace) assert.deepEqual(result.places, [], query);
    assert.equal(result.mode, "keyword");
    assert.equal(typeof result.message, "string");
  }
});
test("HTTP enforces origin, route availability, and typed inputs", async () => {
  assert.equal(
    (
      await request(
        "sessions",
        { start: "bus_stop_2115", destination: "interview", elevator: true },
        { origin: "https://untrusted.invalid" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("routes", {
        start: "bus_stop_2115",
        destination: "bukak",
        elevator: true,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await request("sessions", {
        start: "bus_stop_2115",
        destination: "interview",
        elevator: "yes",
      })
    ).status,
    400,
  );
});
test("HTTP complete journey rejects IDOR/stale requests and persists deduplicated feedback", async () => {
  const created = await request("sessions", {
    start: "bus_stop_2115",
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
    waypointId: "bus_stop_2115",
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
  const login = await request("admin/login", admin);
  assert.equal(login.status, 200);
  const stats = await (
    await request("admin/insights", undefined, {
      cookie: adminCookie(login),
    })
  ).json();
  assert.equal(stats.feedbacks, 1);
  assert.equal(stats.confusions, 1);
  assert.equal(stats.passages, s.route.steps.length);
  assert.ok(stats.rate <= 100);
});
function adminCookie(response) {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("campass_admin="));
  assert.ok(cookie, "admin session cookie missing");
  return cookie.split(";")[0];
}

test("HTTP admin login sets a private eight-hour production cookie and logout revokes it", async () => {
  assert.equal((await request("admin/insights")).status, 401);
  assert.equal(
    (
      await request("admin/insights", undefined, {
        headers: { Authorization: `Bearer ${admin.password}` },
      })
    ).status,
    401,
  );
  const login = await request("admin/login", admin);
  assert.equal(login.status, 200);
  const sessionCookie = adminCookie(login);
  const header = login.headers
    .getSetCookie()
    .find((value) => value.startsWith("campass_admin="));
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Strict/i);
  assert.match(header, /Secure/i);
  assert.match(header, /Max-Age=28800/i);
  assert.match(header, /Path=\//i);
  assert.deepEqual(await login.json(), { ok: true });
  assert.equal(
    (await request("admin/insights", undefined, { cookie: sessionCookie }))
      .status,
    200,
  );
  const logout = await request("admin/logout", {}, { cookie: sessionCookie });
  assert.equal(logout.status, 200);
  assert.match(
    logout.headers
      .getSetCookie()
      .find((value) => value.startsWith("campass_admin=")),
    /Max-Age=0/i,
  );
  assert.equal(
    (await request("admin/insights", undefined, { cookie: sessionCookie }))
      .status,
    401,
  );
  const db = new DatabaseSync(databasePath);
  try {
    assert.equal(
      db
        .prepare("SELECT id FROM admin_sessions WHERE id=?")
        .get(sessionCookie.split("=")[1]),
      undefined,
    );
  } finally {
    db.close();
  }
});

test("HTTP admin rejects expired sessions and cross-origin login/logout", async () => {
  assert.equal(
    (
      await request("admin/login", admin, {
        origin: "https://untrusted.invalid",
      })
    ).status,
    403,
  );
  const login = await request("admin/login", admin);
  const sessionCookie = adminCookie(login);
  assert.equal(
    (
      await request(
        "admin/logout",
        {},
        { cookie: sessionCookie, origin: "https://untrusted.invalid" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("admin/insights", undefined, { cookie: sessionCookie }))
      .status,
    200,
  );
  const db = new DatabaseSync(databasePath);
  try {
    db.prepare("UPDATE admin_sessions SET expires=? WHERE id=?").run(
      Date.now() - 1,
      sessionCookie.split("=")[1],
    );
  } finally {
    db.close();
  }
  assert.equal(
    (await request("admin/insights", undefined, { cookie: sessionCookie }))
      .status,
    401,
  );
});

test("HTTP signing in again replaces the previous browser session", async () => {
  const first = await request("admin/login", admin);
  const firstCookie = adminCookie(first);
  const second = await request("admin/login", admin, { cookie: firstCookie });
  assert.equal(second.status, 200);
  const secondCookie = adminCookie(second);
  assert.notEqual(secondCookie, firstCookie);
  assert.equal(
    (await request("admin/insights", undefined, { cookie: firstCookie }))
      .status,
    401,
  );
  assert.equal(
    (await request("admin/insights", undefined, { cookie: secondCookie }))
      .status,
    200,
  );
});

test("HTTP admin failures are generic and changing owner cookies cannot evade five-failure blocking", async () => {
  const headers = { "X-Forwarded-For": "198.51.100.7" };
  const wrongId = await request(
    "admin/login",
    { ...admin, id: "wrong" },
    { headers },
  );
  const wrongPassword = await request(
    "admin/login",
    { ...admin, password: "wrong" },
    { headers },
  );
  assert.equal(wrongId.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(await wrongId.json(), await wrongPassword.json());
  for (let i = 3; i <= 5; i++) {
    const result = await request(
      "admin/login",
      {},
      { headers, cookie: `campass_owner=${randomUUID()}` },
    );
    assert.equal(result.status, i === 5 ? 429 : 401);
  }
  assert.equal(
    (await request("admin/login", admin, { headers, cookie: "" })).status,
    429,
  );
  assert.equal(
    (
      await request("admin/login", admin, {
        headers: { "X-Forwarded-For": "198.51.100.8" },
      })
    ).status,
    200,
  );
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
