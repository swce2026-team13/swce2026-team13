import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { recognizePhoto, interpretIntent } from "../server/integrations/providers.ts";

async function fixture(value: unknown, run: (url: string) => Promise<void>) {
  const server = createServer((req, res) => {
    req.resume();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
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
