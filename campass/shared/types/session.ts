import type { Route } from "../utils/routing.ts";
export type Session = {
  id: string;
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
