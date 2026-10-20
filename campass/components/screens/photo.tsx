"use client";

import { useRef, useState } from "react";
import { useCampus } from "@/components/campus-provider";

export default function Screen() {
  const { busy, upload, manualPicker } = useCampus();

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const albumInputRef = useRef<HTMLInputElement | null>(null);

  const [showManualPicker, setShowManualPicker] =
    useState(false);

  function handleFile(file?: File) {
    if (!file || busy) return;
    upload(file);
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
            카메라 화면
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
            길안내 경로에 등록한 지점만 찾을 수 있어요.
          </p>
          <p>
            본관 1층 · 한림관 3·6층 · 은주1관 5층 ·
            스콘스퀘어 · 혜인관 1층
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
              setShowManualPicker((prev) => !prev)
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