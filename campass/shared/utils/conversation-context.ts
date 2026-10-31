import type { Place } from "./catalog.ts";
import type { IntentResult } from "../types/recognition.ts";

export const conversationStorageKey = "campass-conversation-v1";
export const chatStorageKey = "campass-chat-v1";
export const conversationLifetimeMs = 30 * 60 * 1000;
const candidateLimit = 20;

export type ConversationContext = {
  startPlaceId?: string;
  destinationPlaceId?: string;
  elevator?: boolean;
  candidateIds: string[];
  pending: boolean;
  clarification?: { field: "building" | "floor"; value: string };
  turnId?: string;
  lastQuestion?: string;
  expiresAt: number;
};

type ConversationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function clearConversation(storage: ConversationStorage) {
  storage.removeItem(conversationStorageKey);
  storage.removeItem(chatStorageKey);
}

export function saveConversation(storage: ConversationStorage, context: ConversationContext | null) {
  if (!context || (!context.startPlaceId && !context.destinationPlaceId &&
      context.elevator === undefined && !context.candidateIds.length &&
      !(context.turnId && context.lastQuestion))) {
    clearConversation(storage);
    return;
  }
  storage.setItem(conversationStorageKey, JSON.stringify({ version: 1, ...context }));
}

export async function restoreConversation(
  storage: ConversationStorage,
  resolve: (id: string) => Promise<Place | true | undefined>,
  now = Date.now(),
  isCurrent = () => true,
): Promise<{ context: ConversationContext; places: Place[] } | null> {
  const stored = storage.getItem(conversationStorageKey);
  if (!stored) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("형식 오류");
    const data = value as Record<string, unknown>;
    const validId = (id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 100;
    if (data.version !== 1 || typeof data.expiresAt !== "number" ||
        !Number.isFinite(data.expiresAt) || data.expiresAt <= now ||
        data.expiresAt > now + conversationLifetimeMs ||
        (data.startPlaceId !== undefined && !validId(data.startPlaceId)) ||
        (data.destinationPlaceId !== undefined && !validId(data.destinationPlaceId)) ||
        (data.elevator !== undefined && typeof data.elevator !== "boolean") ||
        (data.turnId !== undefined && !validId(data.turnId)) ||
        (data.lastQuestion !== undefined && (typeof data.lastQuestion !== "string" ||
          !data.lastQuestion.trim() || data.lastQuestion.length > 200 || !validId(data.turnId))) ||
        typeof data.pending !== "boolean" || !Array.isArray(data.candidateIds) ||
        data.candidateIds.length > candidateLimit || !data.candidateIds.every(validId) ||
        (data.clarification !== undefined && (!data.clarification ||
          typeof data.clarification !== "object" || Array.isArray(data.clarification) ||
          !["building", "floor"].includes(String((data.clarification as Record<string, unknown>).field)) ||
          !validId((data.clarification as Record<string, unknown>).value))))
      throw new Error("형식 오류");

    const candidateIds = [...new Set(data.candidateIds as string[])];
    const ids = [...new Set([
      data.startPlaceId as string | undefined,
      data.destinationPlaceId as string | undefined,
      ...candidateIds,
    ].filter((id): id is string => Boolean(id)))];
    const resolved = await Promise.all(ids.map(async (id) => {
      try { return await resolve(id); } catch { return undefined; }
    }));
    const places = resolved.filter((place): place is Place => Boolean(place && place !== true));
    const valid = new Set(places.map((place) => place.id));
    const validStarts = new Set(ids.filter((id, index) => Boolean(resolved[index])));
    const filteredCandidates = candidateIds.filter((id) => valid.has(id));
    const clarification = data.clarification as ConversationContext["clarification"];
    const context: ConversationContext = {
      ...(validStarts.has(data.startPlaceId as string) ? { startPlaceId: data.startPlaceId as string } : {}),
      ...(valid.has(data.destinationPlaceId as string) ? { destinationPlaceId: data.destinationPlaceId as string } : {}),
      ...(typeof data.elevator === "boolean" ? { elevator: data.elevator } : {}),
      candidateIds: filteredCandidates,
      pending: Boolean(data.pending && filteredCandidates.length > 1),
      ...(data.pending && filteredCandidates.length > 1 && clarification &&
        places.some((place) => filteredCandidates.includes(place.id) &&
          place[clarification.field] === clarification.value) ? { clarification } : {}),
      ...(typeof data.turnId === "string" ? { turnId: data.turnId } : {}),
      ...(typeof data.lastQuestion === "string" ? { lastQuestion: data.lastQuestion } : {}),
      expiresAt: data.expiresAt,
    };
    if (!isCurrent()) return null;
    saveConversation(storage, context);
    return { context, places };
  } catch {
    if (isCurrent()) clearConversation(storage);
    return null;
  }
}

