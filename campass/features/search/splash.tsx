"use client";

import { useEffect, useState } from "react";
import { CampassLogo, CampassWordmark } from "@/components/ui/campass-logo";
import {
  landPath,
  buildingPaths,
  plazaPath,
  overviewRoads,
  overviewCourts,
} from "@/shared/utils/campus-overview-design";

const FALLBACK_MS = 3600;
const LEAVE_START_MS = 2800;
const LEAVE_END_MS = 3200;

// 390×844 기준으로 지도 도형을 1.48배 확대했을 때의 언덕길 경로.
const ROUTE_D =
  "M-44 392 L-3.2 380.1 L17.9 311.3 L110 360.8 L142.3 377.8 L174.6 396.5 L195 405";

function SplashMap() {
  return (
    <svg
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="390" height="844" fill="#eaf1fd" />
      <defs>
        <clipPath id="splash-plaza-clip">
          <path d={plazaPath} />
        </clipPath>
      </defs>
      <g transform="translate(-77 194) scale(1.48)">
        <path d={landPath} fill="#dbe7fb" />
        {overviewRoads.map((road, index) => (
          <g
            key={index}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={road.path} stroke="#c2d3f1" strokeWidth="7" />
            <path d={road.path} stroke="#f8fbff" strokeWidth="5" />
          </g>
        ))}
        {buildingPaths.map((path, index) => (
          <path
            key={`shadow-${index}`}
            d={path}
            transform="translate(0 2.5)"
            fill="rgba(30, 70, 160, 0.12)"
          />
        ))}
        <path d={plazaPath} fill="#cddefa" stroke="#b4cbf3" strokeWidth="1" />
        <g clipPath="url(#splash-plaza-clip)">
          {overviewCourts.map((court, index) => (
            <g
              key={index}
              transform={`translate(${court.x} ${court.y}) rotate(${court.angle})`}
            >
              <rect
                x={-court.width / 2}
                y={-court.height / 2}
                width={court.width}
                height={court.height}
                rx="1"
                fill={index === 0 ? "#b1caf5" : "#c3d4f3"}
                stroke="white"
                strokeWidth="0.8"
              />
              <g fill="none" stroke="white" strokeWidth="0.8">
                <path d={`M0 ${-court.height / 2} V${court.height / 2}`} />
                <circle r={court.height * 0.18} />
              </g>
            </g>
          ))}
        </g>
        {buildingPaths.map((path, index) => (
          <path
            key={index}
            d={path}
            fill={index % 2 ? "#f7faff" : "#f1f5ff"}
            stroke="#a7bfea"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}

export default function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      const reducedTimer = window.setTimeout(onDone, 1600);

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
    <main className={`splash-screen${leaving ? " is-leaving" : ""}`}>
      {/* 캠퍼스 지도 배경 */}
      <div className="splash-map" aria-hidden="true">
        <SplashMap />
      </div>

      {/* 지도 위 밝은 오버레이 */}
      <div className="splash-overlay" aria-hidden="true" />

      {/* 실제 캠퍼스 경로 + 이동하는 로고 */}
      <svg
        className="splash-route-layer"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {/* 경로 바깥쪽의 부드러운 파란 레이어 */}
        <path d={ROUTE_D} pathLength={100} className="splash-route-glow" />

        {/* 실제 파란 경로 */}
        <path d={ROUTE_D} pathLength={100} className="splash-route-line" />

        {/* 같은 경로를 따라 이동하는 CAMPASS 나침반 */}
        <g className="splash-moving-logo">
          <animateMotion
            path={ROUTE_D}
            begin="0.25s"
            dur="1.6s"
            fill="freeze"
            calcMode="spline"
            keyTimes="0;1"
            keySplines=".45 0 .3 1"
          />
          <g className="splash-logo-arrival">
            <foreignObject x={-36} y={-36} width={72} height={72}>
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
        {/* 움직임 줄이기 설정에서는 이동 없이 도착 지점을 바로 보여 준다. */}
        <g className="splash-static-logo" transform="translate(195 405)">
          <g className="splash-logo-arrival">
            <foreignObject x={-36} y={-36} width={72} height={72}>
              <div className="splash-moving-logo-inner">
                <CampassLogo
                  size={72}
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
        <CampassWordmark size={40} className="splash-wordmark" />
      </div>

      <p className="splash-footer">© 2026 서경대학교 · CAMPASS</p>
    </main>
  );
}
