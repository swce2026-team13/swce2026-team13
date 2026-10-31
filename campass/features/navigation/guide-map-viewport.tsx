"use client";

import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import { Photo, Tag } from "@/components/ui";
import { CampusOverviewMap } from "@/features/navigation/campus-overview-map";
import { CampusMap } from "@/features/navigation/campus-map";
import { useCampus } from "@/features/navigation/campus-provider";
import { mapRouteBuildings } from "@/shared/utils/map-route";
import {
  guideLegLabel,
  type GuideMapData,
  type GuideStepViewModel,
} from "@/shared/utils/guide-view";
import { overviewRouteHighlight } from "@/shared/utils/campus-overview";
import { guideRouteMotion } from "@/shared/utils/guide-route-motion";

type GuideMapViewportProps = {
  currentStep: GuideStepViewModel | null;
  nextStep: GuideStepViewModel | null;
  recoveredBackward?: boolean;
  map?: GuideMapData;
  compact?: boolean;
};
const guideRoutePreview = { name: "", color: "#2860ed" };

function RouteMap({ map, compact = false, guideActive = false, nextNode }: { map: GuideMapData; compact?: boolean; guideActive?: boolean; nextNode?: string }) {
  const [flat, setFlat] = useState(false);
  const { go } = useCampus();
  const highlight = overviewRouteHighlight(map);
  const buildings = mapRouteBuildings(map);
  const routeAnnotation = useMemo(() => ({
    ...guideRoutePreview,
    guide: guideActive ? guideRouteMotion(map.nodes, map.current.node, nextNode) : undefined,
  }), [guideActive, map.nodes, map.current.node, nextNode]);
  if (!map.nodes.length) {
    return (
      <div className="guide-map-viewport-placeholder">
        <strong>표시할 수 있는 경로가 없어요</strong>
        <p>다른 경로를 선택하거나 이전 단계로 돌아가 다시 시도해 주세요.</p>
      </div>
    );
  }

  const overview = <CampusOverviewMap
    highlight={highlight}
    routePreview={{ ...routeAnnotation, nodes: map.nodes }}
    height={compact ? 420 : undefined}
  />;
  const mapView = flat ? overview : (
    <CampusMap
      embedded={compact}
      designTheme
      guideLive={compact}
      mapHeight={compact ? 380 : undefined}
      routeNodes={map.nodes}
      routeAnnotation={routeAnnotation}
      selectedBuildings={buildings.ids}
      currentBuilding={buildings.currentId}
      fallback={overview}
    />
  );

  if (compact) {
    return (
      <div className="guide-live-map">
        {mapView}
        <button
          type="button"
          className="guide-live-map-expand"
          aria-label="지도 크게 보기"
          onClick={() => go("guide-map")}
        >
          <Maximize2 size={20} aria-hidden="true" />
        </button>
        <div className="guide-live-map-switch" role="group" aria-label="지도 표시 방식">
          <button type="button" aria-pressed={!flat} onClick={() => setFlat(false)}>3D</button>
          <button type="button" aria-pressed={flat} onClick={() => setFlat(true)}>2D</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {mapView}
      <div className="guide-map-controls">
        <button
          type="button"
          className="button secondary guide-map-toggle"
          onClick={() => setFlat(!flat)}
        >
          {flat ? "3D 지도 보기" : "2D 경로 보기"}
        </button>
        <p className="guide-map-viewport-next">
          파란 선이 선택한 경로예요. 건물 내부 이동 유형은 추상적으로 표시해요.
        </p>
      </div>
    </>
  );
}

export function GuideMapViewport({
  currentStep,
  nextStep,
  recoveredBackward = false,
  map,
  compact = false,
}: GuideMapViewportProps) {
  const [photoStep, setPhotoStep] = useState<string | null>(null);
  if (!currentStep && map) {
    return (
      <section className="guide-map-viewport" aria-label="경로 미리보기 지도">
        {map.unverified && (
          <div className="guide-map-heading"><Tag>현장 확인 전 길</Tag></div>
        )}
        <RouteMap map={map} compact={compact} />
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

  if (compact) {
    return (
      <section className="guide-map-viewport guide-live-viewport" aria-label="길안내 지도">
        {map && <RouteMap map={map} compact guideActive nextNode={nextStep?.node} />}
      </section>
    );
  }

  return (
    <section className="guide-map-viewport" aria-label="길안내 지도">
      {map && (
        <>
          <div className="guide-map-heading" aria-live="polite">
            {legLabel && <strong>{legLabel}</strong>}
            {map.unverified && <Tag>현장 확인 전 길</Tag>}
          </div>
          {showPhoto ? photo : <RouteMap map={map} guideActive nextNode={nextStep?.node} />}
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
