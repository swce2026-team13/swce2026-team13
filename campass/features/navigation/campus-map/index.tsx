"use client";

import dynamic from "next/dynamic";
import styles from "../../../styles/campus-map.module.css";

const MapView = dynamic(() => import("./view"), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      3D 지도를 준비하고 있어요…
    </div>
  ),
});

export function CampusMap({
  onBuilding,
  selectedBuildings,
}: {
  onBuilding?: (name: string) => void;
  selectedBuildings?: string[];
}) {
  return (
    <section className={styles.card} aria-label="캠퍼스 3D 지도">
      <div className={styles.heading}>
        <b>{selectedBuildings ? "3D 경로 미리보기" : "캠퍼스 3D 지도"}</b>
        <span>서경대학교</span>
      </div>
      <MapView onBuilding={onBuilding} selectedBuildings={selectedBuildings} />
      <p className={styles.caption}>
        건물 윤곽·등고선 기반 지도 · 층 높이는 추정값입니다.
      </p>
    </section>
  );
}
