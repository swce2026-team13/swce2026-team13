import test from "node:test";
import assert from "node:assert/strict";
import { clearConversation, mergeConversation, restoreConversation, saveConversation, selectConversationPlace } from "../lib/conversation-context.ts";
import { createIntentRequest } from "../lib/intent-request.ts";
import { interpretIntent, type IntentResult } from "../lib/providers.ts";
import { allPlaces, findPlace } from "../lib/rooms.ts";
import { calculateRoute, waypoints } from "../lib/routing.ts";
import { evaluationCases } from "../scripts/intent-eval-cases.ts";
import { evaluateCases, summarize, validateEvaluationCases } from "../scripts/intent-eval-core.ts";

const find = (id: string) => findPlace(id);
const ask = (query: string) => interpretIntent(query, {});
const route = (start: string, destination: string, elevator = false) =>
  calculateRoute(start, destination, elevator, allPlaces());

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("시뮬레이션 평가 180건은 유형별 개수와 등록 장소 정답을 지켜요", () => {
  assert.equal(validateEvaluationCases(), 180);
  assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(evaluationCases, (item) => item.category))
    .map(([category, cases]) => [category, cases.length])), {
    "단순 장소": 30, "복합 질문": 35, "후속 질문": 30,
    "모호한 질문": 25, "의미·오타·별칭": 35, "범위 밖·미등록": 25,
  });
  assert.ok(evaluationCases.every((item) => item.source === "작성된 시뮬레이션"));
});

test("규칙 평가와 가상 응답 평가는 호출 수와 결과를 구분해요", async () => {
  const cases = evaluationCases.filter((item) => ["S14", "C04", "A01", "M04", "O01"].includes(item.id));
  const keyword = summarize(await evaluateCases("keyword", cases));
  const mock = summarize(await evaluateCases("mock", cases));
  assert.equal(keyword.count, 5);
  assert.equal(keyword.calls, 0);
  assert.ok(mock.calls > 0);
  assert.ok(keyword.top1.total > 0);
  assert.ok(keyword.latency.p50 !== null);
  await assert.rejects(() => evaluateCases("live", cases), /실호출 함수/);
});

test("단순 검색과 복합 질문은 선택한 출발지·목적지로 실제 경로를 계산해요", async () => {
  const simple = await ask("혜인관 301호 강의실");
  assert.equal(simple.places[0]?.id, "hyein-301");
  assert.ok(route("gate", simple.places[0].id).steps.length > 0);

  const compound = await ask("본관에서 한림관까지 계단으로 가요");
  assert.equal(compound.startPlaceId, "bon");
  assert.equal(compound.places[0]?.id, "hallim");
  assert.equal(compound.conditions.elevator, false);
  assert.ok(route(compound.startPlaceId!, compound.places[0].id, false).steps.length > 0);

  const elevator = await ask("본관에서 면접 대기실까지 계단 없이");
  assert.equal(elevator.startPlaceId, "bon");
  assert.equal(elevator.places[0]?.id, "interview");
  assert.equal(elevator.conditions.elevator, true);
  assert.equal(route(elevator.startPlaceId!, elevator.places[0].id, true).elevator, true);
});

test("모호한 호실을 건물로 확정하고 후속 조건과 목적지 변경을 경로에 반영해요", async () => {
  const ambiguous = mergeConversation("301호 가고 싶어요", await ask("301호 가고 싶어요"), null, find);
  assert.equal(ambiguous.context.pending, true);
  const selected = mergeConversation("혜인관이요", await ask("혜인관이요"), ambiguous.context, find);
  assert.equal(selected.context.destinationPlaceId, "hyein-301");
  assert.ok(route("gate", selected.context.destinationPlaceId!).steps.length > 0);

  const initial = mergeConversation("본관에서 한림관까지", await ask("본관에서 한림관까지"), null, find);
  const changed = mergeConversation("아니 혜인관으로 바꿀게요", await ask("아니 혜인관으로 바꿀게요"), initial.context, find);
  assert.equal(changed.context.startPlaceId, "bon");
  assert.equal(changed.context.destinationPlaceId, "hyein");
  assert.notEqual(route("bon", "hallim").steps.at(-1)?.node, route("bon", "hyein").steps.at(-1)?.node);

  const remembered = selectConversationPlace(null, findPlace("hyein")!, "gate", false);
  const followup = mergeConversation("그럼 엘리베이터로는?", await ask("그럼 엘리베이터로는?"), remembered, find);
  assert.equal(followup.context.destinationPlaceId, "hyein");
  assert.equal(followup.context.elevator, true);
  assert.equal(route("gate", "hyein", followup.context.elevator).elevator, true);
});

test("새로고침은 등록 장소를 복원하고 새 안내 시작은 대화 맥락을 지워요", async () => {
  const storage = memory();
  const now = 1_000_000;
  saveConversation(storage, selectConversationPlace(null, findPlace("interview")!, "bus_stop_2115", true, now));
  const restored = await restoreConversation(storage, async (id) => findPlace(id) ??
    (waypoints.some((point) => point.id === id) ? true : undefined), now + 1);
  assert.equal(restored?.context.destinationPlaceId, "interview");
  assert.ok(route(restored!.context.startPlaceId!, restored!.context.destinationPlaceId!, restored!.context.elevator).steps.length);
  clearConversation(storage);
  assert.equal(await restoreConversation(storage, async (id) => findPlace(id), now + 2), null);
});

test("모델 응답 실패 뒤 키워드 경로를 쓰고 연속 질문은 최신 응답만 적용해요", async () => {
  const fallback = await interpretIntent(
    "본관에서 한림관까지 계단 없이",
    { GEMINI_API_KEY: "평가용-가상-키", GEMINI_MODEL: "평가용-가상-모델" },
    async () => "잘못된 JSON",
  );
  assert.equal(fallback.mode, "keyword");
  assert.equal(fallback.startPlaceId, "bon");
  assert.equal(fallback.places[0]?.id, "hallim");
  assert.ok(route("bon", "hallim", fallback.conditions.elevator).steps.length);

  const pending = new Map<string, (result: IntentResult) => void>();
  const requests = createIntentRequest((query) => new Promise<IntentResult>((resolve) => {
    pending.set(query, resolve);
  }));
  const first = requests.run("혜인관 어디예요?");
  const second = requests.run("한림관 어디예요?");
  pending.get("한림관 어디예요?")!(await ask("한림관 어디예요?"));
  pending.get("혜인관 어디예요?")!(await ask("혜인관 어디예요?"));
  assert.equal(await first, null);
  assert.ok(await second);
  requests.cancel();
});
