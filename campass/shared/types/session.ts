import type { Route } from "../utils/routing.ts";
export type Session = {
  id: string;
  demo?: boolean;
  destination: string;
  route: Route;
  currentStep: number;
  version: number;
  status: "active" | "completed";
  recovered: boolean;
  recoveryDirection: "forward" | "backward" | "unknown";
  visited: string[];
  feedbackSubmitted: boolean;
};
export type Feedback = {
  confused: boolean;
  waypointId?: string;
  reason?: string;
  comment?: string;
};
export type RecognitionFeedback = {
  predictedWaypointId: string;
  confidence: number;
  direction: "forward" | "backward" | "unknown";
  correctedWaypointId?: string;
};
