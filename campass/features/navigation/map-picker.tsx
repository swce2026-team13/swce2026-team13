"use client";
import { useId, useState } from "react";
import { campusMap } from "@/shared/utils/campus-map";
import { LEGEND } from "@/shared/utils/campus-overview";
import { CampusOverviewMap } from "./campus-overview-map";

// 출발지·도착지 고르기 공통 지도. 모양은 같고 「출발/도착」 모드만 다름(2D만 씀)

export function MapPicker({
  selected,
  target,
  destination,
  onSelect,
}: {
  selected: string[];
  target: "start" | "destination";
  // 목적지 건물. 출발을 고를 때 「건물명 · 도착」으로 표시
  destination?: string;
  onSelect: (id: string, building: boolean) => void;
}) {
  const startPick = target === "start";
  const [buildingFocus, setBuildingFocus] = useState("");
  const [overviewReset, setOverviewReset] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const legendId = useId();
  const selectEntrance = (id: string) => onSelect(id, false);
  const selectBuilding = (id: string) => {
    setBuildingFocus(id);
    onSelect(id, true);
  };
  return (
    <div className={`overview-card map-picker map-picker-${target}`}>
      <div className="map-picker-toolbar">
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
        <CampusOverviewMap
          key={overviewReset}
          pickerMode
          height={480}
          selected={selected}
          destinationLabel={startPick ? destination : undefined}
          onEntrance={selectEntrance}
          onSelect={selectBuilding}
          onResetView={() => setBuildingFocus("")}
        />
      </div>
      <p className="endpoint-map-caption">
        {startPick
          ? "초록 표시나 건물을 누르면 바로 경로를 보여 드려요"
          : "건물을 누르면 바로 경로를 보여 드려요"}
      </p>
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
