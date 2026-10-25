export const MIN_PASSAGES = 5;
export const IMPROVEMENT_RATE = 30;
export const CAUTION_RATE = 15;

export const confusionLevels = ["개선 필요", "주의", "양호", "기록 부족"] as const;
export type ConfusionLevel = (typeof confusionLevels)[number];

export function confusionLevel(passages: number, confusions: number): ConfusionLevel {
  if (passages < MIN_PASSAGES) return "기록 부족";
  const rate = confusions / passages * 100;
  if (rate >= IMPROVEMENT_RATE) return "개선 필요";
  if (rate >= CAUTION_RATE) return "주의";
  return "양호";
}

export const levelTones: Record<ConfusionLevel, string> = {
  "개선 필요": "red", "주의": "amber", "양호": "green", "기록 부족": "gray",
};

export const improvementAdvice = {
  "방향 혼란": "갈림길에 방향 표지를 더하거나 안내 문구를 더 구체적으로 바꿔 보세요.",
  "지도랑 달랐어요": "연결 통로 · 층 정보를 현장에서 다시 확인해 지도 자료를 고쳐 주세요.",
  "표지판 부족": "건물 · 층 표지를 더 잘 보이는 곳에 두도록 건의해 보세요.",
  "사진 불일치": "이 지점의 안내 사진을 다시 찍어 바꿔 주세요.",
  "위치 재확인": "현재 위치를 알 수 있는 표지(건물 · 층 · 방향)를 보강해 보세요.",
  "기타": "피드백 의견을 확인해 원인을 살펴보세요.",
};
export type ConfusionReason = keyof typeof improvementAdvice;
export const confusionReasons = Object.keys(improvementAdvice) as ConfusionReason[];

export function getConfusionAdvice(
  reason: string | null | undefined,
) {
  switch (reason) {
    case "방향 혼란":
      return "갈림길에서는 이동 방향을 한 번 더 확인하고 안내 표시를 따라가 주세요.";

    case "사진 불일치":
      return "주변 모습이 안내와 다르면 사진으로 현재 위치를 다시 확인해 주세요.";

    case "표지판 부족":
      return "갈림길에 도착하면 건물명과 층 표지를 먼저 확인해 주세요.";

    case "위치 파악 어려움":
      return "현재 위치가 확실하지 않다면 이동하기 전에 사진으로 위치를 확인해 주세요.";

    case "지도랑 달랐어요":
      return "실제 통로나 이동 경로가 지도와 다르면 주변 표지와 현재 위치를 먼저 확인해 주세요.";

    case "기타":
      return "주변 안내 표시와 현재 위치를 확인한 뒤 천천히 이동해 주세요.";

    default:
      return "이 구간에서는 현재 위치와 이동 방향을 한 번 더 확인해 주세요.";
  }
}
