import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../shared/utils/api.ts";

test("API client preserves GET, JSON, multipart and authorization requests", async (t) => {
  const requests: RequestInit[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/example");
    requests.push(init);
    return Response.json({ ok: true });
  });
  assert.deepEqual(await api("example"), { ok: true });
  await api("example", { query: "강의실" }, "secret");
  const form = new FormData();
  form.append("image", new Blob(["image"]));
  await api("example", form);
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[0].body, undefined);
  assert.deepEqual(requests[0].headers, {});
  assert.equal(requests[1].method, "POST");
  assert.equal(requests[1].body, JSON.stringify({ query: "강의실" }));
  assert.deepEqual(requests[1].headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer secret",
  });
  assert.equal(requests[2].method, "POST");
  assert.equal(requests[2].body, form);
  assert.deepEqual(requests[2].headers, {});
});

test("API client preserves server errors and fallback message", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: { message: "인증 필요" } }, { status: 401 }),
  );
  await assert.rejects(api("example"), /인증 필요/);
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({}, { status: 500 }),
  );
  await assert.rejects(api("example"), /요청을 완료하지 못했어요/);
});
