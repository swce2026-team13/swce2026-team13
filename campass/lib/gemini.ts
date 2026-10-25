import { places } from "./catalog.ts";
import { facilityPlaces, floorPlaces } from "./rooms.ts";

// 서버 전용(GEMINI_API_KEY 사용). 화면 코드에서는 providers.ts의 타입만 가져다 씀
export type GeminiConfig = { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };
export type GeminiIntentResponse = {
  intent: "destination" | "condition" | "next";
  startPlaceId: string | null;
  destinationPlaceIds: string[];
  elevator: boolean | null;
};
export type AskGemini = (
  query: string,
  config: GeminiConfig,
  signal: AbortSignal,
) => Promise<string>;

// 호실은 넣지 않음. 넣으면 보내는 양이 너무 커짐
export const geminiCatalog = [...places, ...facilityPlaces()].map((p) => ({
  id: p.id,
  name: p.name,
  aliases: p.aliases,
  building: p.building,
  floor: p.floor,
  ...(p.kind ? { kind: p.kind } : {}),
}));

const instruction = `당신은 서경대학교 캠퍼스 길찾기 앱의 질문 해석기입니다.
사용자 문장을 읽고 아래 장소 목록 안에서만 목적지 id를 고르세요.
목록에 없는 장소는 만들지 말고, 알 수 없으면 destinationPlaceIds를 빈 배열로 두세요.
에서·부터 앞은 출발지(startPlaceId), 까지·로 앞은 목적지(destinationPlaceIds)로 구분하세요. 출발지 언급이 없으면 null입니다.
계단 없이·휠체어는 elevator=true입니다. 출발지를 목적지 후보에 넣지 마세요. 경로 자체는 만들지 마세요.
배고파요는 식당, 커피는 카페처럼 상황으로 말해도 목록 안에서 고르세요.
intent는 목적지를 찾으면 "destination", 이동 조건(엘리베이터·계단)만 말하면 "condition", 지금 위치에서 다음 이동을 물으면 "next"입니다.
elevator는 엘리베이터를 원하면 true, 계단을 원하면 false, 언급이 없으면 null입니다.
장소 목록(JSON): ${JSON.stringify(geminiCatalog)}
등록된 건물 층(JSON): ${JSON.stringify(floorPlaces().map(({ id, name }) => ({ id, name })))}`;

const schema = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["destination", "condition", "next"] },
    startPlaceId: { type: ["string", "null"] },
    destinationPlaceIds: { type: "array", items: { type: "string" }, maxItems: 5 },
    elevator: { type: ["boolean", "null"] },
  },
  required: ["intent", "startPlaceId", "destinationPlaceIds", "elevator"],
};

// 사용자 문장만 보내고, 장소 목록은 시스템 지시에 넣어 둠
export const askGemini: AskGemini = async (query, config, signal) => {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: config.GEMINI_MODEL!,
    contents: query,
    config: {
      systemInstruction: instruction,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0,
      abortSignal: signal,
    },
  });
  return response.text ?? "";
};
