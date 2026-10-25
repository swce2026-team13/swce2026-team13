"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus, RotateCcw } from "lucide-react";
import { campusMap } from "@/shared/utils/campus-map";
import type {
  CampusMapController,
  MapSelection,
} from "@/shared/utils/campus-map";
import { loadCampusThree } from "./three-loader.js";
import { createCampusScene } from "./scene.js";
import styles from "../../../styles/campus-map.module.css";

export default function MapView({
  onBuilding,
  selectedBuildings,
}: {
  onBuilding?: (name: string) => void;
  selectedBuildings?: string[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<CampusMapController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<MapSelection | null>(null);

  const onBuildingRef = useRef(onBuilding);
  const selectedBuildingsRef = useRef(selectedBuildings);
  useEffect(() => {
    onBuildingRef.current = onBuilding;
  }, [onBuilding]);
  useEffect(() => {
    selectedBuildingsRef.current = selectedBuildings;
    controller.current?.highlightBuildings(selectedBuildings ?? []);
  }, [selectedBuildings]);

  useEffect(() => {
    let cancelled = false;
    const host = container.current!;
    loadCampusThree()
      .then((three) => {
        if (cancelled) return;
        controller.current = createCampusScene(three, host, {
          onSelect: (next) => {
            setSelection(next);
            const picked = campusMap.buildings.find(
              (b) => b.id === next?.buildingId,
            );
            if (picked) onBuildingRef.current?.(picked.name);
          },
          onError: () => {
            if (cancelled) return;
            controller.current?.dispose();
            controller.current = null;
            setStatus("error");
          },
        });
        controller.current.highlightBuildings(
          selectedBuildingsRef.current ?? [],
        );
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, [attempt]);

  const building = campusMap.buildings.find((b) =>
    selectedBuildings
      ? b.name === selectedBuildings.at(-1)
      : b.id === selection?.buildingId,
  );
  return (
    <>
      <div className={styles.stage} aria-busy={status === "loading"}>
        <div className={styles.canvas} ref={container} />
        {status !== "ready" && (
          <div
            className={styles.overlay}
            role={status === "error" ? "alert" : "status"}
          >
            {status === "loading" ? (
              <p>3D 지도를 불러오고 있어요…</p>
            ) : (
              <>
                <b>3D 지도를 표시할 수 없어요</b>
                <p>
                  네트워크 연결과 브라우저의 3D 그래픽 지원을 확인해 주세요.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelection(null);
                    setStatus("loading");
                    setAttempt((value) => value + 1);
                  }}
                >
                  <RotateCcw size={15} /> 다시 시도
                </button>
              </>
            )}
          </div>
        )}
        {status === "ready" && (
          <>
            <button
              type="button"
              className={styles.overview}
              onClick={() => controller.current?.fitAll()}
            >
              <Maximize size={14} /> 전체 보기
            </button>
            <div className={styles.zoom}>
              <button
                type="button"
                aria-label="지도 확대"
                onClick={() => controller.current?.zoom(0.8)}
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                aria-label="지도 축소"
                onClick={() => controller.current?.zoom(1.25)}
              >
                <Minus size={18} />
              </button>
            </div>
          </>
        )}
      </div>
      <div className={styles.details}>
        <p className={styles.hint}>드래그로 회전 · 두 손가락으로 이동·확대</p>
        <label className={styles.picker}>
          <span>건물 선택</span>
          <select
            value={building?.id ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              if (!id) {
                controller.current?.fitAll();
                setSelection(null);
                return;
              }
              if (controller.current) controller.current.selectBuilding(id);
              else {
                setSelection({ buildingId: id });
                const picked = campusMap.buildings.find((b) => b.id === id);
                if (picked) onBuildingRef.current?.(picked.name);
              }
            }}
          >
            <option value="">캠퍼스 전체</option>
            {[...campusMap.buildings]
              .sort((a, b) => a.name.localeCompare(b.name, "ko"))
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
        <div className={styles.selection} aria-live="polite">
          {building ? (
            <div>
              <strong>{building.name}</strong>
              <p>
                {selectedBuildings?.includes(building.name)
                  ? "경로에 선택한 건물입니다."
                  : "건물을 선택했어요."}
              </p>
            </div>
          ) : (
            <p>건물을 누르거나 선택 메뉴를 이용하세요.</p>
          )}
        </div>
      </div>
    </>
  );
}
