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
