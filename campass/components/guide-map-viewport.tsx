"use client";

import { useState } from "react";
import { Photo, Tag } from "@/components/ui";
import { CampusOverviewMap } from "@/components/campus-overview-map";
import {
  guideLegLabel,
  type GuideMapData,
  type GuideStepViewModel,
} from "@/lib/guide-view";
import { overviewRouteHighlight } from "@/lib/campus-overview";

type GuideMapViewportProps = {
  currentStep: GuideStepViewModel | null;
  nextStep: GuideStepViewModel | null;
  recoveredBackward?: boolean;
  map?: GuideMapData;
};

function RouteMap({ map }: { map: GuideMapData }) {
  // 3D 컴포넌트가 생기면 map을 그대로 넘겨 이 자리에서 그린다.
  return <CampusOverviewMap highlight={overviewRouteHighlight(map)} />;
}

export function GuideMapViewport({
  currentStep,
  nextStep,
  recoveredBackward = false,
  map,
}: GuideMapViewportProps) {
  const [photoStep, setPhotoStep] = useState<string | null>(null);
  // 지도 모드: 지금 단계 없이 경로 전체만 보여 줌 (B4 경로 미리보기)
  if (!currentStep && map) {
    return (
      <section className="guide-map-viewport" aria-label="경로 미리보기 지도">
        {map.unverified && (
          <div className="guide-map-heading">
            <Tag>현장 확인 전 길</Tag>
          </div>
        )}
        <RouteMap map={map} />
      </section>
    );
  }
  if (!currentStep) {
    return (
      <section className="guide-map-viewport" aria-label="3D 길안내 지도">
        <div className="guide-map-viewport-placeholder">
          <strong>3D 길안내 지도</strong>
          <p>현재 경로를 준비하고 있어요.</p>
        </div>
      </section>
    );
  }

  const photo = currentStep.photo ? (
    <Photo
      src={currentStep.photo}
      direction={recoveredBackward ? "backward" : currentStep.direction}
    />
  ) : null;

  if (!map && photo) return photo;
  const showPhoto = photoStep === currentStep.id && Boolean(photo);
  const legLabel = map ? guideLegLabel(map) : "";

  return (
    <section className="guide-map-viewport" aria-label="길안내 지도">
      {map && (
        <>
          <div className="guide-map-heading" aria-live="polite">
            {legLabel && <strong>{legLabel}</strong>}
            {map.unverified && <Tag>현장 확인 전 길</Tag>}
          </div>
          {showPhoto ? photo : <RouteMap map={map} />}
          {photo && (
            <button
              className="button secondary guide-map-toggle"
              aria-pressed={showPhoto}
              onClick={() => setPhotoStep(showPhoto ? null : currentStep.id)}
            >
              {showPhoto ? "지도 보기" : "사진 보기"}
            </button>
          )}
        </>
      )}
      {!photo && (
        <>
          <div className="photo photo-text">
            <strong>{currentStep.instruction}</strong>
            <span>{currentStep.name}</span>
          </div>

          {nextStep && (
            <p className="guide-map-viewport-next">다음 · {nextStep.name}</p>
          )}
        </>
      )}
    </section>
  );
}
