"use client";

import { Component, type ReactNode, type RefObject } from "react";
import type { CampusMapController } from "@/shared/utils/campus-map";
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
  embedded?: boolean;
  controllerRef?: RefObject<CampusMapController | null>;
  onBuilding?: (id: string) => void;
  selectedBuildings?: string[];
  currentBuilding?: string;
  routeNodes?: string[];
  fallback: ReactNode;
};

export function CampusMap({ fallback, ...props }: CampusMapProps) {
  if (props.embedded)
    return (
      <div className={styles.embedded}>
        <MapBoundary fallback={fallback}>
          <MapView {...props} fallback={fallback} />
        </MapBoundary>
      </div>
    );
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
