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