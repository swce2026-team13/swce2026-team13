"use client";
import { useEffect, useState } from "react";
import type { Place } from "@/lib/catalog";
import { isOpenNow, parseHours } from "@/lib/facility-hours";
import { Tag } from "@/components/ui";

// 지금 시각. 서버 렌더와 어긋나지 않게 화면이 뜬 뒤에 정하고 1분마다 다시 셈
export function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now;
}

export function FacilityStatus({
  place,
  now,
}: {
  place: Place;
  now: Date | null;
}) {
  if (!now || place.kind === "aed" || place.hours === undefined) return null;
  const open = isOpenNow(parseHours(place.hours), now);
  return open === true ? (
    <Tag tone="green">지금 열려 있어요</Tag>
  ) : open === false ? (
    <Tag tone="gray">지금은 닫혀 있어요</Tag>
  ) : (
    <Tag tone="amber">운영 시간 확인 중</Tag>
  );
}
