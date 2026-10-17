import { places } from "./catalog.ts";

// 서버 전용(GEMINI_API_KEY 사용). 화면 코드에서는 providers.ts의 타입만 가져다 씀
export type GeminiConfig = { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };
export type AskGemini = (
  query: string,
  config: GeminiConfig,
  signal: AbortSignal,
) => Promise<string>;

const catalog = places.map((p) => ({
  id: p.id,
  name: p.name,
  aliases: p.aliases,
  building: p.building,
  floor: p.floor,
}));

const instruction = `당신은 서경대학교 캠퍼스 길찾기 앱의 질문 해석기입니다.
사용자 문장을 읽고 아래 장소 목록 안에서만 목적지 id를 고르세요.
목록에 없는 장소는 만들지 말고, 알 수 없으면 placeIds를 빈 배열로 두세요.
intent는 목적지를 찾으면 "destination", 이동 조건(엘리베이터·계단)만 말하면 "condition", 지금 위치에서 다음 이동을 물으면 "next"입니다.
elevator는 엘리베이터를 원하면 true, 계단을 원하면 false, 언급이 없으면 null입니다.
장소 목록(JSON): ${JSON.stringify(catalog)}`;

const schema = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["destination", "condition", "next"] },
    placeIds: { type: "array", items: { type: "string" } },
    elevator: { type: ["boolean", "null"] },
  },
  required: ["intent", "placeIds", "elevator"],
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
