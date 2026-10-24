"use client";
import { useState } from "react";
import { CameraIcon, CheckIcon, ElevatorIcon } from "@/components/icons";
import {
  calculateRoute,
  startOptions,
  toward,
  waypoints,
  type RouteOption,
} from "@/lib/routing";
import { legRows, optionSummary, stepFreeText } from "@/lib/route-cards";
import { places } from "@/lib/catalog";
import { Tag } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";

// 출발지 이름. 지도에서 건물을 출발로 고르면 건물 id가 옴
const startName = (id: string) =>
  waypoints.find((w) => w.id === id)?.name ??
  places.find((p) => p.id === id)?.name ??
  id;

const startHints: Record<string, string> = {
  bus_stop_2115: "본관 앞 버스정류장",
  gate: "정문 앞",
  main: "정류장 바로 앞 건물",
  parking: "스콘스퀘어 아래 주차장",
};

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
        <strong>{option.name}</strong>
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
    destinationCard,
  } = useCampus();
  // 계단 길로 갈 수 있는 출발지는 모두 보여 주고, 엘리베이터 길이 없는 곳은 고르면 엘리베이터를 끔
  const starts = startOptions(destination.id, false);
  const liftStarts = startOptions(destination.id, true);
  const reachable = (id: string, lift: boolean) => {
    try {
      calculateRoute(id, destination.id, lift);
      return true;
    } catch {
      return false;
    }
  };
  const stairsOnly = !reachable(start, true) && reachable(start, false);
  const place = [
    destination.building,
    destination.floor,
    destination.name !== destination.building ? destination.name : "",
  ]
    .filter(Boolean)
    .join(" ");
  const options = route?.options ?? [];
  return (
    <>
      <section className="content stack prepare-screen">
        <div className="card prepare-request">
          <p>
            {destination.id === "interview" && "면접 보러 오셨군요. "}
            {toward(place)} 안내할게요.
          </p>
          <small>다른 곳이면 아래에서 바꿀 수 있어요</small>
        </div>
        <div className="between">
          <h3>목적지</h3>
          <button className="text-button" onClick={() => go("home")}>
            변경
          </button>
        </div>
        {destinationCard}
        <h3>지금 어디쯤 계세요?</h3>
        {starts.map((id) => (
          <button
            key={id}
            disabled={busy}
            className={`choice ${start === id ? "selected" : ""}`}
            onClick={() =>
              updateRoute(id, elevator && liftStarts.includes(id))
            }
          >
            <span className="radio" />
            <span>
              <b>{startName(id)}</b>
              <small>
                {[
                  startHints[id],
                  !liftStarts.includes(id) && "계단 길만 있어요",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
          </button>
        ))}
        {!starts.includes(start) && (
          <div className="choice selected">
            <CheckIcon size={20} />
            {startName(start)}
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
          잘 모르겠으면 사진으로 찾기
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
              disabled={busy || stairsOnly}
              onClick={() => updateRoute(start, !elevator)}
            >
              <span />
            </button>
          </div>
          <small className="muted">
            {stairsOnly
              ? "이 출발지에서는 계단 길만 있어 엘리베이터를 껐어요"
              : elevator
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
                    <b>{option.name}</b>
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
        {route && (
          <div className="prepare-warning">
            <b>헤매는 사람이 많은 구간이 있어요</b>
            <p>이 경로에서 주의할 구간을 확인하고, 그 구간 앞에서 한 번 더 알려 드려요.</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => go("confusion")}
            >
              자세히 보기
            </button>
          </div>
        )}
      </section>
      <div className="actions">
        <button
          className="button primary"
          disabled={!route || busy || !ready}
          onClick={begin}
        >
          안내 시작
        </button>
      </div>
    </>
  );
}
