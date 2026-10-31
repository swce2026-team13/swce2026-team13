import type { Candidate, Recognition, Intent, IntentResult } from "../../shared/types/recognition.ts";
export type { Candidate, Recognition, Intent, IntentResult } from "../../shared/types/recognition.ts";
import { AppError, waypoints } from "../../shared/utils/routing.ts";
import { places, type Place } from "../../shared/utils/catalog.ts";
import { findPlace } from "../services/rooms.ts";
import { askGemini, type AskGemini, type GeminiConfig, type GeminiIntentResponse } from "./gemini.ts";
import { graphNodes } from "../../shared/utils/campus3d/route.ts";
import {
  hasDestinationRequest,
  resolveIntentPlaces,
  resolveStartPoint,
  shouldComplementIntent,
  splitJourney,
} from "../services/intent-analysis.ts";
const geminiTimeoutMs = 3000;
const geminiCandidateLimit = 5;
const retrySearchMessage = "질문을 이해하지 못했어요. 장소 이름으로 다시 검색해 주세요.";

const elevatorTravel =
  /(?:엘리베이터|승강기)\s*(?:말고|으?로|(?:[를가]\s*)?(?:타고|이용(?:해서|해요)?|써서|필요(?:해요|해|합니다)?))/;
const mobilityAid =
  /(?:휠체어|유모차|캐리어|(?<![가-힣])짐(?=이|을|은|도|\s|$|[.,!?]))(?:이라서|라서|이\s*있(?:어요|어서)|이\s*많(?:아요|아서))?/;
const legPain = /다리가\s*아파(?:요|서)?/;
const stairsTravel =
  /계단\s*(?:을\s*)?(?:말고|없이|으로|타고|이용(?:해서|해요)?)/;
const stairsDiscomfort = /계단\s*(?:은\s*)?(?:싫(?:어요|어|습니다)?|좀)/;
const travelConditions = new RegExp(
  [elevatorTravel, mobilityAid, legPain, stairsTravel, stairsDiscomfort]
    .map((pattern) => pattern.source)
    .join("|"),
  "g",
);

