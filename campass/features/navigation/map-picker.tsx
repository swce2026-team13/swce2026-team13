"use client";
import { useId, useRef, useState } from "react";
import { campusMap, type CampusMapController } from "@/shared/utils/campus-map";
import { LEGEND } from "@/shared/utils/campus-overview";
import { CampusOverviewMap } from "./campus-overview-map";
import { CampusMap } from "./campus-map";

export function MapPicker({
  selected,
  target,
  onSelect,
}: {
  selected: string[];
  target: "start" | "destination";
  onSelect: (id: string, building: boolean) => void;
}) {
  const [flat, setFlat] = useState(false);
  const [buildingFocus, setBuildingFocus] = useState("");
  const [overviewReset, setOverviewReset] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const legendId = useId();
  const mapController = useRef<CampusMapController | null>(null);
  const selectEntrance = (id: string) => onSelect(id, false);
  const selectBuilding = (id: string) => {
    setBuildingFocus(id);
    onSelect(id, true);
  };
  const overview = (
    <CampusOverviewMap
      key={overviewReset}
      pickerMode
      height={400}
      selected={selected}
      onEntrance={selectEntrance}
      onSelect={selectBuilding}
      onResetView={() => setBuildingFocus("")}
    />
  );
  return (
    <div className="overview-card">
      <div className="map-picker-toolbar">
        <div
          className="map-view-switch"
          role="group"
          aria-label="지도 표시 방식"
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
        <label className="map-building-select">
          건물
          <select
            aria-label="건물 선택"
            value={buildingFocus}
            onChange={(event) => {
              const id = event.target.value;
              if (!id) {
                setBuildingFocus("");
                setOverviewReset((value) => value + 1);
                mapController.current?.fitAll();
              } else if (!flat && mapController.current) {
                mapController.current.selectBuilding(id);
              } else selectBuilding(id);
            }}
          >
            <option value="">캠퍼스 전체</option>
            {[...campusMap.buildings]
              .sort((a, b) => a.name.localeCompare(b.name, "ko"))
              .map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="endpoint-map-surface">
        {flat ? (
          overview
        ) : (
          <CampusMap
            embedded
            designTheme
            mapHeight={400}
            controllerRef={mapController}
            selectedBuildings={selected}
            onBuilding={selectBuilding}
            onFocusChange={setBuildingFocus}
            onEntrance={selectEntrance}
            fallback={overview}
          />
        )}
        <p className="endpoint-map-hint" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
            <path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2" />
            <path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16" />
          </svg>
          지도에서 {target === "start" ? "출발지" : "도착지"}를 눌러 주세요
        </p>
      </div>
      <button
        type="button"
        className="map-legend-toggle"
        aria-expanded={legendOpen}
        aria-controls={legendId}
        onClick={() => setLegendOpen(!legendOpen)}
      >
        학과 색 범례 보기{" "}
        <span aria-hidden="true">{legendOpen ? "▴" : "▾"}</span>
      </button>
      <ul
        id={legendId}
        className="overview-legend"
        aria-label="학과 범례"
        hidden={!legendOpen}
      >
        {LEGEND.map((item) => (
          <li key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
