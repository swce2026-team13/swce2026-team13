"use client";

import { confusionLevel, levelTones, getConfusionAdvice } from "@/lib/confusion-advice";
import { Tag } from "@/components/ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, MapPin } from "lucide-react";
import { BackIcon } from "@/components/icons";
import { api, useCampus } from "@/components/campus-provider";

export default function Screen() {
  const { go, start, destination, elevator } = useCampus();
  const option = useSearchParams().get("option") || "";

const [points, setPoints] = useState<
  {
    id: string;
    name: string;
    passages: number;
    confusions: number;
    rate: number;
    topReason: string | null;
  }[]
>([]);
useEffect(() => {
  const params = new URLSearchParams({
    start,
    destination: destination.id,
    elevator: String(elevator),
    option,
  });

  api<{ points: typeof points }>(`route-insights?${params}`)
    .then((data) => setPoints(data.points))
    .catch(() => setPoints([]));
}, [start, destination.id, elevator, option]);
const riskyPoint = points
  .filter((point) => point.confusions > 0)
  .sort((a, b) => b.rate - a.rate || b.confusions - a.confusions)[0];


  return (
    <section className="content confusion-page">
      <button
        type="button"
        className="confusion-back"
        onClick={() => go("prepare", { option })}
      >
        <BackIcon size={18} />
        돌아가기
      </button>

      <header className="confusion-header">
        <span className="confusion-label">ROUTE GUIDE</span>
        <h1>헷갈리는 구간</h1>
        <p>
          이 경로에서 특히 주의하면 좋은 구간이에요.
        </p>
      </header>

      <div className="confusion-highlight">
        <div className="confusion-highlight-top">
          <span className="confusion-icon">
            <AlertTriangle size={22} strokeWidth={1.65} />
          </span>

         <span className="confusion-badge">
            {riskyPoint ? `혼란율 ${riskyPoint.rate}%` : "기록 없음"}
        </span>
        {riskyPoint && (
          <Tag tone={levelTones[confusionLevel(riskyPoint.passages, riskyPoint.confusions)]}>
            {confusionLevel(riskyPoint.passages, riskyPoint.confusions)}
          </Tag>
        )}
        </div>

        <h2>
  {riskyPoint ? riskyPoint.name : "혼란 기록을 확인하고 있어요"}
</h2>

<p>
  {riskyPoint
    ? riskyPoint.topReason
      ? `가장 많이 기록된 이유는 "${riskyPoint.topReason}"이에요.`
      : `이 구간의 혼란율은 ${riskyPoint.rate}%예요.`
    : "아직 이 경로에 쌓인 혼란 기록이 없어요."}
</p>
      </div>

      <div className="confusion-mini-grid">
        <div className="confusion-mini-card">
  <span className="confusion-mini-icon">
    <MapPin size={19} strokeWidth={1.65} />
  </span>

  <div>
    <span className="confusion-mini-title">헷갈리는 이유</span>
    <p>
      {riskyPoint?.topReason
        ? riskyPoint.topReason
        : "아직 충분한 혼란 기록이 없어요."}
    </p>
  </div>
</div>

        <div className="confusion-mini-card">
          <span className="confusion-mini-icon">
            <Lightbulb size={19} strokeWidth={1.65} />
          </span>

          <div>
            <span className="confusion-mini-title">이렇게 이동하세요</span>
            <p>{getConfusionAdvice(riskyPoint?.topReason)}</p>
          </div>
        </div>
      </div>

      <div className="confusion-rest">
  <span>나머지 구간</span>
  <strong>
    {points.filter(
      (point) =>
        point.confusions > 0 &&
        point.id !== riskyPoint?.id,
    ).length > 0
      ? `${points.filter(
          (point) =>
            point.confusions > 0 &&
            point.id !== riskyPoint?.id,
        ).length}곳 더 있어요`
      : "특별한 주의 구간이 없어요"}
  </strong>
</div>
    </section>
  );
}