function extractConditions(query: string) {
  const conditions: IntentResult["conditions"] = {};
  // 시설 위치 질문은 검색어로 남기고, 이동 조건은 문장에 나온 순서대로 적용한다.
  const facility = /(?:엘리베이터|승강기)\s*(?:앞|쪽|근처|(?:으?로\s*)?(?:어디|위치|찾))/.test(
    query,
  );
  const searchQuery = query
    .replace(travelConditions, (phrase) => {
      if (facility && /^(?:엘리베이터|승강기)\s*으?로$/.test(phrase))
        return phrase;
      // '엘리베이터 말고'는 제거만 하고 조건을 바꾸지 않는다.
      if (!/말고$/.test(phrase) || phrase.startsWith("계단"))
        conditions.elevator = !/^계단\s*(?:을\s*)?(?:으로|타고|이용)/.test(
          phrase,
        );
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { conditions, searchQuery };
}

export function classifyIntent(query: string, matchedPlaces?: Place[]) {
  const { conditions, searchQuery } = extractConditions(query);
  const journey = splitJourney(searchQuery);
  // 출발 지점만 답한 경우(예: 출발을 묻자 '학교 정문')는 출발만 바꿔요.
  const startOnly = journey ? undefined : resolveStartPoint(searchQuery);
  const destinationText = journey?.destination ?? searchQuery;
  // 출발 지점은 도착지로 해석하지 않아요.
  const local = searchQuery && !startOnly && !resolveStartPoint(destinationText)
    ? resolveIntentPlaces(destinationText) : { places: [], exact: false };
  const candidates = (startOnly || (journey && resolveStartPoint(destinationText)) ? [] :
    (journey && local.exact ? local.places : matchedPlaces) ?? local.places)
    .filter((p) => conditions.elevator === undefined || p.id !== "elevator");
  const starts = journey ? resolveIntentPlaces(journey.start).places : [];
  const startPlaceId = starts.length === 1 ? starts[0].id
    : journey && !starts.length ? resolveStartPoint(journey.start)?.routeId
      : startOnly?.routeId;
  const intent: Intent = candidates.length || journey || startOnly
    ? "destination"
    : conditions.elevator !== undefined && !hasDestinationRequest(searchQuery)
      ? "condition"
      : /여기서|다음에|이제\s*어디|어느\s*쪽|어디로\s*가야/.test(searchQuery)
        ? "next" : "destination";
  return {
    intent, conditions, places: candidates,
    ...(journey || startOnly ? { startRequested: true, ...(startPlaceId ? { startPlaceId } : {}) } : {}),
  };
}
type Config = {
  VISION_API_URL?: string;
  VISION_API_KEY?: string;
  INTENT_API_URL?: string;
  INTENT_API_KEY?: string;
} & GeminiConfig;
function environment(): Config {
  return {
    VISION_API_URL: process.env.VISION_API_URL,
    VISION_API_KEY: process.env.VISION_API_KEY,
    INTENT_API_URL: process.env.INTENT_API_URL,
    INTENT_API_KEY: process.env.INTENT_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError(
      "AI 응답 형식이 올바르지 않아요.",
      502,
      "PROVIDER_INVALID",
    );
  return value as Record<string, unknown>;
}
export function validatePrediction(value: unknown): Candidate[] {
  const raw = object(value).candidates;
  if (!Array.isArray(raw) || raw.length > 5)
    throw new AppError(
      "AI 후보 응답이 올바르지 않아요.",
      502,
      "PROVIDER_INVALID",
    );
  const seen = new Set<string>();
  return raw
    .map((value) => {
      const c = object(value);
      if (
        typeof c.waypointId !== "string" ||
        !waypoints.some((w) => w.id === c.waypointId) ||
        seen.has(c.waypointId) ||
        typeof c.confidence !== "number" ||
        !Number.isFinite(c.confidence) ||
        c.confidence < 0 ||
        c.confidence > 1 ||
        !["forward", "backward", "unknown"].includes(String(c.direction))
      )
        throw new AppError(
          "AI 후보 값이 올바르지 않아요.",
          502,
          "PROVIDER_INVALID",
        );
      seen.add(c.waypointId);
      return c as Candidate;
    })
    .sort((a, b) => b.confidence - a.confidence);
}
async function provider(
  url: string,
  key: string | undefined,
  body: BodyInit,
  json = false,
) {
  const endpoint = new URL(url);
  if (
    endpoint.protocol !== "https:" &&
    !(
      ["localhost", "127.0.0.1"].includes(endpoint.hostname) &&
      endpoint.protocol === "http:"
    )
  )
    throw new AppError(
      "AI 서버 주소는 HTTPS가 필요합니다.",
      503,
      "PROVIDER_CONFIG",
    );
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(json ? { "Content-Type": "application/json" } : {}),
      },
      body,
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok)
      throw new AppError(
        "AI 서버가 응답하지 않아요. 직접 선택해 주세요.",
        502,
        "PROVIDER_FAILURE",
      );
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      "AI 연결을 완료하지 못했어요. 직접 선택해 주세요.",
      502,
      "PROVIDER_FAILURE",
    );
  }
}
export async function recognizePhoto(
  image: Blob,
  config: Config = environment(),
): Promise<Recognition> {
  if (!config.VISION_API_URL)
    return {
      status: "unavailable",
      candidates: [],
      message:
        "사진 인식 기능을 준비하고 있어요. 출발 위치를 직접 선택해 주세요.",
    };
  const form = new FormData();
  form.append("image", image, "capture.jpg");
  form.append("campusId", "seokyeong");
  const candidates = validatePrediction(
    await provider(config.VISION_API_URL, config.VISION_API_KEY, form),
  ).filter((c) => c.confidence >= 0.75);
  return {
    status: candidates.length ? "matched" : "no_match",
    candidates,
    message: candidates.length
      ? "주변 모습과 후보 위치가 같은지 확인해 주세요."
      : "등록 사진과 비교할 단서가 부족해요. 다시 촬영하거나 직접 선택해 주세요.",
  };
}
// 문장 전체를 보완하되 명확한 출발지·목적지·이동 조건은 유지해요.
async function complementWithGemini(
  query: string,
  keyword: IntentResult,
  config: Config,
  ask: AskGemini,
  timeoutMs: number,
): Promise<IntentResult> {
  const controller = new AbortController();
  const timeout = new Error("timeout");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let raw: Record<string, unknown>;
  try {
    const text = await Promise.race([
      ask(query, config, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(timeout);
        }, timeoutMs);
      }),
    ]);
    raw = object(JSON.parse(text));
  } catch (e) {
    // 오류·한도 초과(429)·타임아웃·잘못된 JSON이면 키워드 결과 유지
    // 로그에는 이유만 남기고 API 키와 사용자 문장은 남기지 않음
    const status = (e as { status?: unknown } | null)?.status;
    console.warn(
      "[gemini] 키워드 검색으로 대체:",
      e === timeout
        ? "timeout"
        : e instanceof SyntaxError
          ? "JSON 파싱 실패"
          : e instanceof AppError
            ? "JSON 형식 오류"
            : typeof status === "number"
              ? `HTTP ${status}`
              : e instanceof Error
                ? "연결 오류"
                : "알 수 없는 오류",
    );
    return keyword.places.length ? keyword : { ...keyword, message: retrySearchMessage };
  } finally {
    clearTimeout(timer);
  }
  const ids = "destinationPlaceIds" in raw ? raw.destinationPlaceIds : raw.placeIds;
  if (!Array.isArray(ids) || ids.length > geminiCandidateLimit ||
      !ids.every((id) => typeof id === "string") ||
      ("destinationPlaceIds" in raw && "placeIds" in raw &&
        JSON.stringify(raw.destinationPlaceIds) !== JSON.stringify(raw.placeIds)) ||
      !["destination", "condition", "next"].includes(String(raw.intent)) ||
      (raw.elevator !== undefined && raw.elevator !== null && typeof raw.elevator !== "boolean") ||
      (raw.startPlaceId !== undefined && raw.startPlaceId !== null && typeof raw.startPlaceId !== "string"))
  {
    console.warn("[gemini] 키워드 검색으로 대체: 응답 검증 실패");
    return keyword.places.length ? keyword : { ...keyword, message: retrySearchMessage };
  }
  const parsed: GeminiIntentResponse = {
    intent: raw.intent as GeminiIntentResponse["intent"],
    startPlaceId: typeof raw.startPlaceId === "string" ? raw.startPlaceId : null,
    destinationPlaceIds: ids,
    elevator: typeof raw.elevator === "boolean" ? raw.elevator : null,
  };
  const { searchQuery } = extractConditions(query);
  if (parsed.intent === "next" && !/다음|이제|어디로\s*가야/.test(searchQuery))
    return keyword;
  const conditions = {
    ...(typeof parsed.elevator === "boolean" ? { elevator: parsed.elevator } : {}),
    ...keyword.conditions,
  };
  const matched = [...new Set(parsed.destinationPlaceIds)]
    .map((id) => findPlace(id))
    .filter((p): p is Place => !!p && (conditions.elevator === undefined || p.id !== "elevator"))
    .slice(0, geminiCandidateLimit);
  const journey = splitJourney(searchQuery);
  const local = resolveIntentPlaces(journey?.destination ?? searchQuery);
  const destination = local.exact && !/말고|아니|근처|가까운|중에서/.test(query) ? keyword.places : matched;
  if (keyword.places.length && destination.some((place) =>
    !keyword.places.some((known) => known.id === place.id))) {
    console.warn("[gemini] 키워드 검색으로 대체: 장소 후보 충돌");
    return keyword;
  }
  const rawStart = parsed.startPlaceId ?? undefined;
  const validStart = rawStart && (findPlace(rawStart) || graphNodes.includes(rawStart) || waypoints.some((w) => w.id === rawStart))
    ? rawStart : undefined;
  if (rawStart && !validStart) return keyword;
  const startPlaceId = keyword.startPlaceId ?? validStart;
  if (!destination.length && conditions.elevator === undefined && raw.intent === keyword.intent && !startPlaceId) {
    console.info("[gemini] 응답은 왔지만 장소 없음");
    return keyword;
  }
  if (!destination.length && keyword.intent === "destination" && raw.intent !== "next") return keyword;
  return {
    intent: destination.length ? "destination" : raw.intent as Intent,
    conditions,
    places: destination,
    ...(startPlaceId ? { startPlaceId } : {}),
    ...(keyword.startRequested || startPlaceId ? { startRequested: true } : {}),
    mode: "llm",
    message: "질문 뜻을 해석해 찾았어요. 맞는지 확인해 주세요.",
  };
}

