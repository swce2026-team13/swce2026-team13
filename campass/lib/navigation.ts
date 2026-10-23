export const routes = {
  home: "/",
  search: "/search",
  find: "/find",
  prepare: "/directions",
  confusion: "/directions/confusion",
  photo: "/directions/photo",
  recognition: "/directions/recognition",
  failed: "/directions/failed",
  recovery: "/directions/recovery",
  guide: "/guide",
  arrival: "/guide/arrival",
  admin: "/admin",
  map: "/map",
  places: "/map/places",
  "guide-map": "/guide/map",
  help: "/help",
} as const;
export type View = keyof typeof routes;
export function navigationHref(view: View, values: Record<string, string>) {
  if (view === "home") return routes.home;
  const params = new URLSearchParams(values);
  if (!["photo", "recognition", "failed", "recovery"].includes(view)) {
    params.delete("recovering");
  }
  return `${routes[view]}${params.size ? `?${params}` : ""}`;
}
export const titles: Record<View, string> = {
  home: "캠퍼스 길찾기",
  search: "목적지 검색",
  find: "바로 찾기",
  prepare: "길찾기",
  confusion: "헷갈리는 구간 안내",
  photo: "사진으로 위치 확인",
  recognition: "출발 위치 확인",
  failed: "사진으로 위치 확인",
  recovery: "현재 위치 다시 확인",
  guide: "사진으로 길찾기",
  arrival: "도착 안내",
  admin: "관리자 인사이트",
  map: "캠퍼스 지도",
  places: "건물 · 층별 주요 장소",
  "guide-map": "안내 중 캠퍼스 지도",
  help: "이용 안내",
};

export function viewForPath(path: string): View {
  return (
    (Object.keys(routes) as View[]).find((key) => routes[key] === path) ??
    "home"
  );
}
