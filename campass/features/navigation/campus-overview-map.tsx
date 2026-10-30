"use client";
import { useId, useState, type KeyboardEvent } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  overviewBuildings,
  overviewLinks,
  overviewMarkers,
  overviewPlaza,
  overviewLinkPair,
  type OverviewRouteHighlight,
  type MarkerKind,
} from "@/shared/utils/campus-overview";

const ZOOMS = [1, 1.5, 2];
const MARKER = 16;

// 지도 표시 아이콘(18×18 원본)의 그림 부분
function MarkerGlyph({ kind }: { kind: MarkerKind }) {
  const line = {
    stroke: "white",
    strokeWidth: 1.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  const badge =
    kind === "gate"
      ? { rx: 5, fill: "#1B2333" }
      : { rx: kind === "bus" ? 8 : 4, fill: "#2563EB" };
  return (
    <>
      <rect
        x="1"
        y="1"
        width="16"
        height="16"
        rx={badge.rx}
        fill={badge.fill}
      />
      <rect
        x="0.6"
        y="0.6"
        width="16.8"
        height="16.8"
        rx={badge.rx + 0.4}
        fill="none"
        stroke="white"
        strokeWidth="1.2"
      />
      <g transform="translate(-2.2 -1.2)" {...line}>
        {kind === "bus" && (
          <path d="M9.367 7.45V10.2M12.575 7.45V10.2M6.617 10.2H15.6M13.95 12.95H15.326C15.326 12.95 15.555 12.171 15.692 11.667C15.738 11.483 15.784 11.3 15.784 11.117C15.784 10.933 15.738 10.75 15.692 10.567L15.05 8.275C14.913 7.817 14.455 7.45 13.95 7.45H7.534C7.291 7.45 7.058 7.547 6.886 7.719C6.714 7.89 6.617 8.124 6.617 8.367V12.95H7.992M9.825 12.95H12.117M8.909 13.867C9.415 13.867 9.826 13.456 9.826 12.95C9.826 12.444 9.415 12.033 8.909 12.033C8.403 12.033 7.992 12.444 7.992 12.95C7.992 13.456 8.403 13.867 8.909 13.867ZM13.034 13.867C13.54 13.867 13.951 13.456 13.951 12.95C13.951 12.444 13.54 12.033 13.034 12.033C12.528 12.033 12.117 12.444 12.117 12.95C12.117 13.456 12.528 13.867 13.034 13.867Z" />
        )}
        {kind === "parking" && (
          <path d="M9.825 12.95V7.45H11.888C12.313 7.45 12.721 7.619 13.022 7.92C13.323 8.221 13.492 8.629 13.492 9.054C13.492 9.48 13.323 9.888 13.022 10.189C12.721 10.489 12.313 10.658 11.888 10.658H9.825" />
        )}
        {kind === "gate" && (
          <path d="M7.992 14.325V9.283C7.992 8.432 8.33 7.616 8.932 7.015C9.534 6.413 10.35 6.075 11.2 6.075C12.051 6.075 12.868 6.413 13.469 7.015C14.071 7.616 14.409 8.432 14.409 9.283V14.325M7.075 14.325H15.325M11.2 6.533V14.325M10.055 11.117V11.575M12.346 11.117V11.575" />
        )}
      </g>
    </>
  );
}

export type PinKind = "cafe" | "store" | "dining" | "aed" | "etc" | "mixed";

// 편의시설 핀. 같은 건물 시설을 하나로 묶고 개수를 보여 줌
export type MapPin = {
  id: string;
  position: [number, number];
  label: string;
  count: number;
  kind: PinKind;
};

export const pinColors: Record<PinKind, string> = {
  cafe: "#8B5E3C",
  store: "#16A34A",
  dining: "#EA580C",
  aed: "#DC2626",
  etc: "#64748B",
  mixed: "#2563EB",
};

// 핀 안의 흰 그림 (10×10)
const pinGlyphs: Record<PinKind, string> = {
  cafe: "M2 4H7V6.5A2 2 0 0 1 5 8.5H4A2 2 0 0 1 2 6.5Z M7 4.8H7.6A1.1 1.1 0 0 1 7.6 7H7",
  store: "M2.2 4H7.8L7.3 8.6H2.7Z M3.6 4A1.4 1.4 0 0 1 6.4 4",
  dining:
    "M3 1.5V8.5 M2 1.5V3.3A1 1 0 0 0 4 3.3V1.5 M7 1.5C6 2.5 6 4.3 7 5V8.5",
  aed: "M5 8.3S1.6 6.2 1.6 3.9A1.7 1.7 0 0 1 5 3.1A1.7 1.7 0 0 1 8.4 3.9C8.4 6.2 5 8.3 5 8.3Z M5 3.6L4.4 5.2H5.6L5 6.6",
  etc: "M2.8 8.6V2H7.2V8.6 M4 3.6H6 M4 5.2H6 M4 6.8H6",
  mixed: "M2.5 5H7.5 M5 2.5V7.5",
};

export function CampusOverviewMap({
  selected = [],
  startable = [],
  onSelect,
  pins,
  selectedPin,
  onPin,
  highlight,
  pickerMode = false,
}: {
  selected?: string[];
  // 출발로 고를 수 있는 지도 표시 id
  startable?: string[];
  onSelect?: (id: string, building: boolean) => void;
  // 핀이 있으면 건물 · 정류장은 보기만 하고 핀만 누를 수 있음
  pins?: MapPin[];
  selectedPin?: string;
  onPin?: (id: string) => void;
  highlight?: OverviewRouteHighlight;
  pickerMode?: boolean;
}) {
  const viewOnly = Boolean(pins || highlight);
  const state = (area: string) =>
    highlight?.currentArea === area
      ? "current"
      : highlight?.areas.has(area)
        ? "route"
        : undefined;
  const routeFill = (area: string) =>
    state(area) === "current"
      ? "#2563EB"
      : state(area) === "route"
        ? "#BFDBFE"
        : undefined;
  const labelFill = (area: string, fallback: string) =>
    state(area) === "current" ? "white" : fallback;
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [zoom, setZoom] = useState(0);
  const scale = ZOOMS[zoom];
  const width = MAP_WIDTH / scale;
  const height = MAP_HEIGHT / scale;
  const viewBox = `${(MAP_WIDTH - width) / 2} ${(MAP_HEIGHT - height) / 2} ${width} ${height}`;

  const button = (action: () => void) => ({
    role: "button",
    tabIndex: 0,
    onClick: action,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      action();
    },
  });
  const press = (target: string, building: boolean) =>
    viewOnly ? {} : button(() => onSelect?.(target, building));
  const pressable = viewOnly ? undefined : "overview-building";

  return (
    <div className={`overview-map${pickerMode ? " map-picker-surface" : ""}`}>
      <svg
        viewBox={viewBox}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        aria-label={
          highlight
            ? "캠퍼스 개요도. 선택한 경로와 현재 위치"
            : viewOnly
              ? "캠퍼스 개요도. 편의시설 핀을 눌러 보세요"
              : "캠퍼스 개요도. 건물을 눌러 출발과 도착을 고르세요"
        }
      >
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#F8FAFD" />
            <stop offset="1" stopColor="#EDF2F9" />
          </linearGradient>
          <linearGradient id={`${id}-plaza`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#D1EBC7" />
            <stop offset="1" stopColor="#C2E3B8" />
          </linearGradient>
          {overviewBuildings
            .filter((b) => b.colors.length > 1)
            .map((b) => (
              <linearGradient
                key={b.id}
                id={`${id}-${b.id}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0.25" stopColor={b.colors[0]} />
                <stop offset="0.75" stopColor={b.colors[1]} />
              </linearGradient>
            ))}
        </defs>

        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill={`url(#${id}-bg)`} />

        <g
          className={pressable}
          aria-label={highlight || !viewOnly ? "스콘스퀘어" : undefined}
          data-route-state={state("스콘스퀘어")}
          aria-pressed={viewOnly ? undefined : selected.includes("스콘스퀘어")}
          {...press("스콘스퀘어", true)}
        >
          <polygon
            points={overviewPlaza.points}
            fill={routeFill("스콘스퀘어") ?? `url(#${id}-plaza)`}
            stroke={
              state("스콘스퀘어") || selected.includes("스콘스퀘어")
                ? "#2563EB"
                : "white"
            }
            strokeWidth={
              state("스콘스퀘어") || selected.includes("스콘스퀘어") ? 2 : 1.5
            }
            strokeLinejoin="round"
          />
        </g>
        <polygon
          className="overview-outline"
          points={overviewPlaza.outline}
          fill="none"
          stroke="#9AA3B2"
          strokeWidth="1"
          strokeDasharray="3 2"
        />

        {overviewBuildings.map((b) => {
          const on = Boolean(state(b.id)) || selected.includes(b.id);
          return (
            <g
              key={b.id}
              className={pressable}
              aria-label={highlight || !viewOnly ? b.name : undefined}
              data-route-state={state(b.id)}
              aria-pressed={viewOnly ? undefined : on}
              {...press(b.id, true)}
            >
              <polygon
                points={b.points}
                fill={
                  routeFill(b.id) ??
                  (b.colors.length > 1 ? `url(#${id}-${b.id})` : b.colors[0])
                }
                stroke={on ? "#2563EB" : "white"}
                strokeWidth={on ? 2 : 1.2}
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {overviewLinks.map((l) => {
          const pair = overviewLinkPair(l.id);
          const current = Boolean(pair && highlight?.currentPair === pair);
          const on = current || Boolean(pair && highlight?.pairs.has(pair));
          return (
            <line
              key={l.id}
              data-route-state={current ? "current" : on ? "route" : undefined}
              data-route-pair={highlight ? pair : undefined}
              x1={l.from[0]}
              y1={l.from[1]}
              x2={l.to[0]}
              y2={l.to[1]}
              stroke={on || l.status === "확인" ? "#2563EB" : "#9AA3B2"}
              strokeWidth={current ? 5 : on ? 3 : l.status === "확인" ? 2 : 1.4}
              strokeDasharray={
                on ? undefined : l.status === "확인" ? "3 2" : "2 2"
              }
              strokeLinecap="round"
            />
          );
        })}

        <g className="overview-labels" textAnchor="middle">
          {overviewBuildings.map((b) => (
            <g key={b.id}>
              <text
                x={b.center[0]}
                y={b.center[1] + (b.sub ? -1 : 3)}
                fontSize="9"
                fontWeight={b.bold ? 700 : 400}
                fill={labelFill(b.id, b.text)}
              >
                {b.label}
              </text>
              {b.sub && (
                <text
                  x={b.center[0]}
                  y={b.center[1] + 7}
                  fontSize="6"
                  fill={labelFill(b.id, "#66738A")}
                >
                  {b.sub}
                </text>
              )}
            </g>
          ))}
          <text
            x={overviewPlaza.center[0]}
            y={overviewPlaza.center[1] - 18}
            fontSize="7"
            fontWeight="700"
            fill={labelFill("스콘스퀘어", "#2563EB")}
          >
            지하주차장 P1
          </text>
          <text
            x={overviewPlaza.center[0]}
            y={overviewPlaza.center[1] + 2}
            fontSize="11"
            fill={labelFill("스콘스퀘어", "#3E5A45")}
          >
            스콘스퀘어
          </text>
          <text
            x={overviewPlaza.center[0]}
            y={overviewPlaza.center[1] + 11}
            fontSize="6"
            fill={labelFill("스콘스퀘어", "#5C6880")}
          >
            아래가 지하주차장
          </text>
        </g>

        {overviewMarkers.map((m) => {
          const [x, y] = m.position;
          const canStart = !viewOnly && startable.includes(m.id);
          const current = highlight?.currentMarker === m.id;
          const on =
            current || highlight?.markers.has(m.id) || selected.includes(m.id);
          const glyph = (
            <>
              {on && (
                <circle
                  cx={x}
                  cy={y}
                  r={MARKER / 2 + 3}
                  fill={current ? "#BFDBFE" : "none"}
                  stroke="#2563EB"
                  strokeWidth={current ? 4 : 2}
                />
              )}
              <g
                transform={`translate(${x - MARKER / 2} ${y - MARKER / 2}) scale(${MARKER / 18})`}
              >
                <MarkerGlyph kind={m.kind} />
              </g>
              <text
                x={
                  m.labelAt === "left"
                    ? x - MARKER / 2 - 3
                    : m.labelAt === "right"
                      ? x + MARKER / 2 + 3
                      : x
                }
                y={m.labelAt === "below" ? y + MARKER / 2 + 9 : y + 3}
                textAnchor={
                  m.labelAt === "left"
                    ? "end"
                    : m.labelAt === "right"
                      ? "start"
                      : "middle"
                }
                fontSize="8"
                fontWeight="700"
                fill="#334054"
                className="overview-marker-label"
              >
                {m.label}
              </text>
            </>
          );
          return canStart ? (
            <g
              key={m.id}
              className="overview-marker"
              aria-label={`${m.label} 출발`}
              aria-pressed={on}
              {...press(m.id, false)}
            >
              {glyph}
            </g>
          ) : (
            <g
              key={m.id}
              aria-hidden={highlight ? undefined : true}
              aria-label={highlight ? m.label : undefined}
              data-route-state={
                highlight && on ? (current ? "current" : "route") : undefined
              }
            >
              {glyph}
            </g>
          );
        })}

        {!highlight &&
          pins?.map((pin) => {
            const [x, y] = pin.position;
            const on = pin.id === selectedPin;
            const r = on ? 11 : 9;
            const color = pinColors[pin.kind];
            return (
              <g
                key={pin.id}
                className={`overview-pin ${on ? "on" : ""}`}
                aria-label={`${pin.label} 편의시설 ${pin.count}곳`}
                aria-pressed={on}
                {...button(() => onPin?.(pin.id))}
              >
                {on && (
                  <circle cx={x} cy={y} r={r + 4} fill={color} opacity="0.18" />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={color}
                  stroke="white"
                  strokeWidth="1.5"
                />
                <path
                  d={pinGlyphs[pin.kind]}
                  transform={`translate(${x - (on ? 6 : 5)} ${y - (on ? 6 : 5)}) scale(${on ? 1.2 : 1})`}
                  fill="none"
                  stroke="white"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pin.count > 1 && (
                  <>
                    <circle
                      cx={x + r - 1}
                      cy={y - r + 1}
                      r="5.5"
                      fill="white"
                      stroke={color}
                    />
                    <text
                      x={x + r - 1}
                      y={y - r + 3.4}
                      textAnchor="middle"
                      fontSize="7"
                      fontWeight="700"
                      fill={color}
                    >
                      {pin.count}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        {/* Draw all outlines first so white caps never interrupt the red route. */}
        <g pointerEvents="none" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {[{ color: "white", width: 7 }, { color: "#dc2626", width: 4 }].map(({ color, width }) => (
            <g key={color} stroke={color} strokeWidth={width}>
              {highlight?.segments.map(([from, to], index) => (
                <line key={index} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />
              ))}
            </g>
          ))}
        </g>
      </svg>
      {pickerMode && (
        <button type="button" className="map-fit-all" onClick={() => setZoom(0)}>
          <Maximize size={14} /> 전체 보기
        </button>
      )}
      <svg className="overview-north" viewBox="0 0 7 18" aria-hidden="true">
        <path d="M0 9L3.5 0L7 9L3.5 7Z" fill="#192334" />
        <text
          x="3.5"
          y="17"
          textAnchor="middle"
          fontSize="6.6"
          fontWeight="700"
          fill="#192334"
        >
          N
        </text>
      </svg>
      <div className="zoom">
        <button
          aria-label="지도 확대"
          disabled={zoom >= ZOOMS.length - 1}
          onClick={() => setZoom(zoom + 1)}
        >
          <Plus size={18} strokeWidth={1.65} />
        </button>
        <button
          aria-label="지도 축소"
          disabled={zoom <= 0}
          onClick={() => setZoom(zoom - 1)}
        >
          <Minus size={18} strokeWidth={1.65} />
        </button>
      </div>
    </div>
  );
}