export async function interpretIntent(
  query: string,
  config: Config = environment(),
  ask: AskGemini = askGemini,
  timeoutMs = geminiTimeoutMs,
): Promise<IntentResult> {
  const { searchQuery } = extractConditions(query);
  if (!config.INTENT_API_URL || !searchQuery) {
    const keyword: IntentResult = {
      ...classifyIntent(query),
      mode: "keyword",
      message: "등록된 장소명과 검색어로 찾았어요.",
    };
    if (!keyword.places.length && keyword.intent === "destination")
      keyword.message = "등록된 장소를 찾지 못했어요. 장소 이름으로 다시 검색해 주세요.";
    if (!keyword.places.length && (
      /^(?:오늘\s*)?(?:날씨|기온|미세먼지|환율|뉴스|주식)/.test(searchQuery) ||
      /[가-힣]{2,}역(?:으로|까지|에서|가는|가고|$|\s)/.test(searchQuery)
    ))
      return keyword;
    if (!shouldComplementIntent(query, searchQuery, keyword)) return keyword;
    if (!config.GEMINI_API_KEY || !config.GEMINI_MODEL) {
      console.warn(
        `[gemini] 건너뜀: ${config.GEMINI_API_KEY ? "GEMINI_MODEL" : "GEMINI_API_KEY"} 없음`,
      );
      return keyword;
    }
    return complementWithGemini(query, keyword, config, ask, timeoutMs);
  }
  const raw = object(
    await provider(
      config.INTENT_API_URL,
      config.INTENT_API_KEY,
      JSON.stringify({
        query: splitJourney(searchQuery)?.destination ?? searchQuery,
        campusId: "seokyeong",
        places: places.map((p) => ({
          id: p.id,
          name: p.name,
          building: p.building,
          floor: p.floor,
        })),
      }),
      true,
    ),
  );
  if (
    !Array.isArray(raw.placeIds) ||
    raw.placeIds.length > 10 ||
    !raw.placeIds.every(
      (id) => typeof id === "string" && places.some((p) => p.id === id),
    )
  )
    throw new AppError(
      "목적지 해석 응답이 올바르지 않아요.",
      502,
      "PROVIDER_INVALID",
    );
  return {
    ...classifyIntent(
      query,
      [...new Set(raw.placeIds)].map((id) => places.find((p) => p.id === id)!),
    ),
    mode: "api",
    message: "목적지 후보를 확인해 주세요.",
  };
}