const compact = (value: string) => value.replace(/\s/g, "").replace(/[.!?]/g, "");

// 장소 확인 카드에 '맞아요'라고 답함
export const isConfirmation = (question: string) =>
  /^(?:네|예|응|넵|맞아요?|맞습니다|맞아|그래요|좋아요|그곳이에요|거기예요)$/.test(compact(question));

export function rememberedTurnPlaces(
  context: ConversationContext | null,
  turnId: string,
  find: (id: string) => Place | undefined,
): Place[] {
  if (!turnId || context?.turnId !== turnId) return [];
  const ids = context.pending ? context.candidateIds :
    context.destinationPlaceId ? [context.destinationPlaceId] : [];
  return ids.map(find).filter((place): place is Place => Boolean(place));
}

export function mergeConversation(
  question: string,
  result: IntentResult,
  current: ConversationContext | null,
  find: (id: string) => Place | undefined,
  now = Date.now(),
  turnId?: string,
): { result: IntentResult; context: ConversationContext } {
  const previous = current && current.expiresAt > now ? current : null;
  const oldCandidates = (previous?.candidateIds ?? []).map(find).filter((p): p is Place => Boolean(p));
  const answer = compact(question).replace(/(?:이요|이에요|예요|입니다|요)$/, "");
  const clarified = previous?.pending
    ? oldCandidates.filter((p) => answer === compact(p.building) || answer === compact(p.floor))
    : [];
  const oldDestination = previous?.destinationPlaceId ? find(previous.destinationPlaceId) : undefined;
  // 출발만 새로 알려 준 답이나 '맞아요'면 이전 목적지를 그대로 이어가요.
  const startAnswer = Boolean(result.startRequested && result.startPlaceId) && !result.places.length;
  const followup = !result.places.length && (startAnswer || isConfirmation(question) ||
    result.conditions.elevator !== undefined &&
    (result.intent === "condition" || /그럼|거기|그곳|그쪽|그대로/.test(question)));
  // '다른 곳이에요'면 방금 확인한 곳을 빼고 다시 고르게 해요.
  const rejected = result.rejected
    ? result.places.filter((p) => p.id !== previous?.destinationPlaceId) : [];
  const candidates = clarified.length ? clarified : rejected.length ? rejected : result.places.length ? result.places :
    followup ? oldCandidates.length ? oldCandidates : oldDestination ? [oldDestination] : [] : [];
  const startPlaceId = result.startRequested ? result.startPlaceId : previous?.startPlaceId;
  const elevator = result.conditions.elevator ?? previous?.elevator;
  const destinationPlaceId = candidates.length === 1 ? candidates[0].id :
    candidates.length > 1 ? undefined : result.intent === "destination" ? undefined : previous?.destinationPlaceId;
  const context: ConversationContext = {
    ...(startPlaceId ? { startPlaceId } : {}),
    ...(destinationPlaceId ? { destinationPlaceId } : {}),
    ...(elevator !== undefined ? { elevator } : {}),
    candidateIds: candidates.length > 1 ? candidates.slice(0, candidateLimit).map((p) => p.id) : [],
    pending: candidates.length > 1,
    ...(candidates.length > 1 && previous?.clarification &&
      previous.candidateIds.every((id) => candidates.some((p) => p.id === id))
      ? { clarification: previous.clarification } : {}),
    ...(turnId ? { turnId, lastQuestion: question.trim().slice(0, 200) } :
      previous?.turnId ? { turnId: previous.turnId, lastQuestion: previous.lastQuestion } : {}),
    expiresAt: now + conversationLifetimeMs,
  };
  return {
    context,
    result: {
      ...result,
      intent: candidates.length ? "destination" : result.intent,
      places: candidates,
      conditions: elevator === undefined ? {} : { elevator },
      ...(startPlaceId ? { startPlaceId, startRequested: true } : {}),
    },
  };
}

export function selectConversationPlace(
  current: ConversationContext | null,
  place: Place,
  startPlaceId?: string,
  elevator?: boolean,
  now = Date.now(),
): ConversationContext {
  return {
    ...(startPlaceId || current?.startPlaceId ? { startPlaceId: startPlaceId || current?.startPlaceId } : {}),
    destinationPlaceId: place.id,
    ...(elevator !== undefined || current?.elevator !== undefined
      ? { elevator: elevator ?? current?.elevator } : {}),
    candidateIds: [], pending: false, expiresAt: now + conversationLifetimeMs,
    ...(current?.turnId ? { turnId: current.turnId } : {}),
    ...(current?.lastQuestion ? { lastQuestion: current.lastQuestion } : {}),
  };
}
