import type { ReactNode } from "react";
import {
  ArrowUpDown,
  Building,
  Footprints,
  Mountain,
  MoveUpRight,
  ArrowUpRight,
} from "lucide-react";
import type { RouteOption } from "@/shared/utils/routing";
import {
  routeSummary,
  routeChips,
  routeHeightText,
  routeStepKind,
  type MovementKind,
} from "@/shared/utils/route-summary";
import {
  routeColors,
  routeMode,
  routeName,
} from "@/shared/utils/route-presentation";

const icons: Record<MovementKind, typeof Footprints> = {
  walk: Footprints,
  hill: Mountain,
  stairs: MoveUpRight,
  indoor: Building,
  elevator: ArrowUpDown,
};
export function RouteSummarySheet({
  option,
  recommended,
  startName,
  destinationName,
  warning,
}: {
  option: RouteOption;
  recommended: boolean;
  startName: string;
  destinationName: string;
  warning?: ReactNode;
}) {
  const summary = routeSummary(option);
  const mode = routeMode(option);
  const color = routeColors[mode];
  const min = Math.min(...summary.bars.map((bar) => bar.elevation));
  const max = Math.max(...summary.bars.map((bar) => bar.elevation));
  const chips = routeChips(option, summary);
  return (
    <section className="route-summary-sheet" aria-label="선택한 경로 요약">
      <div className="route-sheet-handle" aria-hidden="true" />
      <p className="route-sheet-title" style={{ color }}>
        {routeName(option)}
        {recommended && " · 추천"}
      </p>
      <h2 className="route-height-summary">
        {routeHeightText(option, summary)}
      </h2>
      <div className="route-summary-chips">
        {chips.map((chip) => (
          <span key={String(chip)}>{chip}</span>
        ))}
      </div>
      <div className="route-counts">
        <span>
          <MoveUpRight size={18} aria-hidden="true" />
          계단 <b>{summary.stairs}</b>
        </span>
        <span>
          <ArrowUpDown size={18} aria-hidden="true" />
          엘리베이터 <b>{summary.elevators}</b>
        </span>
        <span>
          <Building size={18} aria-hidden="true" />
          건물 통과 <b>{summary.buildings}</b>
        </span>
      </div>
      <div className="route-elevation-heading">
        <strong>높이 변화</strong>
        <small>높이는 지형도 기준 추정</small>
      </div>
      {summary.bars.length > 0 ? (
        <>
          <div
            className="route-elevation-bars"
            role="img"
            aria-label={`높이 변화: 출발 ${Math.round(summary.startElevation!)}m, 도착 ${Math.round(summary.endElevation!)}m. 주황은 경사 8% 초과, 초록은 완만한 구간, 남색은 엘리베이터 구간`}
          >
            {summary.bars.map((bar, i) => (
              <span
                key={i}
                title={`${Math.round(bar.elevation)}m`}
                style={{
                  height: `${24 + (max === min ? 0 : (bar.elevation - min) / (max - min)) * 64}px`,
                  background:
                    bar.kind === "elevator"
                      ? "#10223f"
                      : bar.kind === "steep"
                        ? "#e9a23b"
                        : "#7cc08a",
                }}
              />
            ))}
          </div>
          <div className="route-elevation-labels">
            <span>
              {startName} {Math.round(summary.startElevation!)}m
            </span>
            <span>
              {destinationName} {Math.round(summary.endElevation!)}m
            </span>
          </div>
        </>
      ) : (
        <p className="muted">이 경로의 높이 자료가 아직 없어요.</p>
      )}
      {warning}
      <ol className="route-timeline">
        {option.steps.map((step, index) => {
          const Icon = icons[routeStepKind(option, step)];
          return (
            <li key={`${step.id}-${index}`}>
              <span className="route-step-icon">
                <Icon size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>{step.name}</strong>
                <p>{step.instruction}</p>
              </div>
              {index === option.steps.length - 1 && (
                <ArrowUpRight size={16} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
