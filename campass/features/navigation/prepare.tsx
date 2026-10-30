"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CameraIcon, ElevatorIcon } from "@/components/ui/icons";
import { type RouteOption } from "@/shared/utils/routing";
import {
  legRows,
  hillDescription,
  optionSummary,
  optionTitle,
  stepFreeText,
} from "@/shared/utils/route-cards";
import { markerStarts } from "@/shared/utils/map-pick";
import {
  placeLabel,
  startLabel,
  startMapIds,
} from "@/shared/utils/route-start";
import { CampusOverviewMap } from "@/features/navigation/campus-overview-map";
import { GuideMapViewport } from "@/features/navigation/guide-map-viewport";
import { toGuideMapData } from "@/shared/utils/guide-view";
import { Tag } from "@/components/ui";
import { api, useCampus } from "@/features/navigation/campus-provider";

// 고른 길(또는 하나뿐인 길)의 펼친 카드
function OptionCard({
  option,
  selected,
}: {
  option: RouteOption;
  selected: boolean;
}) {
  const [showSteps, setShowSteps] = useState(false);
  const rows = legRows(option);
  return (
    <div className={`card route-option-card ${selected ? "selected" : ""}`}>
      <div className="route-option-head">
        <strong>{optionTitle(option)}</strong>
        {option.hillMode && <p>{hillDescription(option)}</p>}
        <small>{stepFreeText(option)}</small>
        <b>{option.legs.length}단계</b>
        <span>
          연결 {option.connections}곳 · 층 이동 {option.floorMoves}번
        </span>
      </div>
      {option.unverified && (
        <div className="route-unverified">
          <Tag tone="amber">현장 확인 전 길</Tag>
          <p>
            아직 걸어서 확인하지 않은 연결이 있어요. 현장 표지판도 같이 확인해
            주세요
          </p>
        </div>
      )}
      <ol className="route-legs">
        {rows.map((row, index) => (
          <li key={index}>
            <span>{row}</span>
            {index === rows.length - 1 ? (
              <small>도착</small>
            ) : (
              index === 0 && <small>출발</small>
            )}
          </li>
        ))}
      </ol>
      {showSteps && (
        <ol className="route-steps">
          {option.steps.map((step) => (
            <li key={step.id}>{step.name}</li>
          ))}
        </ol>
      )}
      <button
        className="text-button centered"
        aria-expanded={showSteps}
        onClick={() => setShowSteps(!showSteps)}
      >
        {showSteps ? "단계 접기" : "전체 단계 보기 →"}
      </button>
    </div>
  );
}

