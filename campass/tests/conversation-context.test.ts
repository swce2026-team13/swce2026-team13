import test from "node:test";
import assert from "node:assert/strict";
import { interpretIntent } from "../server/integrations/providers.ts";
import { allPlaces, findPlace } from "../server/services/rooms.ts";
import { calculateRoute, waypoints } from "../shared/utils/routing.ts";
import {
  clearConversation,
  conversationLifetimeMs,
  conversationStorageKey,
  mergeConversation,
  rememberedTurnPlaces,
  restoreConversation,
  saveConversation,
  selectConversationPlace,
} from "../shared/utils/conversation-context.ts";

const ask = (query: string) => interpretIntent(query, {});
const find = (id: string) => findPlace(id);

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("이전 목적지와 출발지를 이어 쓰되 새 목적지는 교체해요", async () => {
  const first = mergeConversation("혜인관 가고 싶어요", await ask("혜인관 가고 싶어요"), null, find);
  assert.equal(first.context.destinationPlaceId, "hyein");
  const followup = mergeConversation("그럼 엘리베이터로는?", await ask("그럼 엘리베이터로는?"), first.context, find);
  assert.deepEqual(followup.result.places.map((p) => p.id), ["hyein"]);
  assert.equal(followup.result.conditions.elevator, true);

  const journey = mergeConversation("본관에서 한림관까지", await ask("본관에서 한림관까지"), null, find);
  assert.equal(journey.context.startPlaceId, "bon");
  assert.equal(journey.context.destinationPlaceId, "hallim");
  const correction = mergeConversation("아니 혜인관으로 바꿀게요", await ask("아니 혜인관으로 바꿀게요"), journey.context, find);
  assert.equal(correction.context.startPlaceId, "bon");
  assert.equal(correction.context.destinationPlaceId, "hyein");
  assert.ok(calculateRoute(correction.context.startPlaceId!, correction.context.destinationPlaceId!, true, allPlaces()).steps.length);
});

test("모호한 호실은 건물을 되묻고 다른 질문에는 이전 후보를 적용하지 않아요", async () => {
  const ambiguous = mergeConversation("301호 가고 싶어요", await ask("301호 가고 싶어요"), null, find);
  assert.ok(ambiguous.context.pending);
  assert.ok(new Set(ambiguous.result.places.map((p) => p.building)).size > 1);
  const clarified = mergeConversation("혜인관이요", await ask("혜인관이요"), ambiguous.context, find);
  assert.deepEqual(clarified.result.places.map((p) => p.id), ["hyein-301"]);
  assert.equal(clarified.context.pending, false);
  const newQuestion = mergeConversation("커피 마시고 싶어요", await ask("커피 마시고 싶어요"), ambiguous.context, find);
  assert.ok(newQuestion.result.places.every((p) => p.kind === "cafe"));
  assert.ok(newQuestion.context.pending);
  const unknown = mergeConversation("등록되지 않은 비밀 강의실", await ask("등록되지 않은 비밀 강의실"), clarified.context, find);
  assert.deepEqual(unknown.result.places, []);
  assert.equal(unknown.context.destinationPlaceId, undefined);
});

test("상황 표현과 오타는 등록된 장소 후보로만 연결해요", async () => {
  const food = await ask("배고파요");
  assert.ok(food.places.length > 1);
  assert.ok(food.places.every((p) => p.kind === "dining"));
  const coffee = await ask("커피 마시고 싶어요");
  assert.ok(coffee.places.length > 1);
  assert.ok(coffee.places.every((p) => p.kind === "cafe"));
  assert.deepEqual((await ask("택배 부치려고요")).places.map((p) => p.name), ["우체국"]);
  assert.deepEqual((await ask("헤인관 가고 싶어요")).places.map((p) => p.id), ["hyein"]);
  assert.deepEqual((await ask("혜인 가고 싶어요")).places.map((p) => p.id), ["hyein"]);
  assert.deepEqual((await ask("한림관 6층에서 은주1관 5층까지")).places.map((p) => p.id), ["eunju1|5"]);
});

test("새로고침에는 유효한 ID만 복원하고 초기화와 만료 때 삭제해요", async () => {
  const storage = memory();
  const now = 1_000_000;
  const place = findPlace("hyein")!;
  const context = { ...selectConversationPlace(null, place, "bus_stop_2115", true, now), turnId: "질문-1" };
  saveConversation(storage, context);
  assert.ok(!storage.getItem(conversationStorageKey)?.includes("혜인관 가고 싶어요"));
  const resolve = async (id: string) => findPlace(id) ??
    (waypoints.some((p) => p.id === id) ? true : undefined);
  const restored = await restoreConversation(storage, resolve, now + 1000);
  assert.equal(restored?.context.startPlaceId, "bus_stop_2115");
  assert.equal(restored?.context.destinationPlaceId, "hyein");
  assert.deepEqual(rememberedTurnPlaces(restored?.context ?? null, "질문-1", find).map((p) => p.id), ["hyein"]);
  assert.deepEqual(rememberedTurnPlaces(restored?.context ?? null, "다른 질문", find), []);

  saveConversation(storage, { ...context, destinationPlaceId: "없는 장소", candidateIds: ["hyein", "없는 장소"], pending: true });
  const checked = await restoreConversation(storage, resolve, now + 1000);
  assert.equal(checked?.context.destinationPlaceId, undefined);
  assert.deepEqual(checked?.context.candidateIds, ["hyein"]);
  assert.equal(checked?.context.pending, false);
  const ambiguous = mergeConversation("301호 가고 싶어요", await ask("301호 가고 싶어요"), null, find, now);
  saveConversation(storage, { ...ambiguous.context,
    clarification: { field: "building", value: "혜인관" } });
  const pending = await restoreConversation(storage, resolve, now + 1000);
  assert.equal(pending?.context.pending, true);
  assert.deepEqual(pending?.context.clarification, { field: "building", value: "혜인관" });
  clearConversation(storage);
  assert.equal(await restoreConversation(storage, resolve, now + 1000), null);

  saveConversation(storage, context);
  assert.equal(await restoreConversation(storage, resolve, now + conversationLifetimeMs + 1), null);
  assert.equal(storage.getItem(conversationStorageKey), null);
});

