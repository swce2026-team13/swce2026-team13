"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CameraIcon, ElevatorIcon } from "@/components/icons";
import { type RouteOption } from "@/lib/routing";
import {
  legRows,
  optionSummary,
  optionTitle,
  stepFreeText,
} from "@/lib/route-cards";
import { markerStarts } from "@/lib/map-pick";
import {
  placeLabel,
  startChoices,
  startLabel,
  startMapIds,
} from "@/lib/route-start";
import { CampusOverviewMap } from "@/components/campus-overview-map";
import { GuideMapViewport } from "@/components/guide-map-viewport";
import { toGuideMapData } from "@/lib/guide-view";
import { Tag } from "@/components/ui";
import { api, useCampus } from "@/components/campus-provider";

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
  const [startQuery, setStartQuery] = useState<string | null>(null);
  // 사진 화면에서 '직접 고르기'로 오면 출발지 검색 · 지도 쪽을 보여 줌
  const pickStart = useSearchParams().get("pick") === "start";
  useEffect(() => {
    if (pickStart)
      document
        .querySelector(".route-start-picker")
        ?.scrollIntoView({ block: "start" });
  }, [pickStart]);
  const candidates = startChoices(startQuery ?? "", registeredPlaces);
  // 경로가 나오면 지도 자리에 미리보기를 보여 주고, '지도에서 출발지 바꾸기'를 누르면 고르기 지도로
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const selectStart = (id: string) => {
    if (busy) return;
    setStartQuery(null);
    setPickingOnMap(false);
    void updateRoute(id);
  };
  const options = route?.options ?? [];
  // 헤매는 구간 주의 카드는 고른 길에 혼란 기록이 있을 때만
  const [risky, setRisky] = useState<{
    key: string;
    point?: { name: string; passages: number; confusions: number; rate: number };
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
    api<{ points: { name: string; passages: number; confusions: number; rate: number }[] }>(
      `route-insights?${params}`,
    )
      .then((data) => {
        if (cancelled) return;
        const point = data.points
          .filter((p) => p.confusions > 0)
          .sort((a, b) => b.rate - a.rate || b.confusions - a.confusions)[0];
        setRisky({ key: riskyKey, point });
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
              onClick={() =>
                document.getElementById("route-start-input")?.focus()
              }
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
        <div className="route-start-picker">
          <h3>
            <label htmlFor="route-start-input">출발지</label>
          </h3>
          <div className="route-start-input">
            <input
              id="route-start-input"
              type="search"
              maxLength={200}
              autoComplete="off"
              placeholder="건물이나 장소를 검색해 주세요"
              aria-describedby="route-start-hint"
              aria-controls="route-start-results"
              value={
                startQuery ?? (start ? startLabel(start, registeredPlaces) : "")
              }
              disabled={busy}
              onChange={(event) => {
                setStartQuery(event.target.value);
                if (start) void updateRoute("");
              }}
            />
            {start && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => selectStart("")}
              >
                선택 해제
              </button>
            )}
          </div>
          <p id="route-start-hint" className="muted small">
            지도나 검색 결과에서 출발지를 선택해 주세요.
          </p>
          {startQuery?.trim() && (
            <div id="route-start-results" className="route-start-results">
              <p role="status">
                {candidates.length
                  ? `검색 결과 ${candidates.length}곳`
                  : "검색 결과가 없어요. 다른 장소명을 입력해 주세요."}
              </p>
              {candidates.map((item) => (
                <button
                  key={item.id}
                  className="choice"
                  disabled={busy}
                  onClick={() => selectStart(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
          {routeOption && !pickingOnMap ? (
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
          ) : (
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
          )}
        </div>
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
              : "끄면 계단 · 지하통로 길도 함께 보여 드려요"}
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
            {options.map((option) =>
              option.id === routeOption.id ? (
                <OptionCard key={option.id} option={option} selected />
              ) : (
                <button
                  key={option.id}
                  className="choice"
                  role="radio"
                  aria-checked={false}
                  disabled={busy}
                  onClick={() => chooseOption(option.id)}
                >
                  <span className="radio" />
                  <span>
                    <b>{optionTitle(option)}</b>
                    <small>
                      {optionSummary(option)}
                      {option.unverified && " · 현장 확인 전 길"}
                    </small>
                  </span>
                </button>
              ),
            )}
          </div>
        )}
        {route && riskyPoint && (
          <div className="prepare-warning">
            <b>헤매는 사람이 많은 구간이 있어요</b>
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
