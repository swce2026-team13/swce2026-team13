import { useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  Building,
  DoorOpen,
  Footprints,
  Mountain,
  MoveUpRight,
  ArrowUpRight,
  TriangleAlert,
  PersonStanding,
} from "lucide-react";
import type { RouteOption } from "@/shared/utils/routing";
import { routeSummary, routeChips } from "@/shared/utils/route-summary";
import { routeColors, routeMode, routeName } from "@/shared/utils/route-presentation";
import { guideStepItems, visibleStepItems, type GuideStepItem } from "@/shared/utils/guide-instruction";

const icons: Record<GuideStepItem["kind"], typeof Footprints> = {
  start: Footprints,
  destination: Footprints,
  walk: Footprints,
  hill: Mountain,
  stairs: MoveUpRight,
  passage: Building,
  entrance: DoorOpen,
  elevator: ArrowUpDown,
};

export function RouteSummarySheet({
  option,
  recommended,
  destinationName,
  warning,
}: {
  option: RouteOption;
  recommended: boolean;
  destinationName: string;
  warning?: ReactNode;
}) {
  const summary = routeSummary(option);
  const mode = routeMode(option);
  const color = routeColors[mode];
  const chips = routeChips(option, summary);
  // 단계 목록: 안내 중 화면의 안내 단계(묶음)와 같은 단위. 5개를 넘으면 주요 지점만
  const items = guideStepItems(option, option.steps, destinationName);
  // 주요 지점은 최대 5곳. 숨길 단계는 모두 모아 첫 숨긴 자리에 버튼 하나만 둠
  const visible = visibleStepItems(items);
  const hiddenCount = visible.filter((shown) => !shown).length;
  const folding = hiddenCount > 0;
  const firstHidden = visible.indexOf(false);
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="route-summary-sheet" aria-label="선택한 경로 요약">
      <div className="route-sheet-handle" aria-hidden="true" />
      <div className="route-sheet-intro">
        <p className="route-sheet-title" style={{ color }}>
          {routeName(option)}{recommended && " · 추천"}
        </p>
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
      {warning}
      <div className="route-timeline-heading">
        <strong>이렇게 이동해요</strong>
        {folding && <small>전체 {items.length}단계 · 주요 {items.length - hiddenCount}곳</small>}
      </div>
      <ol className="route-timeline">
        {items.map((item, index) => {
          const hidden = !visible[index];
          const toggle = index === firstHidden;
          if (hidden && !expanded)
            return toggle ? (
              <li key="gap" className="route-timeline-gap">
                <button type="button" onClick={() => setExpanded(true)}>
                  ··· 중간 {hiddenCount}단계 더 보기
                </button>
              </li>
            ) : null;
          if (hidden)
            return (
              <li key={index} className="route-timeline-minor">
                <span className="route-timeline-dot" aria-hidden="true" />
                <span>{item.title}</span>
                {toggle && (
                  <button type="button" onClick={() => setExpanded(false)}>중간 단계 접기</button>
                )}
              </li>
            );
          const Icon = icons[item.kind];
          return (
            <li key={index} data-kind={item.kind}>
              <span className="route-step-icon">
                <Icon size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.instruction}</p>
              </div>
              {item.kind === "destination" && <ArrowUpRight size={16} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
