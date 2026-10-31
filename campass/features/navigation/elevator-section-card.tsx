"use client";
import { ArrowRightIcon, ElevatorIcon, SwapIcon } from "@/components/ui/icons";
import type { ElevatorSection, SectionStop } from "@/shared/utils/elevator-shortcut";
import { PLAZA } from "@/shared/utils/campus3d/route";

// 언덕 단면도. 검색 화면과 대화형 화면에서 함께 쓰려고 따로 둠
const WIDTH = 300;
const HEIGHT = 168;
const LEFT = 26;
const RIGHT = WIDTH - 26;
const TOP = 46;
const GROUND = 132;

const isBuilding = (stop: SectionStop) => stop.area !== PLAZA && Boolean(stop.enter.floor);
const shortName = (stop: SectionStop) =>
  stop.area === PLAZA ? "광장" : isBuilding(stop) ? stop.name : "정류장";

function stepText(stop: SectionStop, previous: SectionStop | undefined, last: boolean) {
  if (stop.area === PLAZA) return "스콘스퀘어를 지나요";
  const via = previous?.next === "passage" ? "연결통로 → " : "";
  const place = isBuilding(stop) ? `${stop.name} ${stop.enter.floor}` : stop.name;
  const ride = stop.inside === "elevator" ? `, 엘리베이터로 ${stop.exit.floor}` : "";
  return `${via}${place}${!previous ? "에서 출발" : ""}${ride}${last ? " 도착" : ""}`;
}

export function ElevatorSectionCard({
  section,
  busy = false,
  onStart,
  onReverse,
  onPickAgain,
}: {
  section: ElevatorSection;
  busy?: boolean;
  onStart: () => void;
  onReverse?: () => void;
  onPickAgain?: () => void;
}) {
  const { stops } = section;
  const levels = stops.flatMap((s) => [s.enter.elevation, s.exit.elevation])
    .filter((value): value is number => value !== null);
  const low = Math.min(...levels);
  const span = Math.max(...levels) - low || 1;
  const y = (elevation: number | null) => GROUND - (((elevation ?? low) - low) / span) * (GROUND - TOP);
  const x = (i: number) => stops.length > 1 ? LEFT + (i * (RIGHT - LEFT)) / (stops.length - 1) : WIDTH / 2;
  // 건물 바닥은 들어오고 나간 층 중 낮은 쪽. 그 높이를 이어 언덕 경사를 그림
  const ground = stops.map((s) => y(Math.min(s.enter.elevation ?? low, s.exit.elevation ?? low)));
  const hill = [`M0 ${ground[0]}`, ...stops.map((_, i) => `L${x(i)} ${ground[i]}`),
    `L${WIDTH} ${ground.at(-1)}`, `L${WIDTH} ${HEIGHT}`, `L0 ${HEIGHT}Z`].join(" ");
  const route = stops.flatMap((s, i) => [
    `${i ? "L" : "M"}${x(i)} ${y(s.enter.elevation)}`,
    `L${x(i)} ${y(s.exit.elevation)}`,
  ]).join(" ");
  const rise = section.rise === null ? 0 : Math.round(Math.abs(section.rise));
  const title = `${section.start.name} → ${section.destination.name}`;

  return (
    <div className="card elevator-section">
      <div className="elevator-section-head">
        <strong>{title}</strong>
        {rise > 0 && (
          <span className="elevator-section-badge">
            {section.rise! > 0 ? "오르막" : "내리막"} {rise}m 생략
          </span>
        )}
      </div>

      <svg
        className="elevator-section-figure"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`언덕 단면도: ${stops.map((s) => s.name).join(", ")}. 계단 없이 엘리베이터 ${section.elevators}번, 연결통로 ${section.passages}번`}
      >
        <path d={hill} className="elevator-section-hill" />
        {stops.map((stop, i) => {
          if (!isBuilding(stop)) return null;
          const top = Math.min(y(stop.enter.elevation), y(stop.exit.elevation)) - 16;
          const destination = i === stops.length - 1;
          return (
            <g key={stop.area} className={destination ? "elevator-section-building destination" : "elevator-section-building"}>
              <rect x={x(i) - 18} y={top} width={36} height={ground[i] - top + 2} rx={3} />
              <text x={x(i)} y={top - 5} textAnchor="middle" className="elevator-section-name">
                {shortName(stop)}
              </text>
              {[stop.enter, ...(stop.inside ? [stop.exit] : [])].map((p) => (
                <text key={p.node} x={x(i) + 4.5} y={y(p.elevation) - 2.5} className="elevator-section-floor">
                  {p.floor}
                </text>
              ))}
            </g>
          );
        })}
        {stops.map((stop, i) => isBuilding(stop) ? null : (
          <text key={stop.area} x={x(i)} y={ground[i] + 15} textAnchor="middle" className="elevator-section-name">
            {shortName(stop)}
          </text>
        ))}
        <path d={route} className="elevator-section-route" />
        <circle cx={x(0)} cy={y(stops[0].enter.elevation)} r={4.5} className="elevator-section-start" />
        <circle cx={x(stops.length - 1)} cy={y(stops.at(-1)!.exit.elevation)} r={4.5} className="elevator-section-end" />
      </svg>

      <ol className="elevator-section-steps">
        {stops.map((stop, i) => (
          <li key={stop.area}>{stepText(stop, stops[i - 1], i === stops.length - 1 && i > 0)}</li>
        ))}
      </ol>

      <p className="elevator-section-summary">
        <ElevatorIcon size={16} />
        엘리베이터 {section.elevators} · 연결통로 {section.passages} · 계단 {section.stairs}
      </p>

      <button type="button" className="button primary" disabled={busy} onClick={onStart}>
        이 길로 안내 시작 <ArrowRightIcon size={18} />
      </button>
      {(onReverse || onPickAgain) && (
        <div className="elevator-section-actions">
          {onReverse && (
            <button type="button" className="button secondary" onClick={onReverse}>
              <SwapIcon size={16} /> 반대로 보기
            </button>
          )}
          {onPickAgain && (
            <button type="button" className="button secondary" onClick={onPickAgain}>
              다른 건물 고르기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
