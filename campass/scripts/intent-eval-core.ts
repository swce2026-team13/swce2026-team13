import { performance } from "node:perf_hooks";
import type { AskGemini } from "../server/integrations/gemini.ts";
import { conversationLifetimeMs, mergeConversation } from "../shared/utils/conversation-context.ts";
import { findPlace, allPlaces } from "../server/services/rooms.ts";
import { calculateRoute, startPoint } from "../shared/utils/routing.ts";
import { classifyIntent, interpretIntent, type IntentResult } from "../server/integrations/providers.ts";
import { evaluationCases, type EvaluationCase, type EvaluationCategory } from "./intent-eval-cases.ts";

export type EvaluationMode = "keyword" | "mock" | "live";
export type EvaluationRow = {
  item: EvaluationCase;
  actual: {
    intent?: string;
    startId?: string;
    destinationIds: string[];
    elevator?: boolean;
    clarify: boolean;
    mode?: string;
  };
  scores: {
    intent: boolean;
    top1: boolean | null;
    candidate: boolean | null;
    start: boolean | null;
    elevator: boolean | null;
    clarify: boolean | null;
    slots: boolean;
    full: boolean;
  };
  latencyMs: number;
  calls: number;
  fallback: boolean;
  providerError: boolean;
  error?: string;
  route?: "PASS" | "FAIL";
};

const mockAnswers: Record<string, { startPlaceId?: string; destinationPlaceIds: string[]; elevator?: boolean }> = {
  "면접 보러 왔어요": { destinationPlaceIds: ["interview"] },
  "택배 부치려고요": { destinationPlaceIds: ["facility-yudam-3"] },
  "헤인관으로 가고 싶어요": { destinationPlaceIds: ["hyein"] },
  "정문에서 공모전 발표까지 승강기로 가요": { startPlaceId: "gate", destinationPlaceIds: ["contest-final"], elevator: true },
  "301호 가고 싶어요": { destinationPlaceIds: ["hyein-301", "room-daeil-301", "room-eunju1-301"] },
};

export const mockGemini: AskGemini = async (query) => {
  if (query === "없는관 301호로 안내해 줘") return "잘못된 JSON";
  const answer = mockAnswers[query] ?? { destinationPlaceIds: [] };
  return JSON.stringify({
    intent: "destination",
    startPlaceId: answer.startPlaceId ?? null,
    destinationPlaceIds: answer.destinationPlaceIds,
    elevator: answer.elevator ?? null,
  });
};

export function validateEvaluationCases(cases: EvaluationCase[] = evaluationCases) {
  const ids = new Set<string>();
  const queries = new Set<string>();
  for (const item of cases) {
    if (ids.has(item.id)) throw new Error(`중복된 평가 ID: ${item.id}`);
    if (queries.has(item.query)) throw new Error(`중복된 평가 문장: ${item.query}`);
    ids.add(item.id);
    queries.add(item.query);
    if (!item.query.trim() || item.source !== "작성된 시뮬레이션")
      throw new Error(`평가 출처나 문장이 올바르지 않아요: ${item.id}`);
    for (const id of [...item.destinationIds, ...(item.prior?.destinationPlaceId ? [item.prior.destinationPlaceId] : []), ...item.prior?.candidateIds ?? []]) {
      if (!findPlace(id)) throw new Error(`등록되지 않은 목적지 ID: ${item.id} ${id}`);
    }
    for (const id of [item.startId, item.prior?.startPlaceId]) {
      if (id && !startPoint(id, allPlaces())) throw new Error(`등록되지 않은 출발지 ID: ${item.id} ${id}`);
    }
    if (new Set(item.destinationIds).size !== item.destinationIds.length)
      throw new Error(`중복된 정답 후보: ${item.id}`);
    if (item.unregistered && item.destinationIds.length)
      throw new Error(`미등록 질문에 등록 목적지가 있어요: ${item.id}`);
  }
  return cases.length;
}

function score(item: EvaluationCase, result: IntentResult | null, merged: ReturnType<typeof mergeConversation> | null) {
  const destinationIds = merged?.result.places.map((place) => place.id) ?? [];
  const chosen = merged?.context.destinationPlaceId ?? destinationIds[0];
  const intent = item.intent === "outside"
    ? destinationIds.length === 0
    : result?.intent === item.intent;
  const top1 = item.destinationIds.length ? item.destinationIds.includes(chosen ?? "") : null;
  const candidate = item.destinationIds.length
    ? destinationIds.some((id) => item.destinationIds.includes(id)) || Boolean(chosen && item.destinationIds.includes(chosen))
    : null;
  const start = item.startId !== undefined ? merged?.context.startPlaceId === item.startId : null;
  const elevator = item.elevator !== undefined ? merged?.context.elevator === item.elevator : null;
  const clarify = item.clarify ? merged?.context.pending === true : null;
  const noWrongPlace = item.intent === "outside" ? destinationIds.length === 0 : true;
  const slots = Boolean((top1 ?? noWrongPlace) && (start ?? true) && (elevator ?? true) && (clarify ?? true));
  const full = Boolean(intent && slots);
  return { intent: Boolean(intent), top1, candidate, start, elevator, clarify, slots, full };
}

