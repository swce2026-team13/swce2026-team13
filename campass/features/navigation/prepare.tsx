"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CameraIcon } from "@/components/ui/icons";
import { type RouteOption } from "@/shared/utils/routing";
import {
  legRows,
  hillDescription,
  optionTitle,
  stepFreeText,
} from "@/shared/utils/route-cards";
import { markerStarts } from "@/shared/utils/map-pick";
import {
  placeLabel,
  startLabel,
  startMapIds,
} from "@/shared/utils/route-start";
import { RouteModePicker } from "./route-mode-picker";
import { MapPicker } from "./map-picker";
import { RoutePreview } from "./route-preview";
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
  const params = useSearchParams();
  const hasDestination = Boolean(params.get("destination"));
  const pick = params.get("pick");
  const picking = pick === "start" || pick === "destination" ? pick : !start && pick !== "none" ? "start" : null;
  const pickingOnMap = Boolean(picking);
  const [pickNotice, setPickNotice] = useState("");
  const setPicking = (target: "start" | "destination" | null) => {
    setPickNotice("");
    const url = new URL(window.location.href);
    url.searchParams.set("pick", target ?? "none");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  const selectPlace = (id: string, building: boolean) => {
    if (busy || !picking) return;
    const value = building ? id : markerStarts[id];
    if (!value || (picking === "destination" && !registeredPlaces.some((place) => place.id === value))) {
      setPickNotice("이 입구는 아직 " + (picking === "start" ? "출발지" : "도착지") + "로 안내할 수 없어요. 다른 건물을 골라 주세요.");
      return;
    }
    setPickNotice("");
    go("prepare", {
      start: picking === "start" ? value : start,
      destination: picking === "destination" ? value : hasDestination ? destination.id : "",
      pick: picking === "start" && !hasDestination ? "destination" : "none",
    });
  };
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
          {(["start", "destination"] as const).map((target) => {
            const isStart = target === "start";
            const description = isStart ? registeredPlaces.find((p) => p.id === start)?.description : destination.description;
            return <div className="route-endpoint" key={target}>
              <span className={`map-pick-tag ${target}`}>{isStart ? "출발" : "도착"}</span>
              {picking === target ? <div className="endpoint-picking" role="status"><i />지도에서 {isStart ? "출발지" : "도착지"}를 눌러 주세요</div> :
                <div><strong>{isStart ? startLabel(start, registeredPlaces) : hasDestination ? placeLabel(destination) : "도착지를 선택해 주세요"}</strong>
                  {description && (isStart ? Boolean(start) : hasDestination) && <small>{description}</small>}
                </div>}
              <button className={`text-button ${picking === target ? "endpoint-cancel" : ""}`} disabled={busy} onClick={() => setPicking(picking === target ? null : target)}>
                {picking === target ? "취소" : isStart ? "출발 변경" : "도착 변경"}
              </button>
            </div>;
          })}
        </div>
        {!pickingOnMap && hasDestination && <RouteModePicker start={start} destination={destination.id} elevator={elevator} route={route} selected={routeOption} busy={busy} onOption={chooseOption} onElevator={(value) => void updateRoute(start, value)} />}
        {(!routeOption || pickingOnMap || !hasDestination) && <div className="route-start-picker">
          <MapPicker selected={[...startMapIds(start, registeredPlaces), ...(hasDestination ? [destination.id] : [])]} target={picking ?? (!start ? "start" : "destination")} onSelect={(id, building) => {
            if (!picking) { setPicking(!start ? "start" : "destination"); return; }
            selectPlace(id, building);
          }} />
          {pickNotice && <p role="status">{pickNotice}</p>}
          {hasDestination && destination.category === "building" && <button className="button secondary" onClick={() => go("places", { building: destination.name })}>{destination.name} 층별 장소 보기</button>}
        </div>}

        {routeOption && hasDestination && !pickingOnMap && <RoutePreview option={routeOption} />}

        <button
          className="button secondary"
          onClick={() => {
            setRecovering(false);
            setRecognition(null);
            go("photo", { recovering: "false" });
          }}
        >
          <CameraIcon size={24} />
          사진으로 현재 위치 찾기
        </button>
        {routeOption && hasDestination && !pickingOnMap && <OptionCard option={routeOption} selected />}
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
          disabled={!start || !hasDestination || pickingOnMap || !route || busy || !ready}
          onClick={begin}
        >
          안내 시작
        </button>
      </div>
    </>
  );
}
