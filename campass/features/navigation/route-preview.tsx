"use client";
import { useMemo, useState } from "react";
import type { RouteOption } from "@/shared/utils/routing";
import {
  routeColors,
  routeMode,
  routeName,
} from "@/shared/utils/route-presentation";
import { CampusOverviewMap } from "./campus-overview-map";
import { CampusMap } from "./campus-map";

export function RoutePreview({ option }: { option: RouteOption }) {
  const [flat, setFlat] = useState(false);
  const annotation = useMemo(
    () => ({ name: routeName(option), color: routeColors[routeMode(option)] }),
    [option],
  );
  const overview = (
    <CampusOverviewMap
      key={option.id}
      height={360}
      routePreview={{ nodes: option.nodes, ...annotation }}
    />
  );
  return (
    <section className="route-preview-card" aria-label="경로 미리보기 지도">
      <div className="route-preview-heading">
        <strong>{flat ? "2D" : "3D"} 경로 미리보기</strong>
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
