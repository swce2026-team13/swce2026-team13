import type { Session } from "./store";

type RouteStep = Session["route"]["steps"][number];
export type GuideStepViewModel = {
  id: string;
  name: string;
  instruction: string;
  detail?: string;
  photo?: RouteStep["photo"];
  direction?: RouteStep["direction"];
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
          photo: currentStep.photo,
          direction: currentStep.direction,
        }
      : null,
    next: nextStep
      ? {
          id: nextStep.id,
          name: nextStep.name,
          instruction: nextStep.instruction,
          detail: nextStep.detail,
          photo: nextStep.photo,
          direction: nextStep.direction,
        }
      : null,
  };
}
export type GuideQuestionAnswer = {
  title: string;
  interpretation: string;
  answer: string;
  context: string;
};

export function answerGuideQuestion(
  guide: GuideViewModel,
): GuideQuestionAnswer | null {
  if (!guide.current) return null;

  const nextName = guide.next?.name;

  return {
    title: "여기서 어디로 가요?",
    interpretation: "다음 이동 질문으로 이해했어요",
    answer: nextName
      ? `${guide.current.name}에서 ${nextName} 방향으로 이동해 주세요. ${guide.current.instruction}`
      : `현재 목적지에 도착했어요. ${guide.current.instruction}`,
    context: `지금 안내 중인 ${guide.currentNumber}단계를 기준으로 답했어요`,
  };
}