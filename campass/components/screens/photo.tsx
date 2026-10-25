"use client";

import { Circle, LoaderCircle } from "lucide-react";
import { CheckIcon } from "@/components/icons";

import { Photo } from "@/components/ui";
import { getDefaultAnalysisSteps } from "@/lib/recognition-view";
import { useRef, useState } from "react";
import { useCampus } from "@/components/campus-provider";

export default function Screen() {
  const {
  busy,
  preview,
  upload,
  manualPicker,
  recovering,
  go,
} = useCampus();
const analysisSteps = getDefaultAnalysisSteps();

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const albumInputRef = useRef<HTMLInputElement | null>(null);

  const [showManualPicker, setShowManualPicker] =
    useState(false);

  function handleFile(file?: File) {
    if (!file || busy) return;
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
        <h1>어디인지 살펴보고 있어요</h1>
        <p>
          보통 10초 안에 끝나요. 잠시만 기다려 주세요.
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
                  ? "촬영한 사진을 확인했어요."
                  : step.id === "compare"
                    ? "등록해 둔 위치 사진과 비교해요."
                    : "가장 가까운 위치 후보를 정리해요."}
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
                  확인 중
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
        disabled
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