test("초기화 뒤에 끝난 복원은 이전 대화를 다시 저장하지 않아요", async () => {
  const storage = memory();
  const now = 1_000_000;
  const place = findPlace("hyein")!;
  saveConversation(storage, selectConversationPlace(null, place, undefined, undefined, now));
  let finish!: (value: typeof place) => void;
  const lookup = new Promise<typeof place>((resolve) => { finish = resolve; });
  let current = true;
  const restoring = restoreConversation(storage, () => lookup, now, () => current);
  clearConversation(storage);
  current = false;
  finish(place);
  assert.equal(await restoring, null);
  assert.equal(storage.getItem(conversationStorageKey), null);
});

test("최근 질문과 turn을 새로고침 뒤에도 함께 복원해요", async () => {
  const storage = memory();
  const now = 1_000_000;
  const question = "혜인관 301호 어디예요?";
  const first = mergeConversation(question, await ask(question), null, find, now, "turn-1");
  saveConversation(storage, first.context);
  const restored = await restoreConversation(storage, async (id) => find(id), now + 1000);
  assert.equal(restored?.context.lastQuestion, question);
  assert.equal(restored?.context.turnId, "turn-1");
  assert.deepEqual(rememberedTurnPlaces(restored!.context, "turn-1", find).map((p) => p.id), ["hyein-301"]);

  const followup = mergeConversation("그럼 엘리베이터로는?", await ask("그럼 엘리베이터로는?"), first.context, find, now + 2000, "turn-2");
  assert.equal(followup.context.lastQuestion, "그럼 엘리베이터로는?");
  assert.equal(followup.context.turnId, "turn-2");
});

test("장소나 출발지를 버튼으로 골라도 마지막 질문의 turn을 유지해요", async () => {
  const now = 1_000_000;
  const first = mergeConversation("혜인관", await ask("혜인관"), null, find, now, "turn-1");
  const chosen = selectConversationPlace(first.context, find("hyein")!, undefined, true, now + 1000);
  assert.equal(chosen.lastQuestion, "혜인관");
  assert.equal(chosen.turnId, "turn-1");
  const local = mergeConversation("학교 정문", {
    intent: "destination", conditions: {}, places: [], startPlaceId: "gate", startRequested: true,
    mode: "keyword", message: "",
  }, chosen, find, now + 2000);
  assert.equal(local.context.lastQuestion, "혜인관");
  assert.equal(local.context.turnId, "turn-1");
  assert.equal(local.context.startPlaceId, "gate");
});

test("검색 결과가 없어도 최근 질문을 복원하고 만료되면 말풍선도 지워요", async () => {
  const storage = memory();
  const now = 1_000_000;
  const question = "등록되지 않은 비밀 강의실";
  const unknown = mergeConversation(question, await ask(question), null, find, now, "turn-empty");
  saveConversation(storage, unknown.context);
  const restored = await restoreConversation(storage, async (id) => find(id), now + 1000);
  assert.equal(restored?.context.lastQuestion, question);
  storage.setItem("campass-chat-v1", JSON.stringify({ entries: [{ role: "user", text: question }], local: "" }));
  assert.equal(await restoreConversation(storage, async (id) => find(id), now + conversationLifetimeMs), null);
  assert.equal(storage.getItem("campass-chat-v1"), null);
});

test("새 대화를 시작할 때 이전 질문과 말풍선을 함께 비워요", async () => {
  const storage = memory();
  const first = mergeConversation("본관에서 혜인관", await ask("본관에서 혜인관"), null, find, Date.now(), "old-turn");
  saveConversation(storage, first.context);
  storage.setItem("campass-chat-v1", JSON.stringify({ entries: [{ role: "user", text: "이전 질문" }], local: "학교 정문" }));
  clearConversation(storage);
  assert.equal(storage.getItem(conversationStorageKey), null);
  assert.equal(storage.getItem("campass-chat-v1"), null);
  const fresh = mergeConversation("엘리베이터로 갈래요", await ask("엘리베이터로 갈래요"), null, find, Date.now(), "new-turn");
  assert.equal(fresh.context.destinationPlaceId, undefined);
  assert.equal(fresh.context.startPlaceId, undefined);
  assert.equal(fresh.context.turnId, "new-turn");
});
