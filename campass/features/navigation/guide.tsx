"use client";

import { GuideRiskNotice } from "@/features/navigation/guide-risk-notice";
import { useEffect, useRef, useState } from "react";
import { createIntentRequest } from "@/shared/utils/intent-request";
import { GuideMapViewport } from "@/features/navigation/guide-map-viewport";
import {
  answerGuideIntent,
  type GuideViewModel,
  toGuideViewModel,
} from "@/shared/utils/guide-view";
import { Sparkles } from "lucide-react";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  MapIcon,
} from "@/components/ui/icons";
import { Notice } from "@/components/ui";
import { api, useCampus } from "@/features/navigation/campus-provider";
import type { IntentResult } from "@/shared/types/recognition";
export default function Screen() {
  const {
    session,
    busy,
    go,
    advance,
    previous,
    lost,
    start,
    destination,
    elevator,
    step,
    hasSession,
  } = useCampus();
  const guide = toGuideViewModel(session);
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

    <span>지도 보며 이동 중</span>
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
  map={guide.map ?? undefined}
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
  <GuideQuestionCard key={`${session.id}-${session.currentStep}`} guide={guide} />

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
        ? "목적지에 도착했어요"
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

function GuideQuestionCard({ guide }: { guide: GuideViewModel }) {
  const { session, elevator, busy, go, continueConversation } = useCampus();
  const request = useRef(createIntentRequest((query, signal) => api<IntentResult>("intent", { query }, signal)));
  const pendingRef = useRef(false);
  useEffect(() => {
    const current = request.current;
    return () => current.cancel();
  }, []);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<IntentResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const answer = result ? answerGuideIntent(guide, result) : null;

  async function ask() {
    if (pendingRef.current || pending || busy || !question.trim()) return;
    pendingRef.current = true;
    setPending(true);
    setResult(null);
    setError("");
    try {
      const interpreted = await request.current.run(question.trim());
      if (interpreted) setResult(continueConversation(question.trim(), interpreted));
    } catch (error) {
      setError((error as { status?: number }).status === 429
        ? "질문이 많아 잠시 쉬고 있어요. 잠시 후 다시 물어봐 주세요."
        : "질문을 해석하지 못했어요. 잠시 후 다시 물어봐 주세요.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="guide-question-card">
      <span className="search-caption">
        <Sparkles size={16} strokeWidth={1.65} />
        이동 중 다른 장소가 궁금한가요?
      </span>
      <form className="search-box compact glass-card" onSubmit={(event) => {
        event.preventDefault();
        void ask();
      }}>
        <input aria-label="이동 중 목적지 질문" placeholder="여기서 어디로 가요?"
          value={question} disabled={pending} maxLength={200}
          onChange={(event) => { setQuestion(event.target.value); setResult(null); setError(""); }} />
        <button aria-label="장소 질문 검색" disabled={busy || pending || !question.trim()}>
          <ArrowRightIcon size={18} />
        </button>
      </form>
      {pending && <p role="status">질문을 확인하고 있어요.</p>}
      {error && <p role="alert">{error}</p>}
      {answer && (
        <div className="guide-answer-card" aria-live="polite">
          <strong>{question.trim() || answer.title}</strong>
          <span className="guide-answer-intent">{answer.interpretation}</span>
          <p>{answer.answer}</p>
          <small>{answer.context}</small>
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
          {result?.intent === "destination" && result.places.length > 1 && result.places.map((place) => (
            <button key={place.id} className="button secondary" disabled={busy} onClick={() => go("prepare", {
              start: result.startRequested ? result.startPlaceId ?? "" : guide.current!.id,
              destination: place.id,
              building: place.building,
              elevator: String(result.conditions.elevator ?? elevator),
            })}>{place.building} {place.floor} · {place.name}</button>
          ))}
          {answer.destination && (
            <button className="button primary" disabled={busy} onClick={() => go("prepare", {
              start: result?.startRequested ? result.startPlaceId ?? "" : guide.current!.id,
              destination: answer.destination!.id,
              building: answer.destination!.building,
              elevator: String(result?.conditions.elevator ?? elevator),
            })}>여기로 목적지 바꾸기</button>
          )}
          {answer.elevator !== undefined && session && (
            <button className="button primary" disabled={busy} onClick={() => go("prepare", {
              start: guide.current!.id,
              destination: session.destination,
              elevator: String(answer.elevator),
            })}>이 조건으로 다시 찾기</button>
          )}
          <button className="button secondary" onClick={() => setResult(null)}>지금 안내 계속하기</button>
          </div>
        </div>
      )}
    </div>
  );
}
