"use client";
import { useState } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { Notice, Photo, Tag } from "@/components/ui";
import { useCampus } from "@/features/navigation/campus-provider";
import { toRecognitionViewModel } from "@/shared/utils/recognition-view";

// 고른 후보만 체크하고 나머지는 빈 동그라미
function SelectMark({ on }: { on: boolean }) {
  return on ? (
    <span className="recognition-mark on" aria-hidden="true">
      <CheckIcon size={14} />
    </span>
  ) : (
    <span className="recognition-mark" aria-hidden="true" />
  );
}

export default function Screen() {
  const {
    busy,
    preview,
    recognition,
    candidate,
    setCandidate,
    recovering,
    go,
    confirmLocation,
    sendRecognitionFeedback,
    recognitionFeedbackSent,
    manualPicker,
  } = useCampus();
  const [showManualPicker, setShowManualPicker] = useState(false);
  const candidateViews =
  recognition?.candidates.map((item) => ({
    candidate: item,
    view: toRecognitionViewModel(item),
  })) ?? [];

const primaryCandidate = candidateViews[0] ?? null;
const alternativeCandidates = candidateViews.slice(1);
 return (
  <>
    <section className="content recognition-page">
      <header className="recognition-header">
        <h1>{recovering ? "지금 위치를 확인했어요" : "여기 계신 게 맞나요?"}</h1>
        <p>
          {recovering
            ? "찍은 사진으로 서 있는 곳과 보고 있는 방향을 짐작했어요. 주변이 사진과 같은지 봐 주세요."
            : "찍은 사진을 등록된 사진과 비교해 봤어요. 주변을 한 번 둘러보고 출발 위치를 골라 주세요."}
        </p>
      </header>

      {preview && (
        <div className="recognition-photo">
          <Photo
            uploaded={preview}
            label="찍은 사진"
          />
        </div>
      )}

      <div className="recognition-status-row">
        <Tag>사진으로 현재 위치 찾기</Tag>
        <Tag tone="green">{recovering ? "다시 확인했어요" : "확인했어요"}</Tag>
      </div>

      <p className="recognition-guide">
        서 있는 곳과 보고 있는 방향을 짐작해 봤어요.
        숫자는 예시라기보다 현재 인식 결과의 유사도를 나타내요.
        주변을 보고 직접 골라 주세요.
      </p>

      {primaryCandidate && (
        <div className="recognition-primary-section">
          <button
            type="button"
            className={`recognition-candidate-card primary ${
              candidate?.waypointId ===
              primaryCandidate.candidate.waypointId
                ? "selected"
                : ""
            }`}
            onClick={() =>
              setCandidate(primaryCandidate.candidate)
            }
          >
            <div className="recognition-candidate-top">
              <div>
                <strong>
                  {primaryCandidate.view.title}
                </strong>

                {primaryCandidate.view.subtitle && (
                  <p>
                    {primaryCandidate.view.subtitle}
                  </p>
                )}
              </div>

              <SelectMark
                on={
                  candidate?.waypointId ===
                  primaryCandidate.candidate.waypointId
                }
              />
            </div>

            <div className="recognition-tags">
              <Tag>
                {primaryCandidate.view.directionLabel}
              </Tag>
            </div>

            <div className="recognition-confidence">
              <div className="between small">
                <span>유사도</span>
                <b>
                  {
                    primaryCandidate.view
                      .confidencePercent
                  }
                  %
                </b>
              </div>

              <progress
                value={
                  primaryCandidate.view
                    .confidencePercent
                }
                max={100}
              />
            </div>
          </button>
        </div>
      )}

      {alternativeCandidates.length > 0 && (
        <section className="recognition-alternatives">
          <h2>혹시 여기일까요?</h2>

          <div className="recognition-alternative-list">
            {alternativeCandidates.map(
              ({ candidate: item, view }) => (
                <button
                  type="button"
                  key={item.waypointId}
                  className={`recognition-candidate-card ${
                    candidate?.waypointId ===
                    item.waypointId
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => setCandidate(item)}
                >
                  <div className="recognition-candidate-top">
                    <div>
                      <strong>{view.title}</strong>

                      {view.subtitle && (
                        <p>{view.subtitle}</p>
                      )}
                    </div>

                    <SelectMark
                      on={candidate?.waypointId === item.waypointId}
                    />
                  </div>

                  <div className="recognition-confidence">
                    <div className="between small">
                      <span>유사도</span>
                      <b>
                        {view.confidencePercent}%
                      </b>
                    </div>

                    <progress
                      value={view.confidencePercent}
                      max={100}
                    />
                  </div>
                </button>
              ),
            )}
          </div>
        </section>
      )}

      {!candidateViews.length && (
        <Notice>
          위치 후보를 찾지 못했어요. 다시 촬영하거나
          위치를 직접 선택해 주세요.
        </Notice>
      )}

      <div className="recognition-correction">
        <span>결과가 다르면</span>

        <button
         type="button"
          className="text-button"
         onClick={() =>
           // 처음 출발이면 지도에서, 길을 잃었을 때는 위치 목록에서 선택
           recovering
             ? setShowManualPicker((prev) => !prev)
             : go("prepare", { pick: "start" })
         }
        >
         직접 고르기
        </button>

        <button
        type="button"
        className="text-button"
        disabled={!candidate || busy || recognitionFeedbackSent}
      onClick={sendRecognitionFeedback}
    >
    {recognitionFeedbackSent
    ? "알림 완료"
    : "틀렸다고 알리기"}
</button>
      </div>

      <div className="recognition-reassurance">
        <strong>가다가 헷갈려도 괜찮아요</strong>
        <p>
          안내 중에 언제든 주변을 찍으면 위치를 다시
          확인해 드려요.
        </p>
      </div>

      {showManualPicker && (
      <div className="recognition-manual-picker">
       {manualPicker}
     </div>
    )}
    </section>

    <div className="actions recognition-actions">
      <button
        type="button"
        className="button primary"
        disabled={!candidate || busy}
        onClick={() =>
          candidate &&
          confirmLocation(
            candidate.waypointId,
            candidate,
          )
        }
      >
        {recovering ? "여기서 다시 안내" : "여기서 출발"}
      </button>

      <button
        type="button"
        className="text-button centered"
        onClick={() => go("photo")}
      >
        다시 찍기
      </button>
    </div>
  </>
);
}