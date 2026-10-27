"use client";

import { Circle, LoaderCircle } from "lucide-react";
import { CheckIcon } from "@/components/ui/icons";

import { Photo } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import { useCampus } from "@/features/navigation/campus-provider";

export default function Screen() {
  const {
  busy,
  preview,
  upload,
  cancelRecognition,
  manualPicker,
  recovering,
  go,
} = useCampus();

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const albumInputRef = useRef<HTMLInputElement | null>(null);

  const [showManualPicker, setShowManualPicker] =
    useState(false);

    const [analysisSeconds, setAnalysisSeconds] = useState(0);

useEffect(() => {
  if (!busy) return;

  const startedAt = Date.now();

  const timer = window.setInterval(() => {
    setAnalysisSeconds(
      Math.floor((Date.now() - startedAt) / 1000),
    );
  }, 1000);

  return () => window.clearInterval(timer);
}, [busy]);

const analysisSteps = [
  {
    id: "upload",
    label: "사진 준비",
    status: "done",
  },
  {
    id: "compare",
    label: "위치 분석",
    status: "active",
  },
  {
    id: "candidate",
    label: "결과 확인",
    status: "pending",
  },
] as const;

  function handleFile(file?: File) {
  if (!file || busy) return;

  setAnalysisSeconds(0);
  upload(file);
}

  if (busy) {
  return (
    <section className="content photo-analyzing-page">
      {preview && (
        <Photo
          uploaded={preview}
          label="찍은 사진"
        />
      )}

      <header className="photo-analyzing-header">
      <h1>사진에서 현재 위치를 확인하고 있어요</h1>

     <p>
        {analysisSeconds >= 10
          ? "평소보다 분석이 조금 오래 걸리고 있어요. 취소하고 직접 위치를 고를 수도 있어요."
         : "사진을 서버에 보내 위치 후보를 비교하고 있어요."}
      </p>
    </header>

      <div className="photo-analysis-card">
        {analysisSteps.map((step) => (
          <div
            className="photo-analysis-step"
            key={step.id}
          >
            <div>
              <strong>{step.label}</strong>

              <p>
               {step.id === "upload"
                 ? "선택한 사진을 분석할 준비를 마쳤어요."
                : step.id === "compare"
                ? "서버에서 등록된 위치 후보와 사진을 비교하고 있어요."
               : "분석 응답이 오면 가장 가까운 위치 후보를 보여드릴게요."}
              </p>
            </div>

            <span
              className={`photo-analysis-status ${step.status}`}
            >
              {step.status === "done" && (
                <>
                  <CheckIcon size={16} />
                  완료
                </>
              )}

              {step.status === "active" && (
                <>
                  <LoaderCircle
                    size={16}
                    strokeWidth={1.65}
                    className="photo-analysis-spinner"
                  />
                  분석 중
                </>
              )}

              {step.status === "pending" && (
                <>
                  <Circle size={15} strokeWidth={1.65} />
                  대기
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="photo-analysis-privacy">
        <strong>사진은 저장하지 않아요</strong>
        <p>
          위치 확인에만 쓰고, 내 위치를 계속 따라가지 않아요.
        </p>
      </div>

      <button
  type="button"
  className="text-button centered"
  onClick={() => {
    cancelRecognition();

    if (recovering) {
      go("guide");
    } else {
      go("prepare", { pick: "start" });
    }
  }}
>
  취소하고 출발 위치 직접 고르기
</button>
    </section>
  );
}

  return (
    <section className="photo-capture-page">
      <div className="photo-camera-area">
        <div className="photo-camera-frame">
          <span className="photo-frame-corner tl" />
          <span className="photo-frame-corner tr" />
          <span className="photo-frame-corner bl" />
          <span className="photo-frame-corner br" />

          <span className="photo-camera-placeholder">
            촬영 가이드
          </span>

          <strong className="photo-camera-guide-text">
            통로나 입구가 함께 보이게 찍어 주세요
          </strong>
        </div>
      </div>

      <div className="photo-bottom-sheet">
        <div className="photo-sheet-handle" />

        <div className="photo-sheet-header">
          <h1>주변을 한 장 찍어 주세요</h1>
          <p>
            벽만 찍기보다 문, 기둥, 통로를 함께 담아 주세요
          </p>
        </div>

        <div className="photo-info-card">
        <strong>사진으로 찾을 수 있는 곳 · 임시</strong>
        <p>
          길안내 경로에 등록된 일부 지점만 사진으로 찾을 수 있어요.
       </p>
       <p>
          본관 1층 · 한림관 3·6층 · 은주1관 5층
       </p>
      </div>

        <div className="photo-action-row">
          <button
            type="button"
            className="photo-side-action"
            disabled={busy}
            onClick={() =>
              albumInputRef.current?.click()
            }
          >
            앨범
          </button>

          <button
            type="button"
            className="photo-shutter-button"
            disabled={busy}
            onClick={() =>
              cameraInputRef.current?.click()
            }
            aria-label="사진 촬영하기"
          >
            <span />
          </button>

          <button
            type="button"
            className="photo-side-action"
            onClick={() =>
              // 처음 출발이면 출발지 검색 · 지도로, 길을 잃었을 때는 목록에서
              recovering
                ? setShowManualPicker((prev) => !prev)
                : go("prepare", { pick: "start" })
            }
          >
            직접 고르기
          </button>
        </div>

        <input
          ref={cameraInputRef}
          className="photo-hidden-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={busy}
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <input
          ref={albumInputRef}
          className="photo-hidden-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <p className="photo-privacy-text">
          찍은 사진은 위치 확인에만 쓰고 저장하지 않아요
        </p>

        {showManualPicker && (
          <div className="photo-manual-picker-wrap">
            {manualPicker}
          </div>
        )}
      </div>
    </section>
  );
}