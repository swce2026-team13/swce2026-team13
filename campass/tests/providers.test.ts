import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { recognizePhoto, interpretIntent } from "../lib/providers.ts";
import * as providers from "../lib/providers.ts";
import { places, searchPlaces } from "../lib/catalog.ts";

async function fixture(
  value: unknown,
  run: (url: string) => Promise<void>,
  queries?: string[],
) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (queries) queries.push(JSON.parse(body).query);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}/predict`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
test("vision adapter accepts the documented HTTP contract and filters low confidence", async () => {
  await fixture(
    {
      candidates: [
        { waypointId: "bus", confidence: 0.9, direction: "forward" },
        { waypointId: "main", confidence: 0.4, direction: "unknown" },
      ],
    },
    async (url) => {
      const result = await recognizePhoto(new Blob(["test"]), {
        VISION_API_URL: url,
      });
      assert.equal(result.status, "matched");
      assert.equal(result.candidates.length, 1);
      assert.equal(result.candidates[0].waypointId, "bus");
    },
  );
});

const intentCases = [
  {
    query: "엘리베이터로 갈래요",
    intent: "condition",
    conditions: { elevator: true },
    first: undefined,
  },
  {
    query: "짐이 많아서 엘리베이터로 면접장 가요",
    intent: "destination",
    conditions: { elevator: true },
    first: "interview",
  },
  {
    query: "엘리베이터 말고 계단으로",
    intent: "condition",
    conditions: { elevator: false },
    first: undefined,
  },
  {
    query: "계단 싫어요",
    intent: "condition",
    conditions: { elevator: true },
    first: undefined,
  },
  {
    query: "엘리베이터 앞으로 가고 싶어요",
    intent: "destination",
    conditions: {},
    first: "elevator",
  },
  {
    query: "엘리베이터 어디 있어요?",
    intent: "destination",
    conditions: {},
    first: "elevator",
  },
  {
    query: "혜인관 301호 어디예요?",
    intent: "destination",
    conditions: {},
    first: "hyein-301",
  },
  {
    query: "엘리베이터로 가고 싶어요",
    intent: "condition",
    conditions: { elevator: true },
    first: undefined,
  },
  {
    query: "엘리베이터 어디 있어요",
    intent: "destination",
    conditions: {},
    first: "elevator",
  },
  {
    query: "엘리베이터 타고 혜인관 5층",
    intent: "destination",
    conditions: { elevator: true },
    first: "interview",
  },
  {
    query: "계단으로 면접 보러 갈게요",
    intent: "destination",
    conditions: { elevator: false },
    first: "interview",
  },
  {
    query: "휠체어라서 엘리베이터 필요해요",
    intent: "condition",
    conditions: { elevator: true },
    first: undefined,
  },
  {
    query: "여기서 어디로 가요",
    intent: "next",
    conditions: {},
    first: undefined,
  },
  {
    query: "면접 보러 왔어요",
    intent: "destination",
    conditions: {},
    first: "interview",
  },
  {
    query: "헤인관 면접",
    intent: "destination",
    conditions: {},
    first: "interview",
  },
] as const;

for (const example of intentCases) {
  test(`intent classification: ${example.query}`, async () => {
    const result = providers.classifyIntent(example.query);
    assert.equal(result.intent, example.intent);
    assert.deepEqual(result.conditions, example.conditions);
    assert.equal(result.places[0]?.id, example.first);
    if (!example.first) assert.deepEqual(result.places, []);
    assert.ok(result.places.every((place) => places.includes(place)));
    if ("elevator" in example.conditions)
      assert.ok(result.places.every((place) => place.id !== "elevator"));
    const response = await interpretIntent(example.query, {});
    assert.equal(response.intent, example.intent);
    assert.deepEqual(response.conditions, example.conditions);
    assert.deepEqual(response.places, result.places);
    assert.equal(response.mode, "keyword");
    assert.equal(typeof response.message, "string");
  });
}

test("intent classification handles condition variants without returning all places for an empty remainder", () => {
  for (const query of [
    "엘리베이터로",
    "승강기로 이동할래요",
    "엘리베이터으로 부탁해요",
    "계단은 좀",
    "승강기로 가요",
    "승강기를 타고",
    "엘리베이터 이용",
    "엘리베이터 써서",
    "휠체어",
    "유모차",
    "캐리어",
    "짐이 있어요",
    "다리가 아파요",
    "계단 말고",
    "계단 없이",
  ]) {
    const result = providers.classifyIntent(query);
    assert.equal(result.intent, "condition", query);
    assert.deepEqual(result.conditions, { elevator: true }, query);
    assert.deepEqual(result.places, [], query);
  }
  for (const query of ["계단으로", "계단 타고", "계단 이용"]) {
    const result = providers.classifyIntent(query);
    assert.equal(result.intent, "condition", query);
    assert.deepEqual(result.conditions, { elevator: false }, query);
    assert.deepEqual(result.places, [], query);
  }
});

test("intent classification preserves facility searches and destination priority", () => {
  for (const query of [
    "승강기 어디", "엘리베이터를 찾아요", "승강기 위치",
    "엘리베이터 쪽으로 가요", "승강기 근처로 가요",
    "엘리베이터로 어디 가요", "엘리베이터로 찾아갈래요", "승강기로 위치 알려주세요",
  ]) {
    const result = providers.classifyIntent(query);
    assert.equal(result.intent, "destination", query);
    assert.deepEqual(result.conditions, {}, query);
    assert.equal(result.places[0]?.id, "elevator", query);
  }
  for (const query of [
    "다음에 어디",
    "이제 어디",
    "어느 쪽",
    "어디로 가야 해요",
  ]) {
    assert.equal(providers.classifyIntent(query).intent, "next", query);
  }
  assert.equal(
    providers.classifyIntent("여기서 계단 없이").intent,
    "condition",
  );
  assert.equal(
    providers.classifyIntent("여기서 면접 대기실 어디로 가야 해요").intent,
    "destination",
  );
  for (const query of ["면접 보러 왔어요", "헤인관 면접"]) {
    assert.deepEqual(
      providers.classifyIntent(query).places,
      searchPlaces(query),
    );
  }
  const missing = providers.classifyIntent("존재하지않는장소xyz");
  assert.equal(missing.intent, "destination");
  assert.deepEqual(missing.places, []);
  assert.deepEqual(missing.conditions, {});
});

test("excluding an elevator does not set a condition by itself", () => {
  for (const query of ["엘리베이터 말고", "승강기 말고"]) {
    assert.deepEqual(providers.classifyIntent(query), {
      intent: "destination", conditions: {}, places: [],
    });
    const stairs = providers.classifyIntent(`${query} 계단으로`);
    assert.equal(stairs.intent, "condition");
    assert.deepEqual(stairs.conditions, { elevator: false });
    assert.deepEqual(stairs.places, []);
  }
});

test("intent API strips travel phrases and removes elevator facilities for either travel condition", async () => {
  const queries: string[] = [];
  await fixture({ placeIds: ["elevator", "interview"] }, async (url) => {
    const enabled = await interpretIntent("짐이 많아서 엘리베이터로 면접장 가요", { INTENT_API_URL: url });
    assert.deepEqual(queries, ["면접장 가요"]);
    assert.equal(enabled.intent, "destination");
    assert.deepEqual(enabled.conditions, { elevator: true });
    assert.deepEqual(enabled.places.map((place) => place.id), ["interview"]);
    const disabled = await interpretIntent("승강기 말고 계단으로 면접", { INTENT_API_URL: url });
    assert.deepEqual(queries, ["면접장 가요", "면접"]);
    assert.equal(disabled.intent, "destination");
    assert.deepEqual(disabled.conditions, { elevator: false });
    assert.deepEqual(disabled.places.map((place) => place.id), ["interview"]);
  }, queries);
  await fixture({ placeIds: ["elevator"] }, async (url) => {
    const result = await interpretIntent("계단 싫어요", { INTENT_API_URL: url });
    assert.equal(result.intent, "condition");
    assert.deepEqual(result.conditions, { elevator: true });
    assert.deepEqual(result.places, []);
  });
});

test("intent understands travel particles without treating unrelated words as luggage", () => {
  for (const query of ["계단을 타고 면접", "계단을 이용해서 면접"]) {
    const result = providers.classifyIntent(query);
    assert.equal(result.intent, "destination", query);
    assert.deepEqual(result.conditions, { elevator: false }, query);
    assert.equal(result.places[0]?.id, "interview", query);
  }
  for (const query of ["휠체어라서 엘리베이터가 필요해요", "짐 때문에"]) {
    const result = providers.classifyIntent(query);
    assert.equal(result.intent, "condition", query);
    assert.deepEqual(result.conditions, { elevator: true }, query);
    assert.deepEqual(result.places, [], query);
  }
  for (const query of [
    "면접 장소가 어딘지 짐작이 안 돼요",
    "짐작이 안 돼요",
    "다짐",
  ])
    assert.deepEqual(providers.classifyIntent(query).conditions, {}, query);
});

test("intent API receives only the destination remainder and cannot override local intent or conditions", async () => {
  const queries: string[] = [];
  await fixture(
    { placeIds: ["interview"], intent: "next", conditions: { elevator: true } },
    async (url) => {
      const result = await interpretIntent("계단으로 면접", {
        INTENT_API_URL: url,
      });
      assert.deepEqual(queries, ["면접"]);
      assert.equal(result.intent, "destination");
      assert.deepEqual(result.conditions, { elevator: false });
      assert.equal(result.places[0]?.id, "interview");
      assert.equal(result.mode, "api");
    },
    queries,
  );
  await fixture({ placeIds: [] }, async (url) => {
    const result = await interpretIntent("엘리베이터 타고 미등록 장소", {
      INTENT_API_URL: url,
    });
    assert.equal(result.intent, "condition");
    assert.deepEqual(result.conditions, { elevator: true });
    assert.deepEqual(result.places, []);
    assert.equal(
      (await interpretIntent("여기서 어디로 가요", { INTENT_API_URL: url }))
        .intent,
      "next",
    );
  });
});

test("intent does not call the destination API when conditions leave an empty query", async () => {
  const result = await interpretIntent("계단으로", {
    INTENT_API_URL: "invalid-url",
  });
  assert.equal(result.intent, "condition");
  assert.deepEqual(result.conditions, { elevator: false });
  assert.deepEqual(result.places, []);
});
const gemini = { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test-model" };
const unresolved = "학생들 시험 보는 곳 알려줘";
function fakeGemini(reply: (signal: AbortSignal) => Promise<string>) {
  const calls: string[] = [];
  const ask = async (query: string, _config: unknown, signal: AbortSignal) => {
    calls.push(query);
    return reply(signal);
  };
  return { ask, calls };
}
const reply = (value: unknown) => async () => JSON.stringify(value);
// Gemini status logs are silenced here and checked in their own test.
const warn = mock.method(console, "warn", () => {});
const info = mock.method(console, "info", () => {});
function logs(run: () => Promise<unknown>) {
  warn.mock.resetCalls();
  info.mock.resetCalls();
  return run().then(() =>
    [...warn.mock.calls, ...info.mock.calls].map((call) => call.arguments.join(" ")),
  );
}

test("Gemini status logs give only the reason, never the key or the sentence", async () => {
  const cases: [Parameters<typeof interpretIntent>[1], (signal: AbortSignal) => Promise<string>, string][] = [
    [{ GEMINI_MODEL: "test-model" }, reply({}), "[gemini] 건너뜀: GEMINI_API_KEY 없음"],
    [{ GEMINI_API_KEY: "test-key" }, reply({}), "[gemini] 건너뜀: GEMINI_MODEL 없음"],
    [gemini, () => new Promise<string>(() => {}), "[gemini] 키워드 검색으로 대체: timeout"],
    ...[400, 401, 403, 404, 429].map((status) => [
      gemini,
      async () => {
        throw Object.assign(new Error(`${unresolved} test-key`), { status });
      },
      `[gemini] 키워드 검색으로 대체: HTTP ${status}`,
    ] as [typeof gemini, () => Promise<string>, string]),
    [gemini, async () => "not json", "[gemini] 키워드 검색으로 대체: JSON 파싱 실패"],
    [gemini, async () => "[]", "[gemini] 키워드 검색으로 대체: JSON 형식 오류"],
    [gemini, async () => { throw new Error("fetch failed"); }, "[gemini] 키워드 검색으로 대체: fetch failed"],
    [gemini, reply({ intent: "destination", placeIds: ["invented"], elevator: null }), "[gemini] 응답은 왔지만 장소 없음"],
  ];
  for (const [config, answer, expected] of cases) {
    const { ask } = fakeGemini(answer);
    const lines = await logs(() => interpretIntent(unresolved, config, ask, 20));
    assert.deepEqual(lines, [expected]);
    assert.ok(lines.every((line) => !line.includes("test-key") && !line.includes(unresolved)));
  }
  const { ask } = fakeGemini(reply({ intent: "destination", placeIds: ["hyein-301"], elevator: null }));
  assert.deepEqual(await logs(() => interpretIntent(unresolved, gemini, ask)), []);
  assert.deepEqual(await logs(() => interpretIntent("면접 보러 왔어요", {}, ask)), []);
});

test("Gemini is not called for sentences the rules already resolve", async () => {
  const { ask, calls } = fakeGemini(
    reply({ intent: "destination", placeIds: ["hyein-301"], elevator: null }),
  );
  for (const query of ["엘리베이터로 갈래요", "면접 보러 왔어요", "여기서 어디로 가요"]) {
    const result = await interpretIntent(query, gemini, ask);
    assert.equal(result.mode, "keyword", query);
    assert.deepEqual(result, {
      ...providers.classifyIntent(query),
      mode: "keyword",
      message: result.message,
    });
  }
  assert.deepEqual(calls, []);
});

test("Gemini fills unresolved destinations with registered places only", async () => {
  assert.deepEqual(providers.classifyIntent(unresolved), {
    intent: "destination", conditions: {}, places: [],
  });
  const found = fakeGemini(
    reply({ intent: "destination", placeIds: ["hyein-301"], elevator: null }),
  );
  const result = await interpretIntent(unresolved, gemini, found.ask);
  assert.deepEqual(found.calls, [unresolved]);
  assert.equal(result.mode, "llm");
  assert.equal(result.intent, "destination");
  assert.deepEqual(result.conditions, {});
  assert.deepEqual(result.places.map((place) => place.id), ["hyein-301"]);

  const mixed = fakeGemini(
    reply({
      intent: "destination",
      placeIds: ["invented", "hyein-301", "hyein-301", "hallucinated"],
      elevator: null,
    }),
  );
  const filtered = await interpretIntent(unresolved, gemini, mixed.ask);
  assert.equal(filtered.mode, "llm");
  assert.deepEqual(filtered.places.map((place) => place.id), ["hyein-301"]);

  const many = fakeGemini(
    reply({ intent: "destination", placeIds: places.map((p) => p.id), elevator: null }),
  );
  assert.equal((await interpretIntent(unresolved, gemini, many.ask)).places.length, 5);

  const invented = fakeGemini(
    reply({ intent: "destination", placeIds: ["invented"], elevator: null }),
  );
  const fallback = await interpretIntent(unresolved, gemini, invented.ask);
  assert.equal(fallback.mode, "keyword");
  assert.deepEqual(fallback.places, []);
});

test("Gemini intent and elevator are validated before use", async () => {
  const travel = fakeGemini(
    reply({ intent: "weird", placeIds: ["elevator", "interview"], elevator: true }),
  );
  const result = await interpretIntent(unresolved, gemini, travel.ask);
  assert.equal(result.mode, "llm");
  assert.equal(result.intent, "destination");
  assert.deepEqual(result.conditions, { elevator: true });
  assert.deepEqual(result.places.map((place) => place.id), ["interview"]);

  const next = fakeGemini(reply({ intent: "next", placeIds: [], elevator: null }));
  const moving = await interpretIntent("이 다음은요", gemini, next.ask);
  assert.equal(moving.mode, "llm");
  assert.equal(moving.intent, "next");
  assert.deepEqual(moving.places, []);
});

test("Gemini timeouts, errors, quota limits and malformed JSON fall back to keyword search", async () => {
  const keyword = await interpretIntent(unresolved, {});
  const failures = [
    (signal: AbortSignal) =>
      new Promise<string>((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
    () => new Promise<string>(() => {}),
    async () => {
      throw new Error("network");
    },
    async () => {
      throw Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 });
    },
    async () => "not json",
    async () => "[]",
    async () => "",
    async () => JSON.stringify({ intent: "weird", placeIds: "hyein-301", elevator: "yes" }),
  ];
  for (const failure of failures) {
    const { ask, calls } = fakeGemini(failure);
    const result = await interpretIntent(unresolved, gemini, ask, 20);
    assert.equal(calls.length, 1);
    assert.deepEqual(result, keyword);
  }
  let aborted = false;
  const { ask } = fakeGemini(
    (signal) =>
      new Promise<string>(() => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
      }),
  );
  await interpretIntent(unresolved, gemini, ask, 20);
  assert.ok(aborted);
});

test("Gemini is not called without an API key", async () => {
  const { ask, calls } = fakeGemini(
    reply({ intent: "destination", placeIds: ["hyein-301"], elevator: null }),
  );
  for (const config of [{}, { GEMINI_MODEL: "test-model" }, { GEMINI_API_KEY: "" }]) {
    const result = await interpretIntent(unresolved, config, ask);
    assert.equal(result.mode, "keyword");
    assert.deepEqual(result.places, []);
  }
  assert.deepEqual(calls, []);
});

test("vision adapter rejects provider identifiers not present in the route graph", async () => {
  await fixture(
    {
      candidates: [
        { waypointId: "invented", confidence: 0.95, direction: "forward" },
      ],
    },
    async (url) => {
      await assert.rejects(
        recognizePhoto(new Blob(["test"]), { VISION_API_URL: url }),
        /후보 값/,
      );
    },
  );
});
test("intent adapter accepts only registered place IDs", async () => {
  await fixture({ placeIds: ["interview"] }, async (url) => {
    const result = await interpretIntent("면접", { INTENT_API_URL: url });
    assert.equal(result.mode, "api");
    assert.equal(result.places[0].id, "interview");
  });
  await fixture({ placeIds: ["hallucinated-place"] }, async (url) => {
    await assert.rejects(
      interpretIntent("어디", { INTENT_API_URL: url }),
      /응답/,
    );
  });
});
