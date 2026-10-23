"use client";
import { AlertTriangle } from "lucide-react";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  ElevatorIcon,
} from "@/components/icons";
import { startOptions, waypoints } from "@/lib/routing";
import { Notice, Tag } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
export default function Screen() {
  const {
    destination,
    start,
    elevator,
    route,
    busy,
    ready,
    setRecognition,
    setRecovering,
    go,
    updateRoute,
    begin,
    destinationCard,
  } = useCampus();
  const starts = startOptions(destination.id, elevator);
  return (
    <>
      <section className="content stack">
        <Notice>
          <Tag>목적지 확인</Tag>
          <b>
            {destination.building} {destination.floor} {destination.name}로
            안내할까요?
          </b>
          <small>목적지를 확인한 뒤 출발 위치를 선택해 주세요.</small>
        </Notice>
        <div className="between">
          <h3>목적지</h3>
          <button className="text-button" onClick={() => go("home")}>
            변경
          </button>
        </div>
        {destinationCard}
        <h3>어디에서 출발하시나요?</h3>
        {starts.map((id) => (
          <button
            key={id}
            disabled={busy}
            className={`choice ${start === id ? "selected" : ""}`}
            onClick={() => updateRoute(id)}
          >
            <span className="radio" />
            <span>
              <b>{waypoints.find((w) => w.id === id)!.name}</b>
            </span>
          </button>
        ))}
        {!starts.includes(start) && (
          <div className="choice selected">
            <CheckIcon size={20} />
            {waypoints.find((w) => w.id === start)?.name}
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
          <CameraIcon size={20} />
          현재 위치를 모르겠어요 · 사진으로 찾기
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
            층 이동 시 계단을 제외하고 경로를 찾아요
          </small>
        </div>
        {route && (
          <div className="card">
            <div className="between">
              <b>추천 경로</b>
              <strong className="blue-text">
                연결 {route.connections}곳 · 층 이동 {route.floorMoves}번
              </strong>
            </div>
            <p className="small">시연용 동선 · 실제 거리와 다를 수 있어요</p>
            <ol className="route-list">
              {route.steps
                .filter((w) => w.stage)
                 .map((w) => (
            <li key={w.id}>{w.name}</li>
              ))}
            </ol>
            <button className="text-button centered" onClick={() => go("map")}>
              전체 지도 보기 →
            </button>
          </div>
        )}
        {route && (
  <button
    type="button"
    className="card confusion-preview-card"
    onClick={() => go("confusion")}
  >
    <div className="between">
      <strong className="row">
        <AlertTriangle size={20} strokeWidth={1.65} />
        헤매는 사람이 많은 구간
      </strong>
      <span>자세히 보기 →</span>
    </div>

    <p className="muted small">
      이 경로에서 주의할 구간을 확인해 보세요.
    </p>
  </button>
)}
        <p className="fine-print">
          실내 동선은 현장 검증 전 시연 데이터입니다.
        </p>
      </section>
      <div className="actions">
        <button
          className="button primary"
          disabled={!route || busy || !ready}
          onClick={begin}
        >
          안내 시작
          <ArrowRightIcon size={18} />
        </button>
      </div>
    </>
  );
}
