"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api, useCampus } from "@/components/campus-provider";
import { getConfusionAdvice } from "@/lib/confusion-advice";

type RouteInsightPoint = {
  id: string;
  name: string;
  passages: number;
  confusions: number;
  rate: number;
  topReason: string | null;
};

type GuideRiskNoticeProps = {
  currentWaypointId: string | null | undefined;
  start: string;
  destination: string;
  elevator: boolean;
};

export function GuideRiskNotice({
  currentWaypointId,
  start,
  destination,
  elevator,
}: GuideRiskNoticeProps) {
  const { session } = useCampus();
  const option = session?.route.option ?? "";
  const [points, setPoints] = useState<RouteInsightPoint[]>([]);

  useEffect(() => {
    if (!currentWaypointId) return;

    const params = new URLSearchParams({
      start,
      destination,
      elevator: String(elevator),
      option,
    });

    api<{ points: RouteInsightPoint[] }>(
      `route-insights?${params}`,
    )
      .then((data) => setPoints(data.points))
      .catch(() => setPoints([]));
  }, [currentWaypointId, start, destination, elevator, option]);

  const currentRisk = useMemo(
    () =>
      points.find(
        (point) =>
          point.id === currentWaypointId &&
          point.confusions > 0,
      ) ?? null,
    [points, currentWaypointId],
  );

  if (!currentRisk) return null;

  return (
    <aside className="guide-risk-notice">
      <div className="guide-risk-title">
        <AlertTriangle size={18} strokeWidth={1.7} />
        <strong>헤매는 사람이 많은 구간이에요</strong>
      </div>

      <p>{getConfusionAdvice(currentRisk.topReason)}</p>
    </aside>
  );
}
