"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CameraIcon, CloseIcon, TapIcon } from "@/components/ui/icons";
import { ArrowDownUp, Footprints, TriangleAlert } from "lucide-react";
import { routeName } from "@/shared/utils/route-presentation";
import { RouteSummarySheet } from "./route-summary-sheet";
import { markerStarts } from "@/shared/utils/map-pick";
import {
  placeLabel,
  startLabel,
  startMapIds,
} from "@/shared/utils/route-start";
import { RouteModePicker } from "./route-mode-picker";
import { MapPicker } from "./map-picker";
import { RoutePreview } from "./route-preview";
import { api, useCampus } from "@/features/navigation/campus-provider";

export default function Screen() {
  const {
    destination,
    start,
    elevator,
    route,
    routeOption,
    routeLoading,
    routeFailed,
    routeElevatorUnavailable,
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
  const picking =
    pick === "start" || pick === "destination"
      ? pick
      : pick === "none"
        ? null
        : !start
          ? "start"
          : !hasDestination
            ? "destination"
            : null;
  const pickingOnMap = Boolean(picking);
  const unavailable = routeFailed && !pickingOnMap;
  const showPicker = !routeLoading && pickingOnMap;
  const [pickNotice, setPickNotice] = useState("");
  const setPicking = (target: "start" | "destination" | null) => {
    setPickNotice("");
    const url = new URL(window.location.href);
    url.searchParams.set("pick", target ?? "none");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  const selectPlace = (id: string, building: boolean) => {
    const target = picking ?? (!start ? "start" : "destination");
    if (busy) return;
    const value = building ? id : markerStarts[id];
    if (
      !value ||
      (target === "destination" &&
        !registeredPlaces.some((place) => place.id === value))
    ) {
      setPickNotice(
        "이 입구는 아직 " +
          (target === "start" ? "출발지" : "도착지") +
          "로 안내할 수 없어요. 다른 건물을 골라 주세요.",
      );
      return;
    }
    setPickNotice("");
    go("prepare", {
      start: target === "start" ? value : start,
      destination:
        target === "destination" ? value : hasDestination ? destination.id : "",
      pick: target === "start" && !hasDestination ? "destination" : "none",
    });
  };
  const swapPlaces = () => {
    if (busy || !start || !hasDestination) return;
    const previousStartCanBeDestination = registeredPlaces.some(
      (place) => place.id === start,
    );
    go("prepare", {
      start: destination.id,
      destination: previousStartCanBeDestination ? start : "",
      pick: previousStartCanBeDestination ? "none" : "destination",
    });
  };
  // 헤매는 구간 주의 카드는 고른 길에 혼란 기록이 있을 때만
  const [risky, setRisky] = useState<{
    key: string;
    point?: {
      name: string;
      passages: number;
      confusions: number;
      rate: number;
    };
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
    }>(`route-insights?${params}`)
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
    risky.key === riskyKey && risky.dataMode === "demo-route-activity";
  const openPhoto = () => {
    setRecovering(false);
    setRecognition(null);
    go("photo", {
      recovering: "false",
      destination: hasDestination ? destination.id : "",
    });
  };
  return (
    <>
      <section className="content stack prepare-screen">
        <section className="route-endpoints" aria-label="출발과 도착">
          <div className="route-endpoint-line" aria-hidden="true">
            <span className="route-start-dot" />
            <span className="route-endpoint-dash" />
            <svg className="route-destination-pin" width="13" height="16" viewBox="0 0 13 16">
              <path d="M6.5 15.5S1 10 1 6.5a5.5 5.5 0 0 1 11 0C12 10 6.5 15.5 6.5 15.5z" fill="#2860ed" />
              <circle cx="6.5" cy="6.4" r="2" fill="white" />
            </svg>
          </div>
          <div className="route-endpoint-fields">
            {(["start", "destination"] as const).map((target) => {
              const isStart = target === "start";
              const selected = isStart ? Boolean(start) : hasDestination;
              const active = picking === target;
              const label = selected
                ? isStart
                  ? startLabel(start, registeredPlaces)
                  : placeLabel(destination)
                : isStart
                  ? "어디서 출발하세요?"
                  : "도착지를 골라 주세요";
              return (
                <div className={`route-endpoint-field ${target}${active ? " is-picking" : ""}${selected && !active ? " has-place" : ""}`} key={target}>
                  <span className={`route-endpoint-tag ${target}`} aria-hidden="true">
                    {isStart ? "출발" : "도착"}
                  </span>
                  <button
                    type="button"
                    className="route-endpoint-field-button"
                    aria-label={`${isStart ? "출발" : "도착"}: ${active ? "고르는 중" : label}. 눌러서 다시 고르기`}
                    disabled={busy}
                    onClick={() => setPicking(target)}
                  >
                    {active ? (isStart ? "어디서 출발하세요?" : "도착지를 골라 주세요") : label}
                  </button>
                  {active && (
                    <button
                      type="button"
                      className="route-endpoint-cancel"
                      aria-label={`${isStart ? "출발" : "도착"} 고르기 취소`}
                      onClick={() => setPicking(null)}
                    >
                      <CloseIcon size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="route-endpoint-swap"
            aria-label="출발과 도착 바꾸기"
            disabled={busy || !start || !hasDestination}
            onClick={swapPlaces}
          >
            <ArrowDownUp size={20} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </section>
        {showPicker && (
          <p className="route-pick-guide">
            <TapIcon size={18} />
            {picking === "start" ? "출발할 곳을 눌러 주세요" : "도착할 곳을 눌러 주세요"}
          </p>
        )}
        {showPicker && picking === "start" && (
          <section className="route-quick-pick" aria-labelledby="route-quick-pick-title">
            <h2 id="route-quick-pick-title">빠르게 고르기</h2>
            <div className="chips">
              <button type="button" disabled={busy} onClick={openPhoto}>
                <CameraIcon size={16} /> 사진으로 찾기
              </button>
              <button type="button" disabled={busy} onClick={() => selectPlace("gate_main", false)}>정문</button>
              <button type="button" disabled={busy} onClick={() => selectPlace("bus_stop_2115", false)}>2115 정류장</button>
              <button type="button" disabled={busy} onClick={() => selectPlace("parking_entrance_1", false)}>1주차장</button>
            </div>
          </section>
        )}
        {unavailable && routeElevatorUnavailable && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void updateRoute(start, false)}
          >
            엘리베이터 없는 길로 찾기
          </button>
        )}
        {!pickingOnMap &&
          hasDestination &&
          !routeLoading &&
          !routeFailed &&
          routeOption && (
            <RouteModePicker
              start={start}
              destination={destination.id}
              elevator={elevator}
              route={route}
              selected={routeOption}
              busy={busy}
              onOption={chooseOption}
              onElevator={(value) => void updateRoute(start, value)}
            />
          )}
        {showPicker && (
          <div className="route-start-picker">
            <MapPicker
              selected={[
                ...startMapIds(start, registeredPlaces),
                ...(hasDestination ? [destination.id] : []),
              ]}
              target={picking ?? (!start ? "start" : "destination")}
              destination={hasDestination ? destination.id : undefined}
              onSelect={selectPlace}
            />
            {pickNotice && <p className="route-pick-notice" role="status">{pickNotice}</p>}
          </div>
        )}

        {routeOption && hasDestination && !pickingOnMap && !routeLoading && (
          <RoutePreview option={routeOption} />
        )}

        {routeOption && hasDestination && !pickingOnMap && !routeLoading && (
          <RouteSummarySheet
            option={routeOption}
            recommended={route?.options[0]?.id === routeOption.id}
            startName={startLabel(start, registeredPlaces)}
            destinationName={placeLabel(destination)}
            warning={
              riskyPoint && (
                <div className="prepare-warning">
                  <b><TriangleAlert size={17} aria-hidden="true" /> 헤매는 사람이 많은 구간이 있어요</b>
                  <p>
                    {riskyPoint.name}에서 {riskyPoint.passages}명 중{" "}
                    {riskyPoint.confusions}명이 헤맸어요. 그 구간 앞에서 한 번
                    더 확인해 주세요.
                  </p>
                  <div className="prepare-warning-footer">
                    {isDemoRisk && <small>시연용 예시 기록 표본</small>}
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => go("confusion", { option: routeOption?.id ?? "" })}
                    >
                      자세히 보기
                    </button>
                  </div>
                </div>
              )
            }
          />
        )}
      </section>
      <div className="actions route-start-actions prepare-fixed-actions">
        <button
          className="button primary"
          disabled={
            busy ||
            (!unavailable &&
              (!start ||
                !hasDestination ||
                pickingOnMap ||
                !route ||
                !ready ||
                routeLoading))
          }
          aria-busy={routeLoading}
          onClick={unavailable ? () => setPicking("destination") : begin}
        >
          <Footprints size={20} aria-hidden="true" />
          {routeLoading
            ? "경로를 불러오는 중…"
            : unavailable
              ? "도착 변경"
              : routeOption && hasDestination && !pickingOnMap
                ? `${routeName(routeOption)}로 안내 시작`
                : "안내 시작"}
        </button>
      </div>
    </>
  );
}
