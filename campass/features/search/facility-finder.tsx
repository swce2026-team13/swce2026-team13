"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";
import type { Place } from "@/shared/utils/catalog";
import { overviewBuildings } from "@/shared/utils/campus-overview";
import { parseHours } from "@/shared/utils/facility-hours";
import { navigationHref } from "@/shared/utils/navigation";
import {
  CampusOverviewMap,
  pinColors,
  type MapPin,
  type PinKind,
} from "@/features/navigation/campus-overview-map";
import { PlaceIcon } from "@/features/search/floor-places";
import { FacilityStatus, useNow } from "@/features/search/facility-status";
import { MapIcon } from "@/components/ui/icons";
import { useCampus } from "@/features/navigation/campus-provider";

const filters = [
  { kind: "", label: "전체" },
  { kind: "cafe", label: "카페" },
  { kind: "store", label: "편의점" },
  { kind: "dining", label: "식당" },
] as const;

const kindNames: Record<NonNullable<Place["kind"]>, string> = {
  cafe: "카페",
  store: "편의점 · 매점",
  dining: "식당",
  aed: "자동심장충격기",
  etc: "편의시설",
};

const where = (p: Place) => `${p.building} ${p.floor}`.trim();

// 같은 건물 시설은 핀 하나로 묶음. 위치는 건물 위치를 씀(places.tsv 좌표는 틀린 곳이 있음)
function buildingPins(list: Place[]): MapPin[] {
  const groups = new Map<string, Place[]>();
  for (const p of list)
    groups.set(p.building, [...(groups.get(p.building) ?? []), p]);
  return [...groups].flatMap(([name, items]) => {
    const building = overviewBuildings.find((b) => b.name === name);
    if (!building) return [];
    const kinds = new Set(items.map((p) => p.kind ?? "etc"));
    return [
      {
        id: name,
        // 건물 이름표를 가리지 않게 조금 위에 둠
        position: [building.center[0], building.center[1] - 12],
        label: name,
        count: items.length,
        kind: (kinds.size === 1 ? [...kinds][0] : "mixed") as PinKind,
      },
    ];
  });
}

export function FacilityFinder({ facilities }: { facilities: Place[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const { busy, choose } = useCampus();
  const now = useNow();
  const kind = filters.find((f) => f.kind === params.get("kind"))?.kind ?? "";
  const area = params.get("area") ?? "";
  const place = facilities.find((p) => p.id === params.get("place"));
  const shown = facilities.filter((p) => !kind || p.kind === kind);
  const listed = area ? shown.filter((p) => p.building === area) : shown;

  // 빈 값은 주소에서 지움
  function href(values: Record<string, string>) {
    const next: Record<string, string> = {
      ...Object.fromEntries(params),
      tab: "facility",
      ...values,
    };
    for (const key of Object.keys(next)) if (!next[key]) delete next[key];
    return navigationHref("find", next);
  }
  // 필터 · 건물 좁히기는 기록을 쌓지 않음
  const replace = (values: Record<string, string>) =>
    window.history.replaceState(null, "", href(values));
  // 상세는 기록을 남겨 뒤로 가기로 목록에 돌아옴
  const open = (p: Place) => router.push(href({ place: p.id }));

  function pressPin(building: string) {
    const items = shown.filter((p) => p.building === building);
    if (items.length === 1) open(items[0]);
    else replace({ area: building });
  }

  if (place) {
    const hours = parseHours(place.hours);
    return (
      <div className="stack facility-detail-screen">
        <div className="facility-map">
          <CampusOverviewMap
            pins={buildingPins([place])}
            selectedPin={place.building}
          />
        </div>
        <div className="card facility-detail">
          <div className="facility-detail-head">
            <span className="icon-box">
              <PlaceIcon place={place} size={24} />
            </span>
            <div>
              <h2>{place.name}</h2>
              <small>
                {kindNames[place.kind ?? "etc"]} · {where(place)}
              </small>
            </div>
          </div>
          <FacilityStatus place={place} now={now} />
          {place.kind !== "aed" && (
            <div className="facility-rows">
              <h3>운영 시간</h3>
              {hours.lines.map((line) => (
                <div key={line.label}>
                  <span>{line.label}</span>
                  <b>{line.value}</b>
                </div>
              ))}
            </div>
          )}
          <div className="facility-rows">
            <h3>위치</h3>
            <div>
              <span>건물 · 층</span>
              <b>{where(place)}</b>
            </div>
            {place.note && (
              <div>
                <span>자세한 위치</span>
                <b>{place.note}</b>
              </div>
            )}
          </div>
        </div>
        <p className="fine-print">
          학교 캠퍼스맵의 편의시설 정보예요. 운영 시간은 바뀔 수 있어요
        </p>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => choose(place)}
        >
          여기로 길찾기
        </button>
        <button
          className="button secondary"
          onClick={() => router.push(href({ place: "", area: place.building }))}
        >
          같은 건물 편의시설 보기
        </button>
        <button
          className="button secondary"
          onClick={() => router.push(href({ place: "", area: "" }))}
        >
          <MapIcon size={20} />
          다른 편의시설 보기
        </button>
      </div>
    );
  }

  return (
    <>
      <h1>편의시설 위치와 운영 시간</h1>
      <p>핀을 누르면 자세한 운영 시간을 볼 수 있어요</p>
      <div className="chips filters facility-filters">
        {filters.map((f) => (
          <button
            key={f.label}
            className={kind === f.kind ? "active" : ""}
            aria-pressed={kind === f.kind}
            onClick={() => replace({ kind: f.kind, area: "" })}
          >
            {f.kind && (
              <i style={{ background: pinColors[f.kind] }} aria-hidden="true" />
            )}
            {f.label}
          </button>
        ))}
      </div>
      <div className="facility-map">
        <CampusOverviewMap
          pins={buildingPins(shown)}
          selectedPin={area}
          onPin={pressPin}
        />
      </div>
      {area && (
        <div className="between facility-area">
          <b>
            {area} 편의시설 {listed.length}곳
          </b>
          <button className="text-button" onClick={() => replace({ area: "" })}>
            전체 보기
          </button>
        </div>
      )}
      {listed.length === 0 && (
        <p className="muted">이 종류의 편의시설은 아직 등록되지 않았어요.</p>
      )}
      {listed.map((p) => (
        <button
          key={p.id}
          className="card facility-card"
          onClick={() => open(p)}
        >
          <span className="icon-box">
            <PlaceIcon place={p} size={24} />
          </span>
          <span className="facility-card-body">
            <span className="facility-card-title">
              <b>{p.name}</b>
              <FacilityStatus place={p} now={now} />
            </span>
            <small>{[where(p), p.note].filter(Boolean).join(" · ")}</small>
            {p.kind !== "aed" && (
              <small className="facility-hours">
                <Clock size={13} strokeWidth={1.65} />
                {parseHours(p.hours).summary}
              </small>
            )}
          </span>
        </button>
      ))}
      <p className="fine-print">
        운영 시간은 학기 중 기준이고, 방학에는 달라질 수 있어요
      </p>
    </>
  );
}
