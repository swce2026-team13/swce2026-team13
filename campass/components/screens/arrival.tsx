"use client";
import { getConfusionAdvice } from "@/lib/confusion-advice";
import { toArrivalViewModel } from "@/lib/arrival-view";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { Notice, Progress } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
const feedbackReasons = [
  { value: "방향 혼란", label: "방향이 헷갈렸어요" },
  { value: "사진 불일치", label: "사진 불일치" },
  { value: "지도랑 달랐어요", label: "지도랑 달랐어요" },
  { value: "표지판 부족", label: "표지판이 없었어요" },
  { value: "기타", label: "기타" },
] as const;
export default function Screen() {
  const {
    session,
    busy,
    confused,
    setConfused,
    feedbackPoint,
    setFeedbackPoint,
    reason,
    setReason,
    comment,
    setComment,
    sent,
    go,
    sendFeedback,
    hasSession,
    destinationCard,
  } = useCampus();
  const arrival = toArrivalViewModel(session);
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
      {session?.status === "active" && (
        <section className="content stack">
          <Notice>
            아직 안내 중이에요. 목적지까지 남은 경로를 확인해 주세요.
          </Notice>
          <button className="button primary" onClick={() => go("guide")}>
            안내 이어가기
          </button>
        </section>
      )}
      {session?.status === "completed" && (
        <>
          <section className="content stack">
            <div className="arrival-intro">
              <span className="arrival-icon">
                <CheckIcon size={39} />
              </span>
              <h1>목적지에 도착했어요</h1>
              <p>캠퍼스 길찾기가 여러분의 방문을 응원할게요.</p>
            </div>
            {destinationCard}
            <Progress
              current={session.route.steps.length}
              total={session.route.steps.length}
              done
            />
            {sent ? (
              <Notice tone="green">
                <b>피드백을 보내주셔서 감사해요</b>
                <p>더 찾기 쉬운 캠퍼스를 만드는 데 도움이 됩니다.</p>
              </Notice>
            ) : (
              <>
                <h3>헷갈리는 구간이 있었나요?</h3>
                <div className="two-columns">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      className={`choice ${confused === v ? "selected" : ""}`}
                      onClick={() => setConfused(v)}
                    >
                      <span className="radio" />
                      <b>{v ? "있었어요" : "없었어요"}</b>
                    </button>
                  ))}
                </div>
                {confused && (
                  <div className="card stack">
                    <b>어느 구간이었나요?</b>
                    <div className="select-wrap">
                      <select
                          aria-label="헷갈린 구간"
                          value={
                          arrival.segments.some(
                         (segment) => segment.id === feedbackPoint,
                          )
                        ? feedbackPoint
                         : arrival.segments[0]?.id ?? ""
                         }
                         onChange={(e) => setFeedbackPoint(e.target.value)}
>
                        {arrival.segments.map((segment) => (
                       <option key={segment.id} value={segment.id}>
                      {segment.label}
                      </option>
                       ))}
                    </select>
                      <ChevronDownIcon size={17} />
                    </div>
                    
                    <div className="chips">
                      {feedbackReasons.map((item) => (
                      <button
                      className={reason === item.value ? "active" : ""}
                      key={item.value}
                      onClick={() => setReason(item.value)}
                      >
                      {item.label}
                       </button>
                      ))}
                    </div>
                    <div className="arrival-feedback-advice">
                    <strong>이 구간에서는 이렇게 확인해 보세요</strong>
                    <p>{getConfusionAdvice(reason)}</p>
                  </div>
                  </div>
                )}
                <label className="field-label">
                  더 알려주실 내용이 있나요? <small>선택</small>
                  <textarea
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="헷갈렸던 부분을 편하게 알려주세요."
                />
                  <span className="muted small">{comment.length}/500</span>
                </label>
              </>
            )}
          </section>
          <div className="actions">
            {!sent && (
              <button
                className="button primary"
                disabled={busy || session.status !== "completed"}
                onClick={sendFeedback}
              >
                피드백 보내기
              </button>
            )}
            <button
              className={`button ${sent ? "primary" : "secondary"}`}
              onClick={() => go("home")}
            >
              처음으로 돌아가기
            </button>
          </div>
        </>
      )}
    </>
  );
}
