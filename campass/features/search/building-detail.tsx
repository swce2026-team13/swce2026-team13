"use client";

import { ChevronLeft } from "lucide-react";
import { CampusOverviewMap } from "@/features/navigation/campus-overview-map";
import type { BuildingDetailData } from "@/shared/types/building-detail";

export function BuildingDetail({
  building,
  busy,
  onBack,
  onDirections,
}: {
  building: BuildingDetailData;
  busy: boolean;
  onBack: () => void;
  onDirections: () => void;
}) {
  const finalConsonant =
    (building.name.charCodeAt(building.name.length - 1) - 0xac00) % 28;
  const directionParticle =
    finalConsonant === 0 || finalConsonant === 8 ? "로" : "으로";
  return (
    <>
      <div className="overview-card building-detail-map">
        <CampusOverviewMap
          key={building.id}
          height={310}
          focusBuilding={building}
        />
        <button type="button" className="building-map-back" onClick={onBack}>
          <ChevronLeft size={17} /> 전체 지도
        </button>
      </div>
      <article className="card building-detail-card">
        <header className="building-detail-heading">
          <h1>{building.name}</h1>
          <span>{building.floorRange}</span>
        </header>
        <div className="building-detail-actions">
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={onDirections}
          >
            {building.name}
            {directionParticle} 길찾기
          </button>
        </div>
        <h2>층별 안내</h2>
        {building.floors.some((floor) => floor.summary) ? (
          <dl className="building-floor-summary">
            {building.floors.map((floor) => (
              <div key={floor.code}>
                <dt>{floor.label}</dt>
                {floor.summary && <dd>{floor.summary}</dd>}
              </div>
            ))}
          </dl>
        ) : (
          <p className="building-floor-empty">층별 정보를 준비하고 있어요</p>
        )}
        {building.facilities && (
          <p
            className="building-facility-summary"
            tabIndex={0}
            aria-label="건물 편의시설"
          >
            {building.facilities}
          </p>
        )}
      </article>
    </>
  );
}
