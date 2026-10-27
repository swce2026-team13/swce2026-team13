import { setTimeout } from "node:timers/promises";
import { interpretIntent, type IntentResult } from "../lib/providers.ts";
import { allPlaces } from "../lib/rooms.ts";

type Example = {
  query: string;
  intent: "destination" | "condition" | "next" | "outside";
  ids?: string[];
  elevator?: boolean;
};

const examples: Example[] = [
  { query: "면접 보러 왔어요", intent: "destination", ids: ["interview"] },
  { query: "혜인관 301호 어디예요?", intent: "destination", ids: ["hyein-301"] },
  { query: "공모전 발표 보러 왔어요", intent: "destination", ids: ["contest-final"] },
  { query: "본관 가는 길 알려 주세요", intent: "destination", ids: ["bon"] },
  { query: "유담관 529 어디예요?", intent: "destination", ids: ["room-yudam-529"] },
  { query: "주차장 어디예요", intent: "destination", ids: ["parking"] },
  { query: "스콘스퀘어 가고 싶어요", intent: "destination", ids: ["스콘스퀘어"] },
  { query: "카페 로렐", intent: "destination", ids: ["facility-yudam-4"] },
  { query: "편의점 가고 싶어요", intent: "destination", ids: ["facility-bukak-1", "facility-yudam-5", "facility-chungwoon-1"] },
  { query: "시청각실 가야 해요", intent: "destination", ids: ["hyein-av1", "hyein-av2", "hyein-av3", "hyein-av4"] },
  { query: "결선 어디서 해요?", intent: "destination", ids: ["contest-final"] },
  { query: "총장실 있는 건물 가려고요", intent: "destination", ids: ["bon"] },
  { query: "차 어디에 세워요?", intent: "destination", ids: ["parking"] },
  { query: "배고파요 밥 먹을 데 있어요?", intent: "destination", ids: ["facility-yudam-6", "facility-chungwoon-3", "facility-chungwoon-4", "facility-hallim-1"] },
  { query: "커피 마시고 싶어요", intent: "destination", ids: ["facility-daeil-1", "facility-yudam-4", "facility-eunju2-1"] },
  { query: "음료수 살 곳 있어요?", intent: "destination", ids: ["facility-bukak-1", "facility-yudam-5", "facility-chungwoon-1"] },
  { query: "입시 보러 왔는데 기다리는 곳 어디예요?", intent: "destination", ids: ["interview"] },
  { query: "책이랑 문구 사려면 어디로 가요?", intent: "destination", ids: ["facility-chungwoon-6"] },
  { query: "은행 업무 보려고요", intent: "destination", ids: ["facility-yudam-2"] },
  { query: "택배 부치려고요", intent: "destination", ids: ["facility-yudam-3"] },
  { query: "운동할 수 있는 곳", intent: "destination", ids: ["facility-suin-1", "facility-yudam-1", "suin"] },
  { query: "심장 제세동기 어디 있어요?", intent: "destination", ids: ["facility-bukak-3", "facility-yudam-8", "facility-yudam-9", "facility-chungwoon-7", "facility-hyein-1"] },
  { query: "햄버거 먹고 싶어요", intent: "destination", ids: ["facility-chungwoon-3"] },
  { query: "우동 파는 데", intent: "destination", ids: ["facility-chungwoon-4"] },
  { query: "엘리베이터로 가고 싶어요", intent: "condition", elevator: true },
  { query: "계단으로 갈게요", intent: "condition", elevator: false },
  { query: "휠체어라서 계단은 못 가요", intent: "condition", elevator: true },
  { query: "엘리베이터로 면접장 어디예요?", intent: "destination", ids: ["interview"], elevator: true },
  { query: "여기서 어디로 가야 돼요?", intent: "next" },
  { query: "다음엔 어느 쪽으로 가요?", intent: "next" },
  { query: "강남역 가는 법", intent: "outside" },
  { query: "오늘 날씨 어때요", intent: "outside" },
];

// 평가 기준도 현재 등록된 장소만 사용해요.
const registered = new Set(allPlaces().map((place) => place.id));
for (const example of examples) {
  for (const id of example.ids ?? []) {
    if (!registered.has(id)) throw new Error(`평가 기준에 등록되지 않은 장소가 있어요: ${id}`);
  }
}

function correct(example: Example, result: IntentResult | null) {
  if (!result) return false;
  if (example.intent === "outside") return result.places.length === 0;
  if (result.intent !== example.intent) return false;
  if (example.elevator !== undefined && result.conditions.elevator !== example.elevator) return false;
  return example.intent !== "destination" || Boolean(example.ids?.includes(result.places[0]?.id));
}

function describe(result: IntentResult | null) {
  if (!result) return "요청 실패";
  const condition = result.conditions.elevator;
  const suffix = condition === undefined ? "" : ` · 엘리베이터 ${condition ? "켬" : "끔"}`;
  if (result.intent === "next") return "다음 이동";
  if (result.intent === "condition") return `이동 조건${suffix}`;
  return `${result.places[0]?.id ?? "장소 없음"}${suffix}`;
}

const keywordOnly = process.argv.includes("--keyword-only");
const withGemini = process.argv.includes("--live") && !keywordOnly && Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);
const rows: string[] = [];
let keywordCorrect = 0;
let geminiCorrect = 0;
for (const [index, example] of examples.entries()) {
  const keyword = await interpretIntent(example.query, {}).catch(() => null);
  let gemini: IntentResult | null = null;
  if (withGemini) {
    if (index > 0) await setTimeout(4000);
    gemini = await interpretIntent(example.query, {
      ...process.env,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    }).catch(() => null);
  }
  const a = correct(example, keyword);
  const b = withGemini && correct(example, gemini);
  keywordCorrect += Number(a);
  geminiCorrect += Number(b);
  const expected = example.ids?.join(" · ") ?? (example.intent === "condition"
    ? `이동 조건 · 엘리베이터 ${example.elevator ? "켬" : "끔"}`
    : example.intent === "next" ? "다음 이동" : "범위 밖");
  const condition = example.intent === "destination" && example.elevator !== undefined ? " · 엘리베이터 켬" : "";
  rows.push(`| ${example.query} | ${expected}${condition} | ${describe(keyword)} | ${withGemini ? describe(gemini) : "건너뜀"} | (가) ${a ? "맞음" : "틀림"}${withGemini ? ` · (나) ${b ? "맞음" : "틀림"}` : ""} |`);
}

console.log("| 문장 | 기대 | (가) 결과 | (나) 결과 | 맞음 여부 |");
console.log("| --- | --- | --- | --- | --- |");
console.log(rows.join("\n"));
const rate = (count: number) => `${count}/${examples.length}, ${(count / examples.length * 100).toFixed(1)}%`;
console.log(`\n(가) 키워드만 정답률: ${rate(keywordCorrect)}`);
console.log(withGemini
  ? `(나) Gemini 포함 정답률: ${rate(geminiCorrect)}`
  : `(나)는 건너뜀: ${keywordOnly ? "키워드만 평가하도록 선택했어요" : "API 키 또는 모델 설정이 없어요"}`);
