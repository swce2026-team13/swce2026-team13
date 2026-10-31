import type { RouteOption } from "./routing.ts";

// 길찾기 준비(B4) 경로 카드에 쓰는 문구

// 후보 이름. 이름이 같은 후보가 있으면 '지하통로 길 · 은주2관 거쳐'
export const optionTitle = (option: RouteOption) =>
  option.via ? `${option.name} · ${option.via} 거쳐` : option.name;

// 고른 길 id가 목록에 있으면 그 길, 없으면 첫 후보
export const pickOption = (options: RouteOption[], id?: string) =>
  options.find((o) => o.id === id) ?? options[0];

export function stepFreeText(option: RouteOption) {
  const text =
    option.stepFree === true
      ? "계단 없는 길이에요"
      : option.stepFree === false
        ? "계단 · 언덕이 있어요"
        : "계단 여부를 아직 확인하지 못했어요";
  return option.approximate ? `${text} · 실외 길은 대략적인 안내예요` : text;
}

const liftNames = { elevator: "엘리베이터", stairs: "계단" };

// 접힌 카드 한 줄: '4단계 · 연결 4곳 · 층 이동 3번 · 층 이동은 계단'
export function optionSummary(option: RouteOption) {
  return [
    `${option.legs.length}단계`,
    `연결 ${option.connections}곳`,
    `층 이동 ${option.floorMoves}번`,
    ...(option.lifts.length
      ? [`층 이동은 ${option.lifts.map((l) => liftNames[l]).join(" · ")}`]
      : []),
  ].join(" · ");
}

// 펼친 카드의 단계 목록. 마지막 줄(도착)은 도착 층만 보여 줌
export function legRows(option: RouteOption) {
  return option.legs.map((leg, index) => {
    if (leg.building === "지하주차장") return "지하통로 → 지하주차장";
    const last = index === option.legs.length - 1;
    const floors = last || leg.from === leg.to ? leg.to : `${leg.from} → ${leg.to}`;
    return `${leg.building} ${floors}${leg.via ? ` · ${leg.via}` : ""}`;
  });
}

export function hillDescription(option: RouteOption) {
  switch (option.hillMode) {
    case "hill": return "건물 밖 오르막길로 언덕 위·아래를 이동해요";
    case "stairs": return "본관 버스정류장 입구 ↔ 한림관 ↔ 은주관 외부 계단";
    case "elevator": return "본관 정문 ↔ 본관 엘리베이터 ↔ 한림관·은주관 연결통로";
    default: return "";
  }
}
