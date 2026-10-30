"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { CampusCoordinate } from "@/shared/utils/campus-map";
import styles from "../../../styles/campus-map.module.css";

const MapView = dynamic(() => import("./view"), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      3D 지도를 준비하고 있어요…
    </div>
  ),
});

// 지도 모듈을 불러오지 못해도 선택과 안내 화면은 계속 사용할 수 있어요.
class MapBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type CampusMapProps = {
  onBuilding?: (id: string) => void;
  /** 정류장·정문·주차장 표시를 눌렀을 때 (지도 표시 id) */
  onMarker?: (id: string) => void;
  selectedBuildings?: string[];
  currentBuilding?: string;
  routeNodes?: string[];
  /** 안내 중 내 위치(지금 단계). 있으면 동그란 점으로 표시해요. */
  position?: CampusCoordinate;
  fallback: ReactNode;
};

export function CampusMap({ fallback, ...props }: CampusMapProps) {
  return (
    <section className={styles.card} aria-label="캠퍼스 3D 지도">
      <div className={styles.heading}>
        <b>{props.onBuilding ? "캠퍼스 3D 지도" : "3D 경로 미리보기"}</b>
        <span>서경대학교</span>
      </div>
      <MapBoundary fallback={fallback}>
        <MapView {...props} fallback={fallback} />
      </MapBoundary>
      <p className={styles.caption}>
        건물 윤곽·등고선 기반 지도 · 층 높이는 추정값이에요.
      </p>
    </section>
  );
}
