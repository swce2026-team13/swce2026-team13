"use client";

import { Photo } from "@/components/ui";
import type { GuideStepViewModel } from "@/lib/guide-view";

type GuideMapViewportProps = {
  currentStep: GuideStepViewModel | null;
  nextStep: GuideStepViewModel | null;
  recoveredBackward?: boolean;
};

export function GuideMapViewport({
  currentStep,
  nextStep,
  recoveredBackward = false,
}: GuideMapViewportProps) {
  if (!currentStep) {
    return (
      <section
        className="guide-map-viewport"
        aria-label="3D 길안내 지도"
      >
        <div className="guide-map-viewport-placeholder">
          <strong>3D 길안내 지도</strong>
          <p>현재 경로를 준비하고 있어요.</p>
        </div>
      </section>
    );
  }

  /*
   * 실제 3D 컴포넌트가 연결되기 전 fallback.
   *
   * 이후 유빈님의 3D 컴포넌트가 들어오면
   * 이 컴포넌트 내부만 교체하고 guide.tsx는 유지한다.
   */
  if (currentStep.photo) {
    return (
      <Photo
        src={currentStep.photo}
        direction={
          recoveredBackward
            ? "backward"
            : currentStep.direction
        }
      />
    );
  }

  return (
    <section
      className="guide-map-viewport"
      aria-label="길안내 지도"
    >
      <div className="photo photo-text">
        <strong>{currentStep.instruction}</strong>
        <span>{currentStep.name}</span>
      </div>

      {nextStep && (
        <p className="guide-map-viewport-next">
          다음 · {nextStep.name}
        </p>
      )}
    </section>
  );
}