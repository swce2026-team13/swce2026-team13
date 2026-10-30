"use client";
import { useId, useRef, useState } from "react";
import { campusMap, type CampusMapController } from "@/shared/utils/campus-map";
import { places } from "@/shared/utils/catalog";
import { LEGEND, overviewMarkers } from "@/shared/utils/campus-overview";
import { emptyPick, markerStarts, pickOnMap, pickStatus } from "@/shared/utils/map-pick";
import { CampusOverviewMap } from "@/features/navigation/campus-overview-map";
import { CampusMap } from "@/features/navigation/campus-map";
import { CheckIcon } from "@/components/ui/icons";
import { useCampus } from "@/features/navigation/campus-provider";

const startMarkers = overviewMarkers
  .filter((m) => markerStarts[m.id])
  .map((m) => m.id);

const markerNames: Record<string, string> = {
  bus_stop_2115: "2115번 정류장",
  gate_main: "정문",
  parking_entrance_1: "1주차장",
};

const pickName = (id: string) =>
  markerNames[id] ?? places.find((p) => p.id === id)?.name ?? id;

export default function Screen() {
  const { busy, ready, go } = useCampus();
  const [pick, setPick] = useState(emptyPick);
  const [flat, setFlat] = useState(false);
  const [buildingFocus, setBuildingFocus] = useState("");
  const [legendOpen, setLegendOpen] = useState(false);
  const legendId = useId();
  const mapController = useRef<CampusMapController | null>(null);
  const selectBuilding = (id: string) => {
    setBuildingFocus(id);
    setPick((previous) => pickOnMap(previous, id, true));
  };
  const selected = [pick.start, pick.destination].filter((id): id is string => Boolean(id));
  const detailBuilding = places.find((place) => place.id === (pick.destination ?? pick.start) && place.category === "building");
  const overview = <CampusOverviewMap pickerMode selected={selected} startable={startMarkers} onSelect={(id, building) => building ? selectBuilding(id) : setPick((previous) => pickOnMap(previous, id, false))} />;
  const status = pickStatus(pick);
  const turn = !pick.start ? "start" : !pick.destination ? "destination" : "";
  const rows = [
    {
      key: "start" as const,
      tag: "출발",
      value: pick.start,
      hint: "출발지를 눌러 주세요",
    },
    {
      key: "destination" as const,
      tag: "도착",
      value: pick.destination,
      hint: "목적지를 눌러 주세요",
    },
  ];

  return (
    <>
      <section className="content stack map-pick-screen">
        <div>
          <h1 className="sr-only">지도에서 출발지와 목적지를 눌러 주세요</h1>
          <p>건물이나 입구 핀을 눌러 출발지를 고르고, 이어서 목적지를 눌러 주세요.</p>
        </div>

        <div className="card map-pick-card">
          <div className="between">
            <b>고른 건물</b>
            {(pick.start || pick.destination) && (
              <button className="text-button" onClick={() => setPick(emptyPick)}>
                다시 선택
              </button>
            )}
          </div>
          {rows.map((row) => (
            <div
              key={row.key}
              className={`map-pick-row ${turn === row.key ? "turn" : ""}`}
            >
              <span className={`map-pick-tag ${row.key}`}>{row.tag}</span>
              {turn === row.key && <span className="map-pick-dot" />}
              {row.value ? (
                <strong>
                  {pickName(row.value)}
                  <CheckIcon size={16} />
                </strong>
              ) : (
                <span>{row.hint}</span>
              )}
            </div>
          ))}
        </div>

        <div className="overview-card">
          <div className="map-picker-toolbar">
            <div className="map-view-switch" role="group" aria-label="지도 표시 방식">
              <button type="button" aria-pressed={!flat} onClick={() => setFlat(false)}>3D</button>
              <button type="button" aria-pressed={flat} onClick={() => setFlat(true)}>2D</button>
            </div>
            <label className="map-building-select">
              건물
              <select aria-label="캠퍼스 지도 건물 선택" value={buildingFocus} onChange={(event) => {
                const id = event.target.value;
                if (!id) {
                  setBuildingFocus("");
                  mapController.current?.fitAll();
                } else if (!flat && mapController.current) {
                  mapController.current.selectBuilding(id);
                } else selectBuilding(id);
              }}>
                <option value="">캠퍼스 전체</option>
                {[...campusMap.buildings].sort((a, b) => a.name.localeCompare(b.name, "ko")).map((building) => (
                  <option key={building.id} value={building.id}>{building.name}</option>
                ))}
              </select>
            </label>
          </div>
          {flat ? overview : <CampusMap embedded controllerRef={mapController} selectedBuildings={selected} onBuilding={selectBuilding} fallback={overview} />}
          <div className="chips filters" aria-label="입구에서 출발">
            {startMarkers.map((id) => <button key={id} className={pick.start === id ? "active" : ""} aria-pressed={pick.start === id} onClick={() => setPick((previous) => pickOnMap(previous, id, false))}>{markerNames[id]}</button>)}
          </div>
          <button type="button" className="map-legend-toggle" aria-expanded={legendOpen} aria-controls={legendId} onClick={() => setLegendOpen(!legendOpen)}>
            학과 색 범례 보기 <span aria-hidden="true">{legendOpen ? "▴" : "▾"}</span>
          </button>
          <ul id={legendId} className="overview-legend" aria-label="학과 범례" hidden={!legendOpen}>
            {LEGEND.map((item) => (
              <li key={item.label}>
                <i style={{ background: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="map-picker-caption">드래그로 회전 · 두 손가락으로 확대 · 층 높이는 추정값이에요.</p>
        {detailBuilding && <button type="button" className="button secondary" onClick={() => go("places", { building: detailBuilding.name })}>{detailBuilding.name} 층별 장소 보기</button>}
      </section>
      <div className="actions map-pick-actions route-start-actions">
        <p>언덕을 지나는 길은 언덕 · 계단 · 본관 엘리베이터 중에서 골라요</p>
        {status.message && (
          <p className="map-pick-message" role="status">
            {status.message}
          </p>
        )}
        <button
          className="button primary"
          disabled={!status.ready || busy || !ready}
          onClick={() =>
            go("prepare", {
              destination: pick.destination!,
              start: status.start!,
              elevator: "false",
            })
          }
        >
          경로 선택하기
        </button>
      </div>
    </>
  );
}
