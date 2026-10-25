"use client";

import {
  confusionLevel,
  levelTones,
  getConfusionAdvice,
} from "@/lib/confusion-advice";
import { Notice, Tag } from "@/components/ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Lightbulb, MapPin } from "lucide-react";
import { api, useCampus } from "@/components/campus-provider";

type RouteInsightPoint = {
  id: string;
  name: string;
  passages: number;
  confusions: number;
  rate: number;
  topReason: string | null;
};

type RouteInsightResponse = {
  points: RouteInsightPoint[];
  scope: string;
  dataMode: string;
};

export default function Screen() {
  const { start, destination, elevator } = useCampus();
  const option = useSearchParams().get("option") || "";

  const [points, setPoints] = useState<RouteInsightPoint[]>([]);
  const [dataMode, setDataMode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      start,
      destination: destination.id,
      elevator: String(elevator),
      option,
    });

    setLoading(true);

    api<RouteInsightResponse>(`route-insights?${params}`)
      .then((data) => {
        setPoints(data.points);
        setDataMode(data.dataMode);
      })
      .catch(() => {
        setPoints([]);
        setDataMode("");
      })
      .finally(() => setLoading(false));
  }, [start, destination.id, elevator, option]);

  const riskyPoints = useMemo(
    () =>
      points
        .filter((point) => point.confusions > 0)
        .sort(
          (a, b) =>
            b.rate - a.rate ||
            b.confusions - a.confusions,
        ),
    [points],
  );

  const riskyPoint = riskyPoints[0] ?? null;
  const isDemo = dataMode === "demo-route-activity";

  if (loading) {
    return (
      <section className="content confusion-page">
        <Notice>위험 구간 기록을 확인하고 있어요.</Notice>
      </section>
    );
  }

  return (
    <section className="content confusion-page">
      <header className="confusion-header">
        <span className="confusion-label">ROUTE GUIDE</span>

        <h1>헷갈리는 구간</h1>

        <p>
          이 경로에서 특히 주의하면 좋은 구간이에요.
        </p>

        {isDemo && (
          <span className="confusion-demo-label">
            시연용 예시 기록 포함
          </span>
        )}
      </header>

      {!riskyPoint ? (
        <Notice>
          <b>아직 확인된 위험 구간이 없어요</b>
          <p>
            이 경로에 쌓인 혼란 기록이 없거나 아직 충분하지
            않아요.
          </p>
        </Notice>
      ) : (
        <>
          <div className="confusion-highlight">
            <div className="confusion-highlight-top">
              <span className="confusion-icon">
                <AlertTriangle
                  size={22}
                  strokeWidth={1.65}
                />
              </span>

              <span className="confusion-badge">
                혼란률 {riskyPoint.rate}%
              </span>

              <Tag
                tone={
                  levelTones[
                    confusionLevel(
                      riskyPoint.passages,
                      riskyPoint.confusions,
                    )
                  ]
                }
              >
                {confusionLevel(
                  riskyPoint.passages,
                  riskyPoint.confusions,
                )}
              </Tag>
            </div>

            <h2>{riskyPoint.name}</h2>

            <p>
              {riskyPoint.topReason
                ? `가장 많이 기록된 이유는 "${riskyPoint.topReason}"이에요.`
                : `이 구간의 혼란률은 ${riskyPoint.rate}%예요.`}
            </p>
          </div>

          <div className="confusion-mini-grid">
            <div className="confusion-mini-card">
              <span className="confusion-mini-icon">
                <MapPin size={19} strokeWidth={1.65} />
              </span>

              <div>
                <span className="confusion-mini-title">
                  헷갈리는 이유
                </span>
                <p>
                  {riskyPoint.topReason ??
                    "아직 혼란 원인 기록이 부족해요."}
                </p>
              </div>
            </div>

            <div className="confusion-mini-card">
              <span className="confusion-mini-icon">
                <Lightbulb
                  size={19}
                  strokeWidth={1.65}
                />
              </span>

              <div>
                <span className="confusion-mini-title">
                  이렇게 이동하세요
                </span>
                <p>
                  {getConfusionAdvice(
                    riskyPoint.topReason,
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="confusion-list">
            <div className="between">
              <h2>위험 구간 전체</h2>
              <span className="muted small">
                {riskyPoints.length}곳
              </span>
            </div>

           {riskyPoints.map((point, index) => (
  <article
    className="card confusion-list-card"
    key={point.id}
  >
    <div className="between">
      <div>
        <span className="muted small">
          {index === 0
            ? "가장 주의할 구간"
            : `${index + 1}번째 구간`}
        </span>

        <h3>{point.name}</h3>
      </div>

      <Tag
        tone={
          levelTones[
            confusionLevel(
              point.passages,
              point.confusions,
            )
          ]
        }
      >
        {confusionLevel(
          point.passages,
          point.confusions,
        )}
      </Tag>
    </div>

    <div className="confusion-list-stats">
      <span>
        혼란률 <strong>{point.rate}%</strong>
      </span>

      <span>
        기록{" "}
        <strong>
          {point.confusions}/{point.passages}
        </strong>
      </span>
    </div>

    <p>
      <strong>주요 원인</strong>{" "}
      {point.topReason ?? "아직 원인 기록이 부족해요."}
    </p>

    <p className="muted">
      {getConfusionAdvice(point.topReason)}
    </p>
  </article>
))}
          </div>
        </>
      )}
    </section>
  );
}