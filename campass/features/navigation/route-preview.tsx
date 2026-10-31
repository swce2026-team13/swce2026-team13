"use client";
import { useMemo, useState } from "react";
import type { RouteOption } from "@/shared/utils/routing";
import { routeSummary } from "@/shared/utils/route-summary";
import { routeMode } from "@/shared/utils/route-presentation";
import { CampusOverviewMap } from "./campus-overview-map";
import { CampusMap } from "./campus-map";

export function RoutePreview({ option }: { option: RouteOption }) {
  const [flat, setFlat] = useState(false);
  const annotation = useMemo(() => {
    const grade = routeSummary(option).grade;
    return {
      name: routeMode(option) === "hill" && grade !== null ? `언덕길 ${grade}%` : "",
      color: "#fff3dc",
    };
  }, [option]);
  const overview = (
    <CampusOverviewMap
      key={option.id}
      height={378}
      routePreview={{ nodes: option.nodes, ...annotation }}
    />
  );
  return (
    <section className="route-preview-card" aria-label="경로 미리보기 지도">
      <div className="route-preview-heading">
        <strong>경로 미리보기</strong>
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
