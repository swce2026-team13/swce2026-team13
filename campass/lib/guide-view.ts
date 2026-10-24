import type { Session } from "./store";

export type GuideStepViewModel = {
  id: string;
  name: string;
  instruction: string;
  detail?: string;
};

export type GuideViewModel = {
  currentIndex: number;
  currentNumber: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  current: GuideStepViewModel | null;
  next: GuideStepViewModel | null;
};

export function toGuideViewModel(
  session: Session | null | undefined,
): GuideViewModel {
  if (!session) {
    return {
      currentIndex: 0,
      currentNumber: 0,
      totalSteps: 0,
      isFirstStep: true,
      isLastStep: false,
      current: null,
      next: null,
    };
  }

  const currentIndex = session.currentStep;
  const currentStep = session.route.steps[currentIndex];
  const nextStep = session.route.steps[currentIndex + 1];

  return {
    currentIndex,
    currentNumber: currentIndex + 1,
    totalSteps: session.route.steps.length,
    isFirstStep: currentIndex === 0,
    isLastStep:
      currentIndex === session.route.steps.length - 1,
    current: currentStep
      ? {
          id: currentStep.id,
          name: currentStep.name,
          instruction: currentStep.instruction,
          detail: currentStep.detail,
        }
      : null,
    next: nextStep
      ? {
          id: nextStep.id,
          name: nextStep.name,
          instruction: nextStep.instruction,
          detail: nextStep.detail,
        }
      : null,
  };
}