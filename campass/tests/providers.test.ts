import test from "node:test";
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
  for (const query of ["승강기 어디", "엘리베이터를 찾아요", "승강기 위치"]) {
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
