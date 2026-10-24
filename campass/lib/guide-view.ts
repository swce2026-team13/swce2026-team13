import type { Session } from "./store";
import type { RouteOption } from "./routing";

type RouteStep = Session["route"]["steps"][number];
export type GuideMapData = {
  nodes: string[];
  links: string[];
  legs: { building: string; from: string; to: string; via?: string }[];
  current: { node?: string; link?: string; leg?: number };
  unverified: boolean;
};

// 경로 후보 하나로 지도 데이터를 만듦. current가 없으면 경로 전체만 보여 주는 지도(B4 미리보기)
export function toGuideMapData(
  option: RouteOption,
  current?: Pick<RouteStep, "node" | "link" | "leg">,
): GuideMapData {
  return {
    nodes: option.nodes,
    links: option.links,
    legs: option.legs,
    current: {
      ...(current?.node !== undefined ? { node: current.node } : {}),
      ...(current?.link !== undefined ? { link: current.link } : {}),
      ...(current?.leg !== undefined ? { leg: current.leg } : {}),
    },
    unverified: Boolean(option.unverified),
  };
}

export function guideLegLabel(map: GuideMapData): string {
  const index = map.current.leg;
  const leg = index === undefined ? undefined : map.legs[index];
  if (!leg || index === undefined) return "";
  const floors = leg.from === leg.to ? leg.from : `${leg.from} → ${leg.to}`;
  return `${leg.building}${floors ? ` ${floors}` : ""} · ${index + 1}/${map.legs.length}`;
}

export type GuideStepViewModel = {
  id: string;
  name: string;
  instruction: string;
  detail?: string;
  photo?: RouteStep["photo"];
  direction?: RouteStep["direction"];
};

export type GuideViewModel = {
  map: GuideMapData | null;
  legLabel: string;
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
      map: null,
      legLabel: "",
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
  const option =
    session.route.options?.find(
      (option) => option.id === session.route.option,
    ) ?? session.route.options?.[0];
  const map: GuideMapData | null = option
    ? toGuideMapData(option, currentStep)
    : null;

  return {
    map,
    legLabel: map ? guideLegLabel(map) : "",
    currentIndex,
    currentNumber: currentIndex + 1,
    totalSteps: session.route.steps.length,
    isFirstStep: currentIndex === 0,
    isLastStep: currentIndex === session.route.steps.length - 1,
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
