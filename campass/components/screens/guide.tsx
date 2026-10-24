"use client";

import { GuideRiskNotice } from "@/components/guide-risk-notice";
import { useState } from "react";
import { GuideMapViewport } from "@/components/guide-map-viewport";
import {
  answerGuideQuestion,
  toGuideViewModel,
} from "@/lib/guide-view";
import { Sparkles } from "lucide-react";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  MapIcon,
} from "@/components/icons";
import { Notice } from "@/components/ui";
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
    start,
    destination,
    elevator,
    step,
    nextStep,
    hasSession,
  } = useCampus();
  const guide = toGuideViewModel(session);
  const [showGuideAnswer, setShowGuideAnswer] = useState(false);

  const guideAnswer = showGuideAnswer
    ? answerGuideQuestion(guide)
   : null;
  return (
    <>
      {!hasSession && (
        <section className="content stack guide-screen">
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
           <div className="guide-progress">
  <div className="guide-progress-row">
    <strong>
      {guide.currentNumber} / {guide.totalSteps} 단계
    </strong>

    <span>3D 지도 보며 이동 중</span>
  </div>

  <div
    className="guide-progress-track"
    role="progressbar"
    aria-valuemin={1}
    aria-valuemax={guide.totalSteps}
    aria-valuenow={guide.currentNumber}
  >
    <div
      className="guide-progress-value"
      style={{
        width: `${
          (guide.currentNumber / guide.totalSteps) * 100
        }%`,
      }}
    />
  </div>
</div>

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
            <GuideRiskNotice
  currentWaypointId={guide.current?.id}
  start={start}
  destination={destination.id}
  elevator={elevator}
/>

<div className="guide-recovery-card">
  <div>
    <strong>길을 잃었나요?</strong>
    <p>
      주변을 촬영하면 현재 위치를 다시 확인할 수 있어요.
    </p>
  </div>

  <button
    type="button"
    className="button secondary"
    onClick={lost}
    disabled={busy || session.status === "completed"}
  >
    <CameraIcon size={18} />
    길을 잃었어요
  </button>
</div>
            <div className="guide-tools">
  <div className="guide-question-card">
    <span className="search-caption">
      <Sparkles size={16} strokeWidth={1.65} />
      이동 중 다른 장소가 궁금한가요?
    </span>

    <form
      className="search-box compact glass-card"
      onSubmit={(e) => {
      e.preventDefault();

      if (query.trim()) {
       setShowGuideAnswer(true);
     }
    }}
    >
      <input
        aria-label="이동 중 목적지 질문"
        placeholder="여기서 어디로 가요?"
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
    {guideAnswer && (
  <div className="guide-answer-card">
    <strong>{query.trim() || guideAnswer.title}</strong>

    <span className="guide-answer-intent">
      {guideAnswer.interpretation}
    </span>

    <p>{guideAnswer.answer}</p>

    <small>{guideAnswer.context}</small>
  </div>
)}
  </div>

  <button
    type="button"
    className="guide-map-button"
    onClick={() => go("guide-map")}
  >
    <MapIcon size={18} />
    <span>
      <strong>3D 지도 크게 보기</strong>
      <small>전체 경로와 현재 위치를 확인해요</small>
    </span>
  </button>
</div>
          </section>
          <div className="actions guide-actions">
  <div className="guide-step-actions">
    <button
      className="button secondary"
      disabled={busy || guide.isFirstStep}
      onClick={previous}
    >
      이전 단계
    </button>

    <button
      className="button primary"
      disabled={busy}
      onClick={
        session.status === "completed"
          ? () => go("arrival")
          : advance
      }
    >
      {session.status === "completed"
        ? "도착 안내 보기"
        : "다음 지점에 도착했어요"}
      <CheckIcon size={18} />
    </button>
  </div>

  <span className="fine-print">
    자동 위치 추적 없이 직접 도착을 확인합니다.
  </span>
</div>
        </>
      )}
    </>
  );
}
