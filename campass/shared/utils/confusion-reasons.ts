import { waypoints } from "./routing.ts";

// 헤매기 쉬운 구간 팝업에 쓰는 문장. 기록된 원인 코드를 처음 쓰는 사람도 알기 쉬운 말로 바꾼다.
export const confusionReasonText: Record<string, string> = {
  "위치 재확인": "갈림길이 있어 방향을 헷갈리기 쉬워요",
  "방향 혼란": "가는 방향이 여러 갈래라 헷갈리기 쉬워요",
  "표지판 부족": "건물·층 표지가 잘 보이지 않는 곳이에요",
  "위치 파악 어려움": "지금 위치를 알아보기 어려운 곳이에요",
  "사진 불일치": "사진 안내와 실제 모습이 조금 달라요",
  "지도랑 달랐어요": "지도와 실제 길이 조금 달라요",
  "기타": "여기서 위치를 다시 확인하는 사람이 많아요",
};

export const defaultReasonText = "여기서 위치를 다시 확인하는 사람이 많아요";
export const defaultFindTip = "지금 위치와 가는 방향을 한 번 더 확인해 주세요";

export function reasonText(reason: string | null | undefined) {
  return (reason && confusionReasonText[reason]) || defaultReasonText;
}

// 지점 데이터(waypoints)의 findTip. 없는 지점은 기본 문장
export function findTip(pointId: string) {
  return waypoints.find((point) => point.id === pointId)?.findTip ?? defaultFindTip;
}
