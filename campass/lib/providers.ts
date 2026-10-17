import { AppError, waypoints } from "./routing.ts";
import { places, searchPlaces, type Place } from "./catalog.ts";
import { askGemini, type AskGemini, type GeminiConfig } from "./gemini.ts";
export type Candidate = {
  waypointId: string;
  confidence: number;
  direction: "forward" | "backward" | "unknown";
};
export type Recognition = {
  status: "matched" | "no_match" | "unavailable";
  candidates: Candidate[];
  message: string;
};
export type Intent = "destination" | "condition" | "next";
export type IntentResult = {
  intent: Intent;
  conditions: { elevator?: boolean };
  places: Place[];
  mode: "keyword" | "api" | "llm";
  message: string;
};

function extractConditions(query: string) {
  const conditions: IntentResult["conditions"] = {};
  // 이동 조건 표현만 조건으로 처리하고, 위치를 묻는 말은 검색어로 남김
  // '엘리베이터로'는 이동 조건. 단, 위치를 묻거나 앞·쪽·근처가 붙으면 시설 찾기
  // '엘리베이터 말고'는 검색어에서만 빼고, 켜고 끄는 건 뒤의 계단 표현으로 정함
  // 조건 표현이 여러 개면 마지막 표현 기준
  const facility = /어디|찾|위치|(?:엘리베이터|승강기)\s*(?:앞|쪽|근처)/.test(
    query,
  );
  const searchQuery = query
    .replace(
      /(?:엘리베이터|승강기)\s*(?:말고|으?로|(?:[를가]\s*)?(?:타고|이용(?:해서|해요)?|써서|필요(?:해요|해|합니다)?))|(?:휠체어|유모차|캐리어|(?<![가-힣])짐(?=이|을|은|도|\s|$|[.,!?]))(?:이라서|라서|이\s*있(?:어요|어서)|이\s*많(?:아요|아서))?|다리가\s*아파(?:요|서)?|계단\s*(?:을\s*)?(?:말고|없이|으로|타고|이용(?:해서|해요)?)|계단\s*(?:은\s*)?(?:싫(?:어요|어|습니다)?|좀)/g,
      (phrase) => {
        if (facility && /^(?:엘리베이터|승강기)\s*으?로$/.test(phrase))
          return phrase;
        if (!/말고$/.test(phrase) || phrase.startsWith("계단"))
          conditions.elevator = !/^계단\s*(?:을\s*)?(?:으로|타고|이용)/.test(
            phrase,
          );
        return " ";
      },
    )
    .replace(/\s+/g, " ")
    .trim();
  return { conditions, searchQuery };
}

export function classifyIntent(query: string, matchedPlaces?: Place[]) {
  const { conditions, searchQuery } = extractConditions(query);
  // searchPlaces('')는 전체 장소를 돌려주므로 조건만 말한 경우엔 빈 결과로 둠
  // 엘리베이터 조건이 있으면 엘리베이터 시설은 목적지에서 뺌
  const candidates = (
    matchedPlaces ?? (searchQuery ? searchPlaces(searchQuery) : [])
  ).filter((p) => conditions.elevator === undefined || p.id !== "elevator");
  const intent: Intent = candidates.length
    ? "destination"
    : conditions.elevator !== undefined
      ? "condition"
      : /여기서|다음에|이제\s*어디|어느\s*쪽|어디로\s*가야/.test(searchQuery)
        ? "next"
        : "destination";
  return { intent, conditions, places: candidates };
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
  ).filter((c) => c.confidence >= 0.7);
  return {
    status: candidates.length ? "matched" : "no_match",
    candidates,
    message: candidates.length
      ? "주변 모습과 후보 위치가 같은지 확인해 주세요."
      : "등록 사진과 비교할 단서가 부족해요. 다시 촬영하거나 직접 선택해 주세요.",
  };
}
// 규칙이 못 찾은 경우만 Gemini로 보완. 규칙의 조건과 등록 장소가 우선
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
                ? e.message.slice(0, 200)
                : "알 수 없는 오류",
    );
    return keyword;
  } finally {
    clearTimeout(timer);
  }
  const conditions = {
    ...(typeof raw.elevator === "boolean" ? { elevator: raw.elevator } : {}),
    ...keyword.conditions,
  };
  const ids = Array.isArray(raw.placeIds) ? raw.placeIds : [];
  const matched = [...new Set(ids)]
    .map((id) => places.find((p) => p.id === id))
    .filter(
      (p): p is Place =>
        !!p && (conditions.elevator === undefined || p.id !== "elevator"),
    )
    .slice(0, 5);
  const intent = (["destination", "condition", "next"] as const).find(
    (value) => value === raw.intent,
  );
  const derived: Intent = matched.length
    ? "destination"
    : conditions.elevator !== undefined
      ? "condition"
      : keyword.intent;
  const result: Intent =
    intent === "condition" && conditions.elevator === undefined
      ? derived
      : (intent ?? derived);
  if (
    !matched.length &&
    conditions.elevator === undefined &&
    result === keyword.intent
  ) {
    console.info("[gemini] 응답은 왔지만 장소 없음");
    return keyword;
  }
  return {
    intent: result,
    conditions,
    places: matched,
    mode: "llm",
    message: "질문 뜻을 해석해 찾았어요. 맞는지 확인해 주세요.",
  };
}

export async function interpretIntent(
  query: string,
  config: Config = environment(),
  ask: AskGemini = askGemini,
  timeoutMs = 3000,
): Promise<IntentResult> {
  const { searchQuery } = extractConditions(query);
  if (!config.INTENT_API_URL || !searchQuery) {
    const keyword: IntentResult = {
      ...classifyIntent(query),
      mode: "keyword",
      message: "등록된 장소명과 검색어로 찾았어요.",
    };
    const unresolved =
      keyword.intent === "destination" &&
      !keyword.places.length &&
      keyword.conditions.elevator === undefined;
    if (!unresolved || !searchQuery) return keyword;
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
        query: searchQuery,
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
