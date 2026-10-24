"use client";

import type { GuideStepViewModel } from "@/lib/guide-view";

type GuideMapViewportProps = {
  currentStep: GuideStepViewModel | null;
  nextStep: GuideStepViewModel | null;
};

export function GuideMapViewport({
  currentStep,
  nextStep,
}: GuideMapViewportProps) {
  return (
    <section className="guide-map-viewport" aria-label="3D 길안내 지도">
      <div className="guide-map-viewport-placeholder">
        <strong>3D 길안내 지도</strong>

        {currentStep ? (
          <p>
            {currentStep.name}
            {nextStep ? ` → ${nextStep.name}` : ""}
          </p>
        ) : (
          <p>현재 경로를 준비하고 있어요.</p>
        )}
      </div>
    </section>
  );
}