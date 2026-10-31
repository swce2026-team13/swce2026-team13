import type { Place } from "../utils/catalog.ts";
export type Candidate = {
  waypointId: string;
  confidence: number;
  direction: "forward" | "backward" | "unknown";
};
export type Recognition = {
  status: "matched" | "no_match" | "unavailable";
  candidates: Candidate[];
  message: string;
};
export type Intent = "destination" | "condition" | "next";
export type IntentResult = {
  intent: Intent;
  startPlaceId?: string;
  startRequested?: boolean;
  // 장소 확인에 '다른 곳이에요'라고 답함
  rejected?: boolean;
  conditions: { elevator?: boolean };
  places: Place[];
  mode: "keyword" | "api" | "llm";
  message: string;
};
