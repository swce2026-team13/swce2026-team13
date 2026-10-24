"use client";
import { CalendarDays, HeartPulse } from "lucide-react";
import type { Place } from "@/lib/catalog";
import { Tag } from "@/components/ui";
import {
  BuildingIcon,
  ClassroomIcon,
  CoffeeIcon,
  DiningIcon,
  ElevatorIcon,
  StoreIcon,
} from "@/components/icons";

// 편의시설은 종류(kind)로, 종류가 없으면 이름으로 아이콘을 고름
export function PlaceIcon({ place, size = 20 }: { place: Place; size?: number }) {
  switch (place.kind) {
    case "cafe":
      return <CoffeeIcon size={size} />;
    case "store":
      return <StoreIcon size={size} />;
    case "dining":
      return <DiningIcon size={size} />;
    case "aed":
      return <HeartPulse size={size} strokeWidth={1.65} />;
    case "etc":
      return <BuildingIcon size={size} />;
  }
  const name = `${place.name} ${place.aliases.join(" ")}`;
  if (place.category === "classroom") return <ClassroomIcon size={20} />;
  if (place.category === "event")
    return <CalendarDays size={20} strokeWidth={1.65} />;
  if (/엘리베이터|승강기/.test(name)) return <ElevatorIcon size={20} />;
  if (/AED/.test(name)) return <HeartPulse size={20} strokeWidth={1.65} />;
  if (/카페|커피/.test(name)) return <CoffeeIcon size={20} />;
  if (/식당|학식|푸드|버거|우동/.test(name)) return <DiningIcon size={20} />;
  if (/편의점|매점|서점|문구/.test(name)) return <StoreIcon size={20} />;
  return <BuildingIcon size={20} />;
}

// 지도 층별 목록과 분류 목록이 함께 쓰는 장소 행
export function FloorPlaceList({
  items,
  busy,
  onChoose,
  detail = (p) =>
    p.number
      ? `${p.number}호 · ${p.description}`
      : p.verified
        ? "공식 공지에 등재"
        : "예시 · 현장 확인 필요",
}: {
  items: Place[];
  busy: boolean;
  onChoose: (place: Place) => void;
  detail?: (place: Place) => string;
}) {
  return items.map((p) => (
    <div className="floor-place" key={p.id}>
      <PlaceIcon place={p} />
      <div>
        <b>{p.name}</b>
        {p.category === "facility" && !p.verified && (
          <Tag tone="amber">시연용 위치</Tag>
        )}
        <small>{detail(p)}</small>
      </div>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => onChoose(p)}
      >
        선택
      </button>
    </div>
  ));
}
