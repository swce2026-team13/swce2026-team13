"use client";

import { GuideRiskNotice } from "@/features/navigation/guide-risk-notice";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createIntentRequest } from "@/shared/utils/intent-request";
import { GuideMapViewport } from "@/features/navigation/guide-map-viewport";
import {
  answerGuideIntent,
  type GuideViewModel,
  toGuideViewModel,
} from "@/shared/utils/guide-view";
import { MessageCircle, Sparkles } from "lucide-react";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
} from "@/components/ui/icons";
import { Notice } from "@/components/ui";
import { api, useCampus } from "@/features/navigation/campus-provider";
import { routeMode, routeName } from "@/shared/utils/route-presentation";
import { guideInstruction, stepUnverified } from "@/shared/utils/guide-instruction";
import { guideRouteMotion } from "@/shared/utils/guide-route-motion";
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
    displayDestination,
  } = useCampus();
  const [questionOpen, setQuestionOpen] = useState(false);
  const guide = toGuideViewModel(session);
  const option = session?.route.options.find((item) => item.id === session.route.option)
    ?? session?.route.options[0];
  const mode = option ? routeMode(option) : null;
  const routeLabel = option ? routeName(option) : "선택한 경로";
  const routeSteps = session?.route.steps ?? [];
  const currentStep = session ? routeSteps[session.currentStep] : undefined;
  const nextStep = session ? routeSteps[session.currentStep + 1] : undefined;
  const destinationName = displayDestination.building || displayDestination.name;
  // 지금 할 일을 동작으로 말하는 한 줄(단계 종류별 템플릿)
  const instruction = currentStep
    ? guideInstruction(option, currentStep, nextStep, destinationName)
    : "";
  // 지금 단계 구간이 '확인'된 연결이 아닐 때만 확인 전 표시와 안내 표지 문구를 보여 줌
  const unverified = currentStep ? stepUnverified(option, currentStep) : false;
  const remainingDistance = session && option
    ? Math.max(0, Math.round(session.route.distance * (1 - (guideRouteMotion(option.nodes, guide.current?.node, guide.next?.node)?.from ?? 0))))
    : 0;
  const middleIndex = routeSteps.length > 2 ? Math.floor((routeSteps.length - 1) / 2) : -1;
  const milestones = [
    { index: 0, label: routeSteps[0]?.name ?? "출발" },
    ...(middleIndex > 0 ? [{ index: middleIndex, label: routeSteps[middleIndex].name }] : []),
    { index: Math.max(0, routeSteps.length - 1), label: displayDestination.building || routeSteps.at(-1)?.name || "도착" },
  ];
  const activeMilestone = milestones.reduce(
    (active, milestone, index) => guide.currentIndex >= milestone.index ? index : active,
    0,
  );

  return (
    <>
      {!hasSession && (
        <section className="content stack guide-screen">
          <Notice>진행 중인 안내가 없어요. 목적지를 선택해 주세요.</Notice>
          <button className="button primary" onClick={() => go("home")}>목적지 찾기</button>
        </section>
      )}
      {session && step && (
        <>
          <section className="content stack guide-screen guide-live-screen">
            {session.recovered && (
              <Notice tone="green">
                <b className="row"><CheckIcon size={18} />선택한 위치에서 안내를 복구했어요</b>
                <p>현재 위치를 기준으로 목적지까지 경로를 다시 계산했어요.</p>
              </Notice>
            )}
            <ol
              className="guide-live-milestones"
              aria-label="경로 진행 지점"
              data-count={milestones.length}
              style={{ "--guide-line-fill": `${activeMilestone / Math.max(1, milestones.length - 1) * (milestones.length === 2 ? 50 : 66.66)}%` } as CSSProperties}
            >
              {milestones.map((milestone, index) => {
                const state = index === activeMilestone ? "current" : index < activeMilestone ? "passed" : "upcoming";
                return (
                  <li key={index} data-state={state} aria-current={state === "current" ? "step" : undefined}>
                    <span className="guide-live-milestone-dot" aria-hidden="true" />
                    <strong title={milestone.label}>{milestone.label}</strong>
                  </li>
                );
              })}
            </ol>
            <GuideMapViewport
              compact
              map={guide.map ?? undefined}
              currentStep={guide.current}
              nextStep={guide.next}
              recoveredBackward={session.recovered && session.recoveryDirection === "backward"}
            />
            <div className="guide-live-instruction">
              <div className="guide-live-meta">
                <div className="guide-live-chips">
                  <span data-mode={mode ?? "default"}>{routeLabel}</span>
                  {unverified && <span className="unverified">현장 확인 전</span>}
                </div>
                {session.route.distance > 0 && (
                  <span className="guide-live-distance">
                    {remainingDistance > 0 ? `${destinationName || "목적지"}까지 약 ${remainingDistance}m` : "도착"}
                  </span>
                )}
              </div>
              <h1>
                {session.recovered && session.recoveryDirection === "backward"
                  ? "되돌아가는 방향으로 이동해 주세요"
                  : instruction}
              </h1>
              {unverified && guide.current?.detail && <p className="guide-live-detail">{guide.current.detail}</p>}
              <div className="guide-live-flow">
                <p>
                  <span>현재</span>
                  <strong>{guide.current?.name ?? "현재 위치"}</strong>
                </p>
                <ArrowRightIcon size={18} />
                <p>
                  <span>{guide.next ? "다음" : "도착"}</span>
                  <strong>{guide.next?.name ?? displayDestination.name}</strong>
                </p>
              </div>
            </div>
            <div className="guide-live-quick-actions">
              <button type="button" onClick={lost} disabled={busy || session.status === "completed"}>
                <CameraIcon size={20} aria-hidden="true" />
                길을 잃었어요
              </button>
              <button
                type="button"
                aria-expanded={questionOpen}
                aria-controls="guide-live-question"
                onClick={() => setQuestionOpen((open) => !open)}
              >
                <MessageCircle size={20} aria-hidden="true" />
                여기서 어디로 가요?
              </button>
            </div>
            {questionOpen && (
              <div id="guide-live-question">
                <GuideQuestionCard key={session.id + "-" + session.currentStep} guide={guide} />
              </div>
            )}
            <GuideRiskNotice
              currentWaypointId={guide.current?.id}
              start={start}
              destination={destination.id}
              elevator={elevator}
            />
          </section>
          <div className="actions guide-actions guide-live-actions">
            <div className="guide-step-actions">
              <button className="button secondary" disabled={busy || guide.isFirstStep} onClick={previous}>
                이전
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={session.status === "completed" ? () => go("arrival") : advance}
              >
                <CheckIcon size={18} />
                {session.status === "completed" || !guide.next ? "도착했어요" : `${guide.next.name}에 도착했어요`}
              </button>
            </div>
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