export default function Screen() {
  const {
    destination,
    start,
    elevator,
    route,
    routeOption,
    chooseOption,
    busy,
    ready,
    setRecognition,
    setRecovering,
    go,
    updateRoute,
    begin,
    registeredPlaces,
  } = useCampus();
  // 사진 화면에서 '직접 고르기'로 오면 출발지 선택 지도를 보여 줌.
  const pickStart = useSearchParams().get("pick") === "start";
  // 경로 미리보기에서 두 출발 변경 버튼 모두 같은 선택 지도를 엶.
  const [pickingOnMap, setPickingOnMap] = useState(pickStart);
  useEffect(() => {
    if (pickStart || pickingOnMap)
      document
        .querySelector(".route-start-picker")
        ?.scrollIntoView({ block: "start" });
  }, [pickStart, pickingOnMap]);
  const selectStart = (id: string) => {
    if (busy) return;
    setPickingOnMap(false);
    void updateRoute(id);
  };
  const options = route?.options ?? [];
  // 헤매는 구간 주의 카드는 고른 길에 혼란 기록이 있을 때만
  const [risky, setRisky] = useState<{
    key: string;
    point?: { name: string; passages: number; confusions: number; rate: number };
    dataMode?: string;
  }>({ key: "" });
  const riskyKey = routeOption
    ? JSON.stringify([start, destination.id, elevator, routeOption.id])
    : "";
  useEffect(() => {
    if (!riskyKey) return;
    let cancelled = false;
    const params = new URLSearchParams({
      start,
      destination: destination.id,
      elevator: String(elevator),
      option: routeOption!.id,
    });
    api<{
  points: {
    name: string;
    passages: number;
    confusions: number;
    rate: number;
  }[];
  dataMode: string;
}>(
  `route-insights?${params}`,
)
      .then((data) => {
        if (cancelled) return;
        const point = data.points
          .filter((p) => p.confusions > 0)
          .sort((a, b) => b.rate - a.rate || b.confusions - a.confusions)[0];
        setRisky({
         key: riskyKey,
         point,
         dataMode: data.dataMode,
        });
      })
      .catch(() => {
        if (!cancelled) setRisky({ key: riskyKey });
      });
    return () => {
      cancelled = true;
    };
    // 조건이 바뀔 때만 다시 받음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskyKey]);
  const riskyPoint = risky.key === riskyKey ? risky.point : undefined;
  const isDemoRisk =
  risky.key === riskyKey &&
  risky.dataMode === "demo-route-activity";
  return (
    <>
      <section className="content stack prepare-screen">
        <div className="card route-endpoints" aria-label="선택한 출발과 도착">
          <div className="route-endpoint">
            <span className="map-pick-tag start">출발</span>
            <strong aria-live="polite">
              {startLabel(start, registeredPlaces)}
            </strong>
            <button
              className="text-button"
              onClick={() => setPickingOnMap(true)}
            >
              출발 변경
            </button>
          </div>
          <div className="route-endpoint">
            <span className="map-pick-tag destination">도착</span>
            <div>
              <strong>{placeLabel(destination)}</strong>
              <small>{destination.description}</small>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => go("search", { q: "", category: "" })}
            >
              도착 변경
            </button>
          </div>
        </div>
        {(!routeOption || pickingOnMap) && (
          <div className="route-start-picker">
            <h3>출발지</h3>
            <div className="overview-card">
              <div className="overview-heading">
                <b>캠퍼스 지도</b>
                <span>출발할 곳을 눌러 주세요</span>
              </div>
              <CampusOverviewMap
                selected={startMapIds(start, registeredPlaces)}
                startable={Object.keys(markerStarts)}
                onSelect={(id, building) =>
                  selectStart(building ? id : markerStarts[id])
                }
              />
            </div>
          </div>
        )}

         {routeOption && !pickingOnMap && (
  <div className="overview-card route-preview">
    <div className="overview-heading">
      <b>경로 미리보기</b>

      <button
        type="button"
        className="text-button"
        onClick={() => setPickingOnMap(true)}
      >
        지도에서 출발지 바꾸기
      </button>
    </div>

    <GuideMapViewport
      map={toGuideMapData(routeOption)}
      currentStep={null}
      nextStep={null}
    />
  </div>
)}

        <button
          className="button secondary"
          onClick={() => {
            setRecovering(false);
            setRecognition(null);
            go("photo", { recovering: "false" });
          }}
        >
          <CameraIcon size={24} />
          사진으로 위치 찾기
        </button>
        <div className="card">
          <div className="between">
            <strong className="row">
              <ElevatorIcon size={20} />
              엘리베이터로 이동
            </strong>
            <button
              className={`switch ${elevator ? "on" : ""}`}
              role="switch"
              aria-checked={elevator}
              aria-label="엘리베이터로 이동"
              disabled={busy}
              onClick={() => updateRoute(start, !elevator)}
            >
              <span />
            </button>
          </div>
          <small className="muted">
            {elevator
              ? "켜 두면 계단 없는 길만 보여 드려요"
              : "끄면 언덕 · 계단 · 엘리베이터 길을 함께 비교해요"}
          </small>
        </div>
        {routeOption && options.length === 1 && (
          <OptionCard option={routeOption} selected={false} />
        )}
        {routeOption && options.length > 1 && (
          <div className="route-options" role="radiogroup" aria-label="가는 길">
            <div className="between">
              <h3>가는 길 {options.length}개</h3>
              <small>눌러서 고른 길로 안내해요</small>
            </div>
            {options.map((option) => (
                <button
                  key={option.id}
                  className={`choice ${option.id === routeOption.id ? "selected" : ""}`}
                  role="radio"
                  aria-checked={option.id === routeOption.id}
                  disabled={busy}
                  onClick={() => chooseOption(option.id)}
                >
                  <span className="radio" />
                  <span>
                    <b>{optionTitle(option)}</b>
                    <small>
                      {hillDescription(option) || optionSummary(option)}
                      {option.unverified && " · 현장 확인 전 길"}
                    </small>
                  </span>
                </button>
            ))}
            <OptionCard key={routeOption.id} option={routeOption} selected />
          </div>
        )}
        {route && riskyPoint && (
          <div className="prepare-warning">
            <b>헤매는 사람이 많은 구간이 있어요</b>
            {isDemoRisk && (
             <small>시연용 예시 기록 포함</small>
            )}
            <p>
              {riskyPoint.name}에서 {riskyPoint.passages}명 중{" "}
              {riskyPoint.confusions}명이 헤맸어요. 그 구간 앞에서 한 번 더
              확인해 주세요.
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => go("confusion", { option: routeOption?.id ?? "" })}
            >
              자세히 보기
            </button>
          </div>
        )}
      </section>
      <div className="actions route-start-actions">
        {!start && <p role="status">출발지를 선택해 주세요.</p>}
        <button
          className="button primary"
          disabled={!start || !route || busy || !ready}
          onClick={begin}
        >
          안내 시작
        </button>
      </div>
    </>
  );
}
