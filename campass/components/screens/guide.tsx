"use client";
import { GuideMapViewport } from "@/components/guide-map-viewport";
import { toGuideViewModel } from "@/lib/guide-view";
import { Sparkles } from "lucide-react";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  MapIcon,
} from "@/components/icons";
import { Notice, Progress } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
export default function Screen() {
  const {
    query,
    setQuery,
    session,
    busy,
    go,
    search,
    advance,
    previous,
    lost,
    step,
    nextStep,
    hasSession,
  } = useCampus();
  const guide = toGuideViewModel(session);
  return (
    <>
      {!hasSession && (
        <section className="content stack">
          <Notice>진행 중인 안내가 없어요. 목적지를 선택해 주세요.</Notice>
          <button className="button primary" onClick={() => go("home")}>
            목적지 찾기
          </button>
        </section>
      )}
      {session && step && (
        <>
          <section className="content stack">
            {session.recovered && (
              <Notice tone="green">
                <b className="row">
                  <CheckIcon size={18} />
                  선택한 위치에서 안내를 복구했어요
                </b>
                <p>현재 위치를 기준으로 목적지까지 경로를 다시 계산했어요.</p>
              </Notice>
            )}
           <div className="guide-stage-header">
  <div>
    <strong>
      {guide.currentNumber} / {guide.totalSteps} 단계
    </strong>
    <p>3D 지도를 보며 이동해요</p>
  </div>

  <span className="guide-stage-status">이동 중</span>
</div>

<Progress
  current={guide.currentNumber}
  total={guide.totalSteps}
/>

<GuideMapViewport
  currentStep={guide.current}
  nextStep={guide.next}
  recoveredBackward={
    session.recovered &&
    session.recoveryDirection === "backward"
  }
/>

<div className="card instruction">
  <h1>
    {session.recovered && session.recoveryDirection === "backward"
      ? "되돌아가는 방향으로 이동해 주세요"
      : guide.current?.instruction}
  </h1>

  <p>{guide.current?.detail}</p>

  <div className="guide-location-flow">
    <div className="guide-location-block">
      <span className="guide-location-label">현재</span>
      <strong>{guide.current?.name ?? "현재 위치"}</strong>
    </div>

    <div
      className="guide-location-arrow"
      aria-hidden="true"
    >
      ↓
    </div>

    <div className="guide-location-block">
      <span className="guide-location-label">
        {guide.next ? "다음" : "도착"}
      </span>
      <strong>
        {guide.next?.name ?? session.destination}
      </strong>
    </div>
  </div>
</div>
            <button
              className="button secondary"
              onClick={lost}
              disabled={busy || session.status === "completed"}
            >
              <CameraIcon size={20} />
              길을 잃었어요
            </button>
            <p className="fine-print">
              주변 사진으로 현재 위치를 다시 확인할 수 있어요
            </p>
            <div className="card">
              <span className="search-caption">
                <Sparkles size={16} strokeWidth={1.65} />
                이동 중 다른 장소를 찾으시나요?
              </span>
              <form
                className="search-box compact glass-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (query.trim()) search();
                }}
              >
                <input
                  aria-label="이동 중 목적지 질문"
                  placeholder="어디로 가고 싶으세요?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  aria-label="장소 질문 검색"
                  disabled={busy || !query.trim()}
                >
                  <ArrowRightIcon size={18} />
                </button>
              </form>
            </div>
            <button
              className="text-button centered"
              onClick={() => go("guide-map")}
            >
              <MapIcon size={16} />
              지도에서 현재 단계 보기
            </button>
            <p className="fine-print">
              시연용 사진·동선입니다. 실제 안내는 현장 검증 후 제공돼요.
            </p>
          </section>
          <div className="actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={
                session.status === "completed" ? () => go("arrival") : advance
              }
            >
              {session.status === "completed"
                ? "도착 안내 보기"
                : "다음 지점에 도착했어요"}
              <CheckIcon size={18} />
            </button>
            <span className="fine-print">
              자동 위치 추적 없이 직접 도착을 확인합니다
            </span>
          </div>
        </>
      )}
    </>
  );
}
