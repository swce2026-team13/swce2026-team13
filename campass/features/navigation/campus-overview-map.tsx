"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { routeSegments, type CampusCoordinate } from "@/shared/utils/campus-map";
import { EntrancePins } from "./entrance-pins";
import { layoutEntrancePins, mapEntrances } from "./map-entrances";
import { DoorOpen, ArrowUpDown, Maximize, Minus, Plus } from "lucide-react";
import type { BuildingDetailData } from "@/shared/types/building-detail";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  project,
  overviewBuildings,
  overviewLinks,
  overviewLinkPair,
  type OverviewRouteHighlight,
} from "@/shared/utils/campus-overview";

import {
  landPath,
  buildingPaths,
  plazaPath,
  overviewFrame,
  overviewRoads,
  overviewCourts,
  overviewTrees,
  hillLabel,
  plazaLabel,
  buildingLabelPositions,
} from "@/shared/utils/campus-overview-design";

const ZOOMS = [1, 1.5, 2];

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
  onEntrance,
  onResetView,
  buildingPicker = false,
  height: requestedHeight,
  focusBuilding,
  backgroundOnly = false,
  routePreview,
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
  onEntrance?: (id: string) => void;
  onResetView?: () => void;
  // 건물·강의실 탭에서만 입구를 숨기고 이름표도 건물 선택 영역으로 쓴다.
  buildingPicker?: boolean;
  height?: number;
  focusBuilding?: Pick<
    BuildingDetailData,
    "id" | "name" | "entrances" | "elevator"
  >;
    backgroundOnly?: boolean;
  routePreview?: { nodes: string[]; name: string; color: string };
}) {
  const viewOnly = Boolean(pins || highlight || focusBuilding || routePreview);
  const destinationArea = routePreview?.nodes.at(-1)?.split("|")[0];
  const state = (area: string) =>
    destinationArea === area ? "current" :
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scale = ZOOMS[zoom];
  const aspect = requestedHeight
    ? (size.width || MAP_WIDTH) / requestedHeight
    : MAP_WIDTH / MAP_HEIGHT;
  const focusedIndex = overviewBuildings.findIndex(
    (b) => b.id === focusBuilding?.id,
  );
  const focused = overviewBuildings[focusedIndex];
  const focusPoints = focused
    ? [
        ...focused.points
          .split(" ")
          .map((p) => p.split(",").map(Number) as [number, number]),
        ...(focusBuilding?.entrances ?? []).map((entrance) =>
          project(entrance.local),
        ),
      ]
    : [];
  const previewSegments = routePreview ? routeSegments(routePreview.nodes) : [];
  const previewPoints = previewSegments.flat().map((p) => project([p.east, p.north]));
  const previewBounds = previewPoints.length ? {
    left: Math.min(...previewPoints.map(([x]) => x)) - 28,
    right: Math.max(...previewPoints.map(([x]) => x)) + 28,
    top: Math.min(...previewPoints.map(([, y]) => y)) - 35,
    bottom: Math.max(...previewPoints.map(([, y]) => y)) + 28,
  } : null;
  const bounds = previewBounds ?? (focused
    ? {
        left: Math.min(...focusPoints.map(([x]) => x)),
        right: Math.max(...focusPoints.map(([x]) => x)),
        top: Math.min(...focusPoints.map(([, y]) => y)),
        bottom: Math.max(...focusPoints.map(([, y]) => y)),
      }
    : null);
  const focusScale = bounds
    ? Math.min(
        ((size.width || MAP_WIDTH) - 64) /
          Math.max(1, bounds.right - bounds.left),
        ((requestedHeight || MAP_HEIGHT) - 88) /
          Math.max(1, bounds.bottom - bounds.top),
      )
    : 1;
  const frameWidth = bounds
    ? (size.width || MAP_WIDTH) / focusScale
    : Math.max(overviewFrame.width, overviewFrame.height * aspect);
  const width = frameWidth / scale;
  const height = frameWidth / aspect / scale;
  const viewLeft =
    (bounds ? (bounds.left + bounds.right) / 2 : overviewFrame.cx) - width / 2;
  const viewTop =
    (bounds
      ? (bounds.top + bounds.bottom) / 2 - 14 / focusScale
      : overviewFrame.cy) -
    height / 2;
  const viewBox = `${viewLeft} ${viewTop} ${width} ${height}`;
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);
  const screenPoint = ([x, y]: [number, number]) => [
    ((x - viewLeft) * size.width) / width,
    ((y - viewTop) * size.height) / height,
  ];
  const labelScale = width / (size.width || MAP_WIDTH);
  const focusLabel = focused
    ? ((
        [
          [0, 0],
          [0, -26],
          [26, 0],
          [-26, 0],
          [0, 26],
        ] as [number, number][]
      )
        .map(([x, y]): [number, number] => [
          focused.center[0] + x * labelScale,
          focused.center[1] + y * labelScale,
        ])
        .find(([x, y]) =>
          (focusBuilding?.entrances ?? []).every((entrance) => {
            const [ex, ey] = project(entrance.local);
            const dx = (ex - x) / labelScale,
              dy = (ey - y) / labelScale;
            return (
              (Math.abs(dx) > (focused.name.length * 11 + 10) / 2 + 14 ||
                Math.abs(dy) > 24) &&
              (!focusBuilding?.elevator || Math.hypot(dx, dy - 30) > 26)
            );
          }),
        ) ?? focused.center)
    : undefined;
  const entrancePositions = size.width
    ? layoutEntrancePins(
        mapEntrances.map((pin) => {
          const [x, y] = screenPoint(project(pin.local));
          return { id: pin.id, x, y, visible: true };
        }),
        size.width,
        size.height,
        [
          ...overviewBuildings.map((b, i) => {
            const [x, y] = screenPoint(buildingLabelPositions[i]);
            const w = b.label.length * 11 + 10;
            return {
              left: x - w / 2,
              right: x + w / 2,
              top: y - 10,
              bottom: y + 10,
            };
          }),
          ...(pins ?? []).map((pin) => {
            const [x, y] = screenPoint(pin.position);
            const r = (pin.id === selectedPin ? 16 : 14) / labelScale;
            return { left: x - r, right: x + r, top: y - r, bottom: y + r };
          }),
          (() => {
            const [x, y] = screenPoint(plazaLabel);
            return { left: x - 38, right: x + 38, top: y - 10, bottom: y + 10 };
          })(),
        ],
        true,
      )
    : [];

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
    viewOnly || (buildingPicker && target === "스콘스퀘어")
      ? {}
      : button(() => onSelect?.(target, building));
  const pressable = viewOnly ? undefined : "overview-building";

  return (
    <div
  className={`overview-map${pickerMode ? " map-picker-surface" : ""}${
    backgroundOnly ? " overview-map-background-only" : ""
  }`}
>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        style={requestedHeight ? { height: requestedHeight } : undefined}
        aria-label={
          focused
            ? `${focused.name} 건물과 입구 지도`
            : highlight
              ? "캠퍼스 개요도. 선택한 경로와 현재 위치"
              : routePreview
                ? "캠퍼스 경로 미리보기. 초록 출발점과 파란 도착 깃발"
                : viewOnly
                ? "캠퍼스 개요도. 편의시설 핀을 눌러 보세요"
                : buildingPicker
                  ? "캠퍼스 지도. 건물을 눌러 상세 안내를 보세요"
                  : "캠퍼스 개요도. 건물을 눌러 출발과 도착을 고르세요"
        }
      >
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#F8FAFD" />
            <stop offset="1" stopColor="#EDF2F9" />
          </linearGradient>
          <clipPath id={`${id}-plaza-clip`}>
            <path d={plazaPath} />
          </clipPath>
        </defs>

        <rect
          x={viewLeft}
          y={viewTop}
          width={width}
          height={height}
          fill={`url(#${id}-bg)`}
        />
        <g pointerEvents="none" aria-hidden="true">
          <path d={landPath} fill="#e3ecda" />
          {overviewRoads.map((road, i) => (
            <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={road.path} stroke="#d9cfba" strokeWidth={7} />
              <path d={road.path} stroke="#f6f1e6" strokeWidth={5} />
              {road.hill && (
                <path
                  d={road.path}
                  stroke="#e3d8c2"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
              )}
            </g>
          ))}
          <text
            x={hillLabel.x}
            y={hillLabel.y}
            transform={`rotate(${hillLabel.angle} ${hillLabel.x} ${hillLabel.y})`}
            textAnchor="middle"
            fontSize={10 * labelScale}
            fill="#8a7a5a"
          >
            언덕길
          </text>
          {overviewTrees
            .filter((tree) => {
              // 확대 후에도 고정된 지도 버튼 뒤로 나무가 들어오지 않게 한다.
              const x = (tree.x - viewLeft) / labelScale;
              const y = (tree.y - viewTop) / labelScale;
              const r = tree.r / labelScale;
              const screenWidth = size.width || MAP_WIDTH;
              const screenHeight = size.height || MAP_HEIGHT;
              return (
                !(x + r > screenWidth - 112 && y - r < 112) &&
                !(x + r > screenWidth - 64 && y + r > screenHeight - 108)
              );
            })
            .map((tree, i) => (
              <g key={i} transform={`translate(${tree.x} ${tree.y})`}>
                <ellipse
                  cx={1.4}
                  cy={1.8}
                  rx={tree.r}
                  ry={tree.r * 0.8}
                  fill="rgba(46,74,44,0.18)"
                />
                <circle
                  r={tree.r}
                  fill={tree.color}
                  stroke="#7aa868"
                  strokeWidth={0.6}
                />
                <circle
                  cx={-tree.r * 0.3}
                  cy={-tree.r * 0.3}
                  r={tree.r * 0.42}
                  fill="rgba(255,255,255,0.28)"
                />
              </g>
            ))}
          {buildingPaths.map((path, i) => (
            <path
              key={i}
              d={path}
              transform="translate(0 1.8)"
              fill="rgba(32,45,70,0.12)"
            />
          ))}
        </g>

        <g
          className={pressable}
          aria-label={highlight || !viewOnly ? "스콘스퀘어" : undefined}
          data-route-state={state("스콘스퀘어")}
          aria-pressed={viewOnly ? undefined : selected.includes("스콘스퀘어")}
          {...press("스콘스퀘어", true)}
        >
          <path
            d={plazaPath}
            fill={routeFill("스콘스퀘어") ?? "#d6ebcf"}
            stroke={
              state("스콘스퀘어") || selected.includes("스콘스퀘어")
                ? "#2563EB"
                : "#bad7b0"
            }
            strokeWidth={
              state("스콘스퀘어") || selected.includes("스콘스퀘어") ? 2 : 1
            }
            strokeLinejoin="round"
          />
        </g>
        <g
          pointerEvents="none"
          aria-hidden="true"
          clipPath={`url(#${id}-plaza-clip)`}
        >
          {overviewCourts.map((court, i) => (
            <g
              key={i}
              transform={`translate(${court.x} ${court.y}) rotate(${court.angle})`}
              stroke="white"
              strokeWidth={0.8}
            >
              <rect
                x={-court.width / 2}
                y={-court.height / 2}
                width={court.width}
                height={court.height}
                rx={1}
                fill={court.color}
              />
              <g fill="none">
                <path d={`M0 ${-court.height / 2} V${court.height / 2}`} />
                <circle r={court.height * 0.18} />
                <path
                  d={`M${-court.width / 2} ${-court.height * 0.28} A${court.height * 0.28} ${court.height * 0.28} 0 0 1 ${-court.width / 2} ${court.height * 0.28}`}
                />
                <path
                  d={`M${court.width / 2} ${-court.height * 0.28} A${court.height * 0.28} ${court.height * 0.28} 0 0 0 ${court.width / 2} ${court.height * 0.28}`}
                />
              </g>
            </g>
          ))}
        </g>

        {overviewBuildings.map((b, index) => {
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
              <path
                d={buildingPaths[index]}
                fill={routeFill(b.id) ?? b.colors[0]}
                stroke={on ? "#2563EB" : "#b5bfcd"}
                strokeWidth={on ? 2 : 1}
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {overviewLinks.map((l) => {
          const pair = overviewLinkPair(l.id);
          const current = Boolean(pair && highlight?.currentPair === pair);
          const on = current || Boolean(pair && highlight?.pairs.has(pair));
          if (!on) return null;
          return (
            <line
              key={l.id}
              data-route-state={current ? "current" : "route"}
              data-route-pair={highlight ? pair : undefined}
              x1={l.from[0]}
              y1={l.from[1]}
              x2={l.to[0]}
              y2={l.to[1]}
              stroke="#2563EB"
              strokeWidth={current ? 5 : 3}
              strokeLinecap="round"
            />
          );
        })}

        {focused && (
          <g pointerEvents="none" aria-hidden="true">
            <rect
              x={viewLeft}
              y={viewTop}
              width={width}
              height={height}
              fill="rgba(241,244,248,0.66)"
            />
            <path
              d={buildingPaths[focusedIndex]}
              transform={`translate(0 ${2 * labelScale})`}
              fill="rgba(32,45,70,0.18)"
            />
            <path
              d={buildingPaths[focusedIndex]}
              fill="none"
              stroke="rgba(40,96,237,0.22)"
              strokeWidth={10}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={buildingPaths[focusedIndex]}
              fill="#5c8cf1"
              stroke="#2860ed"
              strokeWidth={1.8}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
{!backgroundOnly && (
  <g
    className="overview-labels"
          textAnchor="middle"
          fontSize={11}
          fontWeight={500}
        >
          {(focused
            ? [{ id: focused.id, label: focused.name, at: focusLabel! }]
            : [
                ...overviewBuildings.map((b, i) => ({
                  id: b.id,
                  label: b.label,
                  at: buildingLabelPositions[i],
                })),
                { id: "스콘스퀘어", label: "스콘스퀘어", at: plazaLabel },
              ]
          ).map((label) => (
            <g
              key={label.id}
              transform={`translate(${label.at.join(" ")}) scale(${labelScale})`}
              className={
                buildingPicker && label.id !== "스콘스퀘어"
                  ? "overview-building-label-pick"
                  : undefined
              }
              onClick={
                buildingPicker && label.id !== "스콘스퀘어"
                  ? () => onSelect?.(label.id, true)
                  : undefined
              }
            >
              <rect
                x={-(label.label.length * 11 + 10) / 2}
                y={-10}
                width={label.label.length * 11 + 10}
                height={20}
                rx={6}
                fill={
                  focused || state(label.id) === "current"
                    ? "#2563EB"
                    : "rgba(255,255,255,0.7)"
                }
              />
              <text
                y={4}
                fill={focused ? "white" : labelFill(label.id, "#4a5361")}
              >
                {label.label}
              </text>
            </g>
        ))}
  </g>
)}
        

        {focused && focusBuilding && (
          <g pointerEvents="none">
            {focusBuilding.entrances.map((entrance, i) => (
              <g
                key={`${entrance.name}-${i}`}
                transform={`translate(${project(entrance.local).join(" ")}) scale(${labelScale})`}
                role="img"
                aria-label={`${focusBuilding.name} 입구`}
              >
                <circle r={12} fill="#2860ed" stroke="white" strokeWidth={2} />
                <DoorOpen
                  x={-7}
                  y={-7}
                  size={14}
                  color="white"
                  aria-hidden="true"
                />
              </g>
            ))}
            {focusBuilding.elevator && (
              <g
                // TODO: 엘리베이터 위치 좌표가 등록되면 이름표 아래 대신 해당 좌표로 투영한다.
                transform={`translate(${focusLabel![0]} ${focusLabel![1] + 30 * labelScale}) scale(${labelScale})`}
                role="img"
                aria-label={`${focusBuilding.name} 엘리베이터`}
              >
                <circle
                  r={12}
                  fill="white"
                  stroke="#2860ed"
                  strokeWidth={1.5}
                />
                <ArrowUpDown
                  x={-7}
                  y={-7}
                  size={14}
                  color="#2860ed"
                  aria-hidden="true"
                />
              </g>
            )}
          </g>
        )}

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
        <g
          pointerEvents="none"
          aria-hidden="true"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {[
            { color: "white", width: 7 },
            { color: "#dc2626", width: 4 },
          ].map(({ color, width }) => (
            <g key={color} stroke={color} strokeWidth={width}>
              {!routePreview && highlight?.segments.map(([from, to], index) => (
                <line
                  key={index}
                  x1={from[0]}
                  y1={from[1]}
                  x2={to[0]}
                  y2={to[1]}
                />
              ))}
            </g>
          ))}
        </g>
        {routePreview && previewSegments.length > 0 && (() => {
          const toPoint = (p: CampusCoordinate) => project([p.east, p.north]);
          const path = previewSegments.map(([a, b]) => `M${toPoint(a).join(" ")} L${toPoint(b).join(" ")}`).join(" ");
          const start = toPoint(previewSegments[0][0]);
          const end = toPoint(previewSegments.at(-1)![1]);
          const lengths = previewSegments.map(([a, b]) => Math.hypot(b.east-a.east, b.north-a.north, b.elevation-a.elevation));
          let remaining = lengths.reduce((a,b) => a+b,0)/2;
          let middle = start;
          for (let i=0; i<lengths.length; i++) {
            if (remaining <= lengths[i]) { const [a,b]=previewSegments[i]; const t=lengths[i] ? remaining/lengths[i] : 0; middle=toPoint({ east:a.east+(b.east-a.east)*t, north:a.north+(b.north-a.north)*t, elevation:0 }); break; }
            remaining -= lengths[i];
          }
          const waypoint = toPoint(previewSegments[Math.floor(previewSegments.length / 2)][1]);
          return <g pointerEvents="none" aria-label="경로: 초록 출발점, 흰 중간 지점, 파란 도착 깃발">
            <path d={path} fill="none" stroke="rgba(16, 40, 100, 0.18)" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" transform={`translate(0 ${2*labelScale})`} />
            <path d={path} fill="none" stroke="white" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={path} fill="none" stroke="#2860ed" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle cx={start[0]} cy={start[1]} r={6.5*labelScale} fill="#1d9e75" stroke="white" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <circle cx={waypoint[0]} cy={waypoint[1]} r={5.5*labelScale} fill="white" stroke="#2860ed" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <g transform={`translate(${start.join(" ")}) scale(${labelScale})`}>
              <rect x={-19} y={12} width={38} height={24} rx={8} fill="#1d9e75" />
              <text textAnchor="middle" y={29} fontSize={11.5} fontWeight={800} fill="white">출발</text>
            </g>
            {routePreview.name && <g transform={`translate(${middle.join(" ")}) scale(${labelScale})`}>
              <rect x={-(routePreview.name.length*10+18)/2} y={-31} width={routePreview.name.length*10+18} height={24} rx={8} fill="#fff3dc" stroke="white" strokeWidth={1.5} />
              <text textAnchor="middle" y={-15} fontSize={11.5} fontWeight={800} fill="#9a5400">{routePreview.name}</text>
            </g>}
            <g transform={`translate(${end.join(" ")}) scale(${labelScale})`}>
              <path d="M0 0S-13-15-13-24a13 13 0 0 1 26 0C13-15 0 0 0 0z" fill="#2860ed" stroke="white" strokeWidth={2.5} />
              <path d="M-4-31v12m.5-11h8l-2 3 2 3h-8z" fill="white" stroke="white" strokeWidth={1.4} strokeLinecap="round" />
            </g>
          </g>;
        })()}
        {highlight?.position && (
          <g className="overview-me" pointerEvents="none" aria-label="현재 위치">
            <circle cx={highlight.position[0]} cy={highlight.position[1]} r="7" fill="#2563EB" opacity="0.25">
              <animate attributeName="r" values="6;13" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.45;0" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={highlight.position[0]} cy={highlight.position[1]} r="5.5" fill="#2563EB" stroke="white" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {!backgroundOnly && !buildingPicker && !focused && !routePreview && (
        <EntrancePins
          pins={entrancePositions}
          selected={selected}
          highlighted={highlight ? [...highlight.markers] : []}
          current={highlight?.currentMarker}
          selectable={onEntrance ? undefined : viewOnly ? [] : startable}
          onSelect={
            onEntrance ??
            (onSelect && !viewOnly ? (id) => onSelect(id, false) : undefined)
          }
        />
      )}
      {!backgroundOnly && pickerMode && (
        <button
          type="button"
          className="map-fit-all"
          onClick={() => {
            setZoom(0);
            onResetView?.();
          }}
        >
          <Maximize size={14} /> 전체 보기
        </button>
      )}
      {!backgroundOnly && (
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
      )}
      {!backgroundOnly && !focused && (
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
      )}
    </div>
  );
}
