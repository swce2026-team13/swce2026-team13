import type { Session } from "../types/session.ts";

export type ArrivalSegmentViewModel = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type ArrivalViewModel = {
  segments: ArrivalSegmentViewModel[];
};

export function toArrivalViewModel(
  session: Session | null | undefined,
): ArrivalViewModel {
  if (!session) {
    return {
      segments: [],
    };
  }

  const steps = session.route.steps;

  const segments = steps.slice(0, -1).map((step, index) => {
    const next = steps[index + 1];

    return {
      id: step.id,
      from: step.name,
      to: next.name,
      label: `${step.name} → ${next.name}`,
    };
  });

  return {
    segments,
  };
}