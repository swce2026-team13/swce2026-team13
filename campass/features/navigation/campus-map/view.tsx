"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { campusMap, type CampusMapController } from "@/shared/utils/campus-map";
import type { CampusMapProps } from "./";
import { loadCampusThree } from "./three-loader.js";
import { createCampusScene } from "./scene.js";
import styles from "../../../styles/campus-map.module.css";

export default function MapView({
  onBuilding,
  selectedBuildings,
  currentBuilding,
  fallback,
}: CampusMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<CampusMapController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [selection, setSelection] = useState("");
  const onBuildingRef = useRef(onBuilding);
  const highlightRef = useRef({
    ids: selectedBuildings,
    current: currentBuilding,
  });
  useEffect(() => {
    onBuildingRef.current = onBuilding;
  }, [onBuilding]);
  useEffect(() => {
    highlightRef.current = { ids: selectedBuildings, current: currentBuilding };
    controller.current?.highlightBuildings(
      selectedBuildings ?? [],
      currentBuilding,
    );
  }, [selectedBuildings, currentBuilding]);

  useEffect(() => {
    let cancelled = false;
    const host = container.current!;
    const fail = () => {
      if (cancelled) return;
      controller.current?.dispose();
      controller.current = null;
      setStatus("error");
    };
    loadCampusThree()
      .then((three) => {
        if (cancelled) return;
        controller.current = createCampusScene(three, host, {
          interactive: Boolean(onBuildingRef.current),
          onSelect: (next) => {
            if (cancelled) return;
            setSelection(next?.buildingId ?? "");
            if (next) onBuildingRef.current?.(next.buildingId);
          },
          onError: fail,
        });
        controller.current.highlightBuildings(
          highlightRef.current.ids ?? [],
          highlightRef.current.current,
        );
        setStatus("ready");
      })
      .catch(fail);
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  if (status === "error")
    return (
      <div role="status">
        <p className={styles.hint}>
          3D 지도를 표시할 수 없어 2D 지도로 안내해요.
        </p>
        {fallback}
      </div>
    );

  return (
    <>
      <div className={styles.stage} aria-busy={status === "loading"}>
        <div className={styles.canvas} ref={container} />
        {status === "loading" ? (
          <div className={styles.overlay} role="status">
            3D 지도를 불러오고 있어요…
          </div>
        ) : (
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
        {onBuilding && (
          <label className={styles.picker}>
            <span>건물 선택</span>
            <select
              aria-label="3D 지도 건물 선택"
              value={selection}
              onChange={(event) => {
                const id = event.target.value;
                if (!id) {
                  controller.current?.fitAll();
                  setSelection("");
                  return;
                }
                if (controller.current) controller.current.selectBuilding(id);
                else {
                  setSelection(id);
                  onBuilding(id);
                }
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
        )}
      </div>
    </>
  );
}
