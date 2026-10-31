import test from "node:test";
import assert from "node:assert/strict";
import { interpretIntent } from "../server/integrations/providers.ts";
import { calculateRoute } from "../shared/utils/routing.ts";
import { allPlaces, findPlace } from "../server/services/rooms.ts";
import { createIntentRequest } from "../shared/utils/intent-request.ts";
import { mergeConversation } from "../shared/utils/conversation-context.ts";
import type { IntentResult } from "../server/integrations/providers.ts";

const config = { GEMINI_API_KEY: "시험용", GEMINI_MODEL: "시험용" };
const answer = (value: unknown) => async () => JSON.stringify(value);

test("연속 질문에서 늦은 응답과 화면을 떠난 뒤 응답은 결과를 덮지 않아요", async () => {
  const pending = new Map<string, (result: IntentResult) => void>();
  const requests = createIntentRequest((query) => new Promise((resolve) => pending.set(query, resolve)));
  const old = requests.run("이전 질문");
  const latest = requests.run("최근 질문");
  const result = await interpretIntent("면접", {});
  pending.get("최근 질문")!(result);
  assert.equal(await latest, result);
  pending.get("이전 질문")!({ ...result, places: [] });
  assert.equal(await old, null);
  const leaving = requests.run("화면 이동");
  requests.cancel();
  pending.get("화면 이동")!(result);
  assert.equal(await leaving, null);
});

test("연속 요청은 이전 호출을 취소하고 같은 질문은 한 번만 보내요", async () => {
  const pending = new Map<string, (result: IntentResult) => void>();
  const signals = new Map<string, AbortSignal>();
  let calls = 0;
  const requests = createIntentRequest((query, signal) => {
    calls++;
    signals.set(query, signal);
    return new Promise<IntentResult>((resolve) => pending.set(query, resolve));
  });
  const first = requests.run("혜인관 어디예요?");
  const second = requests.run("한림관 6층 가고 싶어요");
  const duplicate = requests.run("한림관 6층 가고 싶어요");
  assert.equal(calls, 2);
  assert.equal(signals.get("혜인관 어디예요?")?.aborted, true);
  const result = await interpretIntent("한림관 6층 가고 싶어요", {});
  pending.get("한림관 6층 가고 싶어요")!(result);
  assert.equal(await second, result);
  assert.equal(await duplicate, result);
  pending.get("혜인관 어디예요?")!(result);
  assert.equal(await first, null);

  const stale = requests.run("초기화 전 질문");
  requests.cancel();
  assert.equal(signals.get("초기화 전 질문")?.aborted, true);
  pending.get("초기화 전 질문")!(result);
  assert.equal(await stale, null);
});

test("동기 오류 뒤 같은 질문을 다시 보낼 수 있어요", async () => {
  const result = await interpretIntent("혜인관", {});
  let calls = 0;
  const requests = createIntentRequest(() => {
    calls++;
    if (calls === 1) throw new Error("일시적 실패");
    return Promise.resolve(result);
  });
  await assert.rejects(requests.run("혜인관"), /일시적 실패/);
  assert.equal(await requests.run("혜인관"), result);
  assert.equal(calls, 2);
});

test("명확한 호실·조건·면접 질문은 외부 호출 없이 처리해요", async () => {
  for (const [query, destination, elevator] of [
    ["혜인관 301호 어디예요?", "hyein-301", undefined],
    ["엘리베이터로 가고 싶어요", undefined, true],
    ["면접 보러 왔어요", "interview", undefined],
    ["엘리베이터로 면접장 가고 싶어요", "interview", true],
    ["휠체어 타고 면접장 가려고요", "interview", true],
  ] as const) {
    let calls = 0;
    const result = await interpretIntent(query, config, async () => { calls++; return "{}"; });
    assert.equal(calls, 0, query);
    assert.equal(result.places[0]?.id, destination, query);
    assert.equal(result.conditions.elevator, elevator, query);
  }
});

test("복합 질문은 출발·도착·조건을 나누고 명확한 규칙을 유지해요", async () => {
  for (const [query, start, destination, elevator] of [
    ["한림관 6층에서 은주1관 5층까지", "hallim|6", "eunju1|5", undefined],
    ["본관에서 혜인관까지 계단 없이", "bon", "hyein", true],
  ] as const) {
    let calls = 0;
    const result = await interpretIntent(query, config, async () => {
      calls++;
      return JSON.stringify({ intent: "destination", startPlaceId: "yudam", destinationPlaceIds: ["bon"], elevator: false });
    });
    assert.equal(calls, 1);
    assert.equal(result.startPlaceId, start);
    assert.equal(result.places[0].id, destination);
    if (elevator !== undefined) assert.equal(result.conditions.elevator, elevator);
    const route = calculateRoute(start, destination, result.conditions.elevator ?? true, allPlaces());
    assert.ok(route.steps.length > 0);
  }
});

test("이동 조건이 있어도 모르는 목적지는 한 번 보완해요", async () => {
  const result = await interpretIntent("엘리베이터로 학생들 시험 보는 곳 알려줘", config,
    answer({ intent: "destination", startPlaceId: null, destinationPlaceIds: ["interview"], elevator: false }));
  assert.equal(result.places[0]?.id, "interview");
  assert.equal(result.conditions.elevator, true);
  assert.equal(result.mode, "llm");
});

test("부분 일치 후보는 문장 전체 의미로 좁히고 모호한 호실은 선택을 남겨요", async () => {
  const result = await interpretIntent("커피 마시고 싶은데 도서관 근처로", config,
    answer({ intent: "destination", startPlaceId: null, destinationPlaceIds: ["facility-yudam-4"], elevator: null }));
  assert.equal(result.mode, "llm");
  assert.deepEqual(result.places.map((p) => p.id), ["facility-yudam-4"]);
  const rooms = await interpretIntent("301호 가고 싶어요", config, async () => {
    assert.fail("건물을 모르는 호실을 임의로 좁히면 안 돼요");
  });
  assert.ok(new Set(rooms.places.map((p) => p.building)).size > 1);
});

