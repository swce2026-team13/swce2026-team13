"use client";

import { useEffect, useState } from "react";
import {
  CampassLogo,
  CampassWordmark,
} from "@/components/ui/campass-logo";
import { CampusOverviewMap } from "@/features/navigation/campus-overview-map";
import { HILL_ROAD } from "@/shared/utils/campus-map";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  project,
} from "@/shared/utils/campus-overview";
import { overviewFrame } from "@/shared/utils/campus-overview-design";

const FALLBACK_MS = 3600;
const LEAVE_START_MS = 2800;
const LEAVE_END_MS = 3200;

// 2115번 버스정류장의 실제 캠퍼스 local 좌표
const BUS_STOP_2115: [number, number] = [-80.57, 25.64];

// CampusOverviewMap이 기본 상태에서 사용하는 것과 같은 화면 영역
const MAP_ASPECT = MAP_WIDTH / MAP_HEIGHT;

const VIEW_WIDTH = Math.max(
  overviewFrame.width,
  overviewFrame.height * MAP_ASPECT,
);

const VIEW_HEIGHT = VIEW_WIDTH / MAP_ASPECT;

const VIEW_LEFT = overviewFrame.cx - VIEW_WIDTH / 2;
const VIEW_TOP = overviewFrame.cy - VIEW_HEIGHT / 2;

const SPLASH_VIEW_BOX =
  `${VIEW_LEFT} ${VIEW_TOP} ${VIEW_WIDTH} ${VIEW_HEIGHT}`;

// 실제 캠퍼스 좌표 → 2D 지도 SVG 좌표
const busStopPoint = project(BUS_STOP_2115);
const hillRoadPoints = HILL_ROAD.map(project);

// 화면 왼쪽 바깥에서 들어오는 시작점
const offscreenStart: [number, number] = [
  VIEW_LEFT - 40,
  busStopPoint[1],
];

// 화면 밖 → 2115 정류장 → 실제 HILL_ROAD → [36, 11]
const routePoints: [number, number][] = [
  offscreenStart,
  busStopPoint,
  ...hillRoadPoints,
];

// SVG path 문자열 생성
const routeD = routePoints
  .map(
    ([x, y], index) =>
      `${index === 0 ? "M" : "L"} ${x} ${y}`,
  )
  .join(" ");

export default function Splash({
  onDone,
}: {
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      const reducedTimer = window.setTimeout(onDone, 250);

      return () => {
        window.clearTimeout(reducedTimer);
      };
    }

    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, LEAVE_START_MS);

    const doneTimer = window.setTimeout(() => {
      onDone();
    }, LEAVE_END_MS);

    const fallbackTimer = window.setTimeout(() => {
      onDone();
    }, FALLBACK_MS);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(doneTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [onDone]);

  return (
    <main
      className={`splash-screen${leaving ? " is-leaving" : ""}`}
    >
      {/* 캠퍼스 지도 배경 */}
      <div className="splash-map" aria-hidden="true">
        <CampusOverviewMap backgroundOnly />
      </div>

      {/* 지도 위 밝은 오버레이 */}
      <div
        className="splash-overlay"
        aria-hidden="true"
      />

      {/* 실제 캠퍼스 경로 + 이동하는 로고 */}
      <svg
        className="splash-route-layer"
        viewBox={SPLASH_VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* 경로 바깥쪽의 부드러운 파란 레이어 */}
        <path
          d={routeD}
          pathLength={100}
          className="splash-route-glow"
        />

        {/* 실제 파란 경로 */}
        <path
          d={routeD}
          pathLength={100}
          className="splash-route-line"
        />

        {/* 같은 경로를 따라 이동하는 CAMPASS 나침반 */}
        <g
  className="splash-moving-logo"
  visibility="hidden"
>
  <set
    attributeName="visibility"
    to="visible"
    begin="0.25s"
    fill="freeze"
  />

  <animateMotion
    path={routeD}
    begin="0.25s"
    dur="1.6s"
    fill="freeze"
    calcMode="spline"
    keyTimes="0;1"
    keySplines=".45 0 .3 1"
  />

          <g className="splash-logo-arrival">
            <foreignObject
              x={-36}
              y={-36}
              width={72}
              height={72}
            >
              <div className="splash-moving-logo-inner">
                <CampassLogo
                  size={72}
                  animated
                  ariaHidden
                  className="splash-logo-mark"
                />
              </div>
            </foreignObject>
          </g>
        </g>
      </svg>

      {/* 도착 후 나타나는 CAMPASS 글씨 */}
      <div className="splash-brand">
        <CampassWordmark
          size={40}
          className="splash-wordmark"
        />
      </div>

      <p className="splash-footer">
        © 2026 서경대학교 · CAMPASS
      </p>
    </main>
  );
}