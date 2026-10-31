import { places, type Place } from "./catalog.ts";
import { placeLabel } from "./route-start.ts";
export const routes = {
  home: "/",
  search: "/search",
  find: "/find",
  prepare: "/directions",
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
export function navigationHref(
  view: View,
  values: Record<string, string>,
): string {
  if (view === "home") return routes.home;
  if (view === "places") return legacyPlacesHref(values.building);
  const allowed: Partial<Record<View, string[]>> = {
    find: ["tab", "building", "place", "kind", "area"],
    search: ["q", "category", "turn", "destination", "start", "elevator"],
    prepare: ["destination", "start", "elevator", "pick", "option"],
    photo: ["destination", "start", "elevator", "recovering"],
    recognition: ["destination", "start", "elevator", "recovering"],
    failed: ["destination", "start", "elevator", "recovering"],
    recovery: ["destination", "start", "elevator", "recovering"],
    guide: ["destination", "start", "elevator"],
    "guide-map": ["destination", "start", "elevator"],
    arrival: ["destination", "start", "elevator"],
    map: ["destination", "start", "elevator"],
  };
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(values).filter(([key]) => allowed[view]?.includes(key)),
    ),
  );
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
  photo: "사진으로 현재 위치 찾기",
  recognition: "출발 위치 확인",
  failed: "사진으로 현재 위치 찾기",
  recovery: "현재 위치 다시 확인",
  guide: "사진으로 길찾기",
  arrival: "도착 안내",
  admin: "관리자 인사이트",
  map: "캠퍼스 지도",
  places: "건물 상세",
  "guide-map": "안내 중 캠퍼스 지도",
  help: "이용 안내",
};

export function viewForPath(path: string): View {
  return (
    (Object.keys(routes) as View[]).find((key) => routes[key] === path) ??
    "home"
  );
}

export function legacyPlacesHref(building?: string): string {
  const selected = places.find(
    (place) =>
      place.category === "building" &&
      (place.name === building || place.id === building),
  );
  return navigationHref("find", {
    tab: "classroom",
    ...(selected ? { building: selected.name } : {}),
  });
}

export function screenTitle(
  view: View,
  destination: Place,
  recovering: boolean,
) {
  if (view === "guide") return placeLabel(destination);
  if (view === "photo") return recovering ? "현재 위치 찍기" : "출발 위치 찍기";
  return titles[view];
}