test("키가 없거나 응답이 실패해도 복합 질문의 규칙 결과를 유지해요", async () => {
  const query = "한림관 6층에서 은주1관 5층까지";
  const keyword = await interpretIntent(query, {}, async () => { throw new Error("호출하면 안 돼요"); });
  for (const ask of [async () => { throw new Error("연결 실패"); }, async () => "{", () => new Promise<string>(() => {})])
    assert.deepEqual(await interpretIntent(query, config, ask, 10), keyword);
  assert.equal(keyword.startPlaceId, "hallim|6");
});

test("등록되지 않은 장소·층과 잘못된 필드는 길찾기에 전달하지 않아요", async () => {
  const query = "학생들 시험 보는 곳 알려줘";
  const keyword = await interpretIntent(query, {});
  for (const value of [
    { intent: "destination", startPlaceId: "hallim|99", destinationPlaceIds: ["interview"], elevator: null },
    { intent: "destination", startPlaceId: null, destinationPlaceIds: ["없는장소"], elevator: null },
    { intent: "destination", startPlaceId: 3, destinationPlaceIds: ["interview"], elevator: null },
    { intent: "destination", startPlaceId: null, destinationPlaceIds: "interview", elevator: null },
    { intent: "destination", startPlaceId: null, destinationPlaceIds: ["interview"], elevator: "true" },
  ]) {
    const result = await interpretIntent(query, config, answer(value));
    assert.equal(result.mode, keyword.mode);
    assert.deepEqual(result.places, keyword.places);
    assert.equal(result.startPlaceId, keyword.startPlaceId);
    assert.deepEqual(result.conditions, keyword.conditions);
  }
  assert.equal(findPlace("hallim|99"), undefined);
  assert.equal((await interpretIntent("혜인관 999호 어디예요", {})).places.length, 0);
  const deduplicated = await interpretIntent(query, config,
    answer({ intent: "destination", startPlaceId: null, destinationPlaceIds: ["interview", "interview", "없는장소"], elevator: null }));
  assert.deepEqual(deduplicated.places.map((p) => p.id), ["interview"]);
});

test("같은 출발·도착 층도 기존 계산기의 도착 상태를 유지해요", async () => {
  const result = await interpretIntent("한림관 6층에서 한림관 6층까지", {});
  assert.equal(result.startPlaceId, result.places[0].id);
  const route = calculateRoute(result.startPlaceId!, result.places[0].id, true, allPlaces());
  assert.equal(route.steps.length, 1);
});

test("출발 지점을 글로 쓰면 지도 출발 id로 연결하고 도착지로 쓰지 않아요", async () => {
  for (const [query, start, destination] of [
    ["정문에서 혜인관", "gate", "hyein"],
    ["2115번 정류장에서 본관까지", "bus_stop_2115", "bon"],
  ] as const) {
    const result = await interpretIntent(query, {});
    assert.equal(result.startPlaceId, start, query);
    assert.equal(result.startRequested, true, query);
    assert.deepEqual(result.places.map((p) => p.id), [destination], query);
    // 길찾기 화면은 이 id를 start로 그대로 받아 경로를 계산해요.
    assert.ok(calculateRoute(start, destination, true, allPlaces()).steps.length > 0, query);
  }
  const reverse = await interpretIntent("혜인관에서 정문", {});
  assert.equal(reverse.startPlaceId, "hyein");
  assert.deepEqual(reverse.places, []);
});

test("출발을 묻는 차례에 출발 지점만 답하면 출발만 바꾸고 목적지는 이어가요", async () => {
  const destination = findPlace("hyein")!;
  const asked = mergeConversation("혜인관", await interpretIntent("혜인관", {}), null,
    (id) => (id === destination.id ? destination : undefined), 0);
  const answer = await interpretIntent("학교 정문", config, async () => {
    assert.fail("출발 지점만 답한 문장은 외부 해석을 부르지 않아요");
  });
  assert.equal(answer.startPlaceId, "gate");
  assert.equal(answer.startRequested, true);
  assert.deepEqual(answer.places, []);
  const merged = mergeConversation("학교 정문", answer, asked.context,
    (id) => (id === destination.id ? destination : undefined), 1);
  assert.equal(merged.context.startPlaceId, "gate");
  assert.equal(merged.context.destinationPlaceId, "hyein");
  assert.deepEqual(merged.result.places.map((p) => p.id), ["hyein"]);
});

test("화살표나 띄어쓰기만 있어도 건물 사이 출발·도착을 나눠요", async () => {
  for (const query of ["본관 ↔ 혜인관", "본관 → 혜인관", "본관 -> 혜인관", "본관 ~ 혜인관", "본관 혜인관"]) {
    const result = await interpretIntent(query, {});
    assert.equal(result.startPlaceId, "bon", query);
    assert.deepEqual(result.places.map((p) => p.id), ["hyein"], query);
  }
});

test("출발·도착 표현을 넓혀도 기존 문장은 나누지 않아요", async () => {
  const condition = await interpretIntent("엘리베이터로 갈래요", {});
  assert.equal(condition.intent, "condition");
  assert.equal(condition.conditions.elevator, true);
  assert.equal(condition.startRequested, undefined);
  const room = await interpretIntent("혜인관 301호 어디예요?", {});
  assert.deepEqual(room.places.map((p) => p.id), ["hyein-301"]);
  assert.equal(room.startRequested, undefined);
  assert.equal(room.startPlaceId, undefined);
});
