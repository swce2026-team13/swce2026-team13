import type { RouteOption } from "./routing.ts";

// 길찾기 준비(B4) 경로 카드에 쓰는 문구

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
