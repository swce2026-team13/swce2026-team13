"use client";
import { ArrowRight, Camera, CheckCircle2, Columns2 } from "lucide-react";
import { waypoints } from "@/lib/routing";
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
        {["bus", "main"].map((id) => (
          <button
            key={id}
            disabled={busy}
            className={`choice ${start === id ? "selected" : ""}`}
            onClick={() => updateRoute(id)}
          >
            <span className="radio" />
            <span>
              <b>{waypoints.find((w) => w.id === id)!.name}</b>
              {id === "bus" && <small>정류장 바로 앞</small>}
            </span>
          </button>
        ))}
        {!["bus", "main"].includes(start) && (
          <div className="choice selected">
            <CheckCircle2 size={20} />
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
          <Camera size={20} />
          현재 위치를 모르겠어요 · 사진으로 찾기
        </button>
        <div className="card">
          <div className="between">
            <strong className="row">
              <Columns2 size={20} />
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
                약 {route.minutes}분 <small>{route.steps.length}개 지점</small>
              </strong>
            </div>
            <p className="small">시연용 동선 · 실제 거리와 다를 수 있어요</p>
            <ol className="route-list">
              {route.steps.map((w) => (
                <li key={w.id}>{w.name}</li>
              ))}
            </ol>
            <button className="text-button centered" onClick={() => go("map")}>
              전체 지도 보기 →
            </button>
          </div>
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
          <ArrowRight size={18} />
        </button>
      </div>
    </>
  );
}