export async function evaluateCases(
  mode: EvaluationMode,
  cases: EvaluationCase[] = evaluationCases,
  liveAsk?: AskGemini,
): Promise<EvaluationRow[]> {
  validateEvaluationCases(cases);
  if (mode === "live" && !liveAsk) throw new Error("실호출 함수가 필요해요.");
  const rows: EvaluationRow[] = [];
  for (const item of cases) {
    const now = Date.now();
    let calls = 0;
    let result: IntentResult | null = null;
    let merged: ReturnType<typeof mergeConversation> | null = null;
    let error: string | undefined;
    let providerError = false;
    let route: EvaluationRow["route"];
    const ask: AskGemini = async (...args) => {
      calls += 1;
      try {
        const answer = await (mode === "live" ? liveAsk! : mockGemini)(...args);
        try { JSON.parse(answer); } catch { providerError = true; }
        return answer;
      } catch (caught) {
        providerError = true;
        throw caught;
      }
    };
    const started = performance.now();
    let respondedAt = started;
    try {
      result = mode === "keyword"
        ? { ...classifyIntent(item.query), mode: "keyword", message: "등록된 장소명과 검색어로 찾았어요." }
        : await interpretIntent(
          item.query,
          {
            GEMINI_API_KEY: mode === "mock" ? "평가용-가상-키" : process.env.GEMINI_API_KEY,
            GEMINI_MODEL: mode === "mock" ? "평가용-가상-모델" : process.env.GEMINI_MODEL,
          },
          ask,
        );
      respondedAt = performance.now();
      merged = mergeConversation(item.query, result, item.prior ? {
        ...item.prior, expiresAt: now + conversationLifetimeMs,
      } : null, findPlace, now);
      const start = merged.context.startPlaceId;
      const destination = merged.context.destinationPlaceId;
      if (start && destination && !merged.context.pending && start !== destination) {
        try {
          calculateRoute(start, destination, merged.context.elevator ?? false, allPlaces());
          route = "PASS";
        } catch {
          route = "FAIL";
        }
      }
    } catch (caught) {
      respondedAt = performance.now();
      error = caught instanceof Error ? caught.name : "알 수 없는 오류";
    }
    const latencyMs = respondedAt - started;
    const scores = score(item, result, merged);
    rows.push({
      item,
      actual: {
        intent: result?.intent,
        startId: merged?.context.startPlaceId,
        destinationIds: merged?.result.places.map((place) => place.id) ?? [],
        elevator: merged?.context.elevator,
        clarify: merged?.context.pending ?? false,
        mode: result?.mode,
      },
      scores, latencyMs, calls,
      fallback: calls > 0 && result?.mode !== "llm",
      providerError,
      ...(error ? { error } : {}),
      ...(route ? { route } : {}),
    });
  }
  return rows;
}

export function fraction(rows: EvaluationRow[], predicate: (row: EvaluationRow) => boolean | null) {
  const eligible = rows.map(predicate).filter((value): value is boolean => value !== null);
  return { correct: eligible.filter(Boolean).length, total: eligible.length,
    rate: eligible.length ? eligible.filter(Boolean).length / eligible.length : null };
}

export function percentile(values: number[], portion: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * portion) - 1];
}

export function summarize(rows: EvaluationRow[]) {
  const byCategory = Object.fromEntries(
    [...new Set(rows.map((row) => row.item.category))].map((category) => [
      category, fraction(rows.filter((row) => row.item.category === category), (row) => row.scores.full),
    ]),
  ) as Record<EvaluationCategory, ReturnType<typeof fraction>>;
  const called = rows.filter((row) => row.calls > 0);
  const outOfScope = rows.filter((row) => row.item.intent === "outside");
  const route = rows.filter((row) => row.route);
  return {
    count: rows.length,
    full: fraction(rows, (row) => row.scores.full),
    slots: fraction(rows, (row) => row.scores.slots),
    intent: fraction(rows, (row) => row.scores.intent),
    top1: fraction(rows, (row) => row.scores.top1),
    candidate: fraction(rows, (row) => row.scores.candidate),
    start: fraction(rows, (row) => row.scores.start),
    elevator: fraction(rows, (row) => row.scores.elevator),
    clarify: fraction(rows, (row) => row.scores.clarify),
    outOfScopeWrong: { count: outOfScope.filter((row) => row.actual.destinationIds.length > 0).length, total: outOfScope.length },
    calls: called.length,
    callRate: rows.length ? called.length / rows.length : null,
    fallback: rows.filter((row) => row.fallback).length,
    fallbackRate: called.length ? rows.filter((row) => row.fallback).length / called.length : null,
    errors: rows.filter((row) => row.error || row.providerError).length,
    providerErrors: rows.filter((row) => row.providerError).length,
    compoundFinal: fraction(rows.filter((row) => row.item.category === "복합 질문"), (row) =>
      row.scores.slots && row.route === "PASS"),
    followupFinal: fraction(rows.filter((row) => row.item.category === "후속 질문"), (row) =>
      row.scores.slots && row.route === "PASS"),
    route: { passed: route.filter((row) => row.route === "PASS").length, total: route.length },
    latency: { p50: percentile(rows.map((row) => row.latencyMs), 0.5), p95: percentile(rows.map((row) => row.latencyMs), 0.95) },
    byCategory,
  };
}
