"use client";
import { useMemo, useState } from "react";
import type { RouteOption } from "@/shared/utils/routing";
import { routeSummary } from "@/shared/utils/route-summary";
import { routeAreas, routeMode } from "@/shared/utils/route-presentation";
import { CampusOverviewMap } from "./campus-overview-map";
import { CampusMap } from "./campus-map";

export function RoutePreview({ option }: { option: RouteOption }) {
  // 2D가 기본, 3D는 토글로
  const [flat, setFlat] = useState(true);
  const annotation = useMemo(() => {
    const grade = routeSummary(option).grade;
    return {
      name: routeMode(option) === "hill" && grade !== null ? `오르막 ${grade}%` : "",
      color: "#fff3dc",
    };
  }, [option]);
  const overview = (
    <CampusOverviewMap
      key={option.id}
      height={420}
      routePreview={{ nodes: option.nodes, ...annotation }}
    />
  );
  return (
    <section className="route-preview-card" aria-labelledby="route-preview-title">
      <div className="route-preview-heading">
        <strong id="route-preview-title">이렇게 가요</strong>
        <div
          className="map-view-switch"
          role="group"
          aria-label="경로 지도 표시 방식"
        >
          <button
            type="button"
            aria-pressed={!flat}
            onClick={() => setFlat(false)}
          >
            3D
          </button>
          <button
            type="button"
            aria-pressed={flat}
            onClick={() => setFlat(true)}
          >
            2D
          </button>
        </div>
      </div>
      {/* 거쳐 가는 곳: 출발 › 경유 › 도착 */}
      <p className="route-preview-via">
        {routeAreas(option).map((name, i) => (
          <span key={`${name}-${i}`}>
            {i > 0 && <i aria-hidden="true">›</i>}
            {name}
          </span>
        ))}
      </p>
      {flat ? (
        overview
      ) : (
        <CampusMap
          embedded
          designTheme
          mapHeight={378}
          routeNodes={option.nodes}
          routeAnnotation={annotation}
          selectedBuildings={[
            ...new Set(option.nodes.map((n) => n.split("|")[0])),
          ]}
          currentBuilding={option.nodes.at(-1)?.split("|")[0]}
          fallback={overview}
        />
      )}
    </section>
  );
}
