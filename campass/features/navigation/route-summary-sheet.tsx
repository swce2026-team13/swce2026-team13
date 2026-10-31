import type { ReactNode } from "react";
import {
  ArrowUpDown,
  Building,
  Footprints,
  Mountain,
  MoveUpRight,
  ArrowUpRight,
  TriangleAlert,
  PersonStanding,
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
  const middleName = option.steps.slice(1, -1).find((step) => step.name.includes("스콘스퀘어"))?.name;
  const showGrade = mode === "hill" && summary.rise !== null && summary.rise !== 0 && summary.grade !== null;
  return (
    <section className="route-summary-sheet" aria-label="선택한 경로 요약">
      <div className="route-sheet-handle" aria-hidden="true" />
      <div className="route-sheet-intro">
        <p className="route-sheet-title" style={{ color }}>
          {routeName(option)}{recommended && " · 추천"}
        </p>
        <h2 className="route-height-summary">
          {showGrade ? (
            <>
              <span className="route-height-label">{summary.rise! < 0 ? "내리막" : "오르막"}</span>
              <b>{Math.round(Math.abs(summary.rise!))}m</b>
              <span className="route-height-divider">·</span>
              <span className="route-height-label">평균 경사</span>
              <b>{summary.grade}%</b>
            </>
          ) : routeHeightText(option, summary)}
        </h2>
      </div>
      <div className="route-summary-chips">
        {chips.map((chip) => (
          <span key={chip} data-chip={chip}>
            {chip === "경사 있음" && <Mountain size={14} aria-hidden="true" />}
            {chip === "실외 길" && <PersonStanding size={14} aria-hidden="true" />}
            {chip === "현장 확인 전" && <TriangleAlert size={14} aria-hidden="true" />}
            {chip}
          </span>
        ))}
      </div>
      <div className="route-counts">
        <span>
          <MoveUpRight size={22} aria-hidden="true" />
          <span><b>{summary.stairs}</b><small>계단</small></span>
        </span>
        <span>
          <ArrowUpDown size={22} aria-hidden="true" />
          <span><b>{summary.elevators}</b><small>엘리베이터</small></span>
        </span>
        <span>
          <Building size={22} aria-hidden="true" />
          <span><b>{summary.buildings}</b><small>건물 통과</small></span>
        </span>
      </div>
      <div className="route-elevation-card">
        <div className="route-elevation-heading">
          <strong><Mountain size={17} aria-hidden="true" /> 높이 변화</strong>
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
                  height: `${12 + (max === min ? 0 : (bar.elevation - min) / (max - min)) * 36}px`,
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
            {middleName && <span>{middleName}</span>}
            <span>
              {destinationName} {Math.round(summary.endElevation!)}m
            </span>
          </div>
          </>
        ) : (
          <p className="muted">이 경로의 높이 자료가 아직 없어요.</p>
        )}
      </div>
      {warning}
      <ol className="route-timeline">
        {option.steps.map((step, index) => {
          const kind = routeStepKind(option, step);
          const Icon = icons[kind];
          return (
            <li key={`${step.id}-${index}`} data-kind={index === 0 ? "start" : index === option.steps.length - 1 ? "destination" : kind}>
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
