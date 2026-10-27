import type { Candidate } from "../types/recognition.ts";
import { waypoints } from "./routing";

export type RecognitionViewModel = {
  id: string;
  title: string;
  subtitle?: string;
  building?: string;
  floor?: string;
  directionLabel: string;
  confidencePercent: number;
};

export type AnalysisStep = {
  id: string;
  label: string;
  status: "done" | "active" | "pending";
};

export function toRecognitionViewModel(
  candidate: Candidate,
): RecognitionViewModel {
  const waypoint = waypoints.find(
    (item) => item.id === candidate.waypointId,
  );

  return {
    id: candidate.waypointId,
    title: waypoint?.name ?? "위치 후보",
    subtitle: waypoint?.detail,
    directionLabel:
    candidate.direction === "forward"
    ? "진행 방향"
    : candidate.direction === "backward"
      ? "반대 방향"
      : "방향을 확인하지 못했어요",
    confidencePercent: Math.round(
      candidate.confidence * 100,
    ),
  };
}

export function getDefaultAnalysisSteps(): AnalysisStep[] {
  return [
    {
      id: "upload",
      label: "사진 업로드",
      status: "done",
    },
    {
      id: "compare",
      label: "주변 지점 비교",
      status: "active",
    },
    {
      id: "candidate",
      label: "위치 후보 확인",
      status: "pending",
    },
  ];
}