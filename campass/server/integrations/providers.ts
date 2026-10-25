import { AppError, waypoints } from "../../shared/utils/routing.ts";
import { places, searchPlaces } from "../../shared/utils/catalog.ts";
import type { Candidate, Recognition } from "../../shared/types/recognition.ts";
export type { Candidate, Recognition } from "../../shared/types/recognition.ts";
type Config = {
  VISION_API_URL?: string;
  VISION_API_KEY?: string;
  INTENT_API_URL?: string;
  INTENT_API_KEY?: string;
};
function environment(): Config {
  return {
    VISION_API_URL: process.env.VISION_API_URL,
    VISION_API_KEY: process.env.VISION_API_KEY,
    INTENT_API_URL: process.env.INTENT_API_URL,
    INTENT_API_KEY: process.env.INTENT_API_KEY,
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
export async function interpretIntent(
  query: string,
  config: Config = environment(),
) {
  if (!config.INTENT_API_URL)
    return {
      mode: "keyword",
      places: searchPlaces(query),
      message: "등록된 장소명과 검색어로 찾았어요.",
    };
  const raw = object(
    await provider(
      config.INTENT_API_URL,
      config.INTENT_API_KEY,
      JSON.stringify({
        query,
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
    mode: "api",
    places: [...new Set(raw.placeIds)].map((id) =>
      places.find((p) => p.id === id)!,
    ),
    message: "목적지 후보를 확인해 주세요.",
  };
}
