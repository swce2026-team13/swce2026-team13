"use client";
import { CalendarDays } from "lucide-react";
import type { Place } from "@/lib/catalog";
import { Tag } from "@/components/ui";

// 지도 층별 목록과 분류 목록이 함께 쓰는 장소 행
export function FloorPlaceList({
  items,
  busy,
  onChoose,
  detail = (p) => (p.verified ? "공식 공지에 등재" : "예시 · 현장 확인 필요"),
}: {
  items: Place[];
  busy: boolean;
  onChoose: (place: Place) => void;
  detail?: (place: Place) => string;
}) {
  return items.map((p) => (
    <div className="floor-place" key={p.id}>
      <CalendarDays size={20} />
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
