"use client";
import { useState } from "react";
import { places } from "@/lib/catalog";
import { LEGEND, overviewMarkers } from "@/lib/campus-overview";
import { emptyPick, pickOnMap, pickStatus, startPoints } from "@/lib/map-pick";
import { CampusOverviewMap } from "@/components/campus-overview-map";
import { CheckIcon } from "@/components/icons";
import { useCampus } from "@/components/campus-provider";

const startMarkers = overviewMarkers
  .filter((m) => startPoints[m.id])
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
  const status = pickStatus(pick);
  const turn = !pick.start ? "start" : !pick.destination ? "destination" : "";
  const rows = [
    {
      key: "start" as const,
      tag: "출발",
      value: pick.start,
      hint: "출발할 건물을 눌러 주세요",
    },
    {
      key: "destination" as const,
      tag: "도착",
      value: pick.destination,
      hint: "갈 건물을 눌러 주세요",
    },
  ];

  return (
    <>
      <section className="content stack map-pick-screen">
        <div>
          <h1>어디로 가세요?</h1>
          <p>출발할 건물을 먼저 누르고, 갈 건물을 이어서 눌러 주세요.</p>
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
          <div className="overview-heading">
            <b>캠퍼스 개요도</b>
            <span>건물을 눌러 보세요</span>
          </div>
          <CampusOverviewMap
            selected={[pick.start, pick.destination].filter(
              (id): id is string => Boolean(id),
            )}
            startable={startMarkers}
            onSelect={(id, building) => setPick(pickOnMap(pick, id, building))}
          />
          <ul className="overview-legend" aria-label="학과 범례">
            {LEGEND.map((item) => (
              <li key={item.label}>
                <i style={{ background: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="actions map-pick-actions">
        <p>지하 통로나 연결 통로로 갈 수 있으면 그쪽으로 안내해요</p>
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
            })
          }
        >
          바로 안내 시작
        </button>
      </div>
    </>
  );
}
