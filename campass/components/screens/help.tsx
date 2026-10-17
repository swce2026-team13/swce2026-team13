"use client";
import { Compass, Info } from "lucide-react";
import { campus, sources } from "@/lib/catalog";
import { Notice } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
export default function Screen() {
  const { go } = useCampus();
  return (
    <section className="content stack">
      <span className="icon-box">
        <Compass />
      </span>
      <h1>
        처음 방문해도,
        <br />
        사진을 따라 차근차근
      </h1>
      <p>{campus.name} 캠퍼스 길찾기 시연 서비스입니다.</p>
      <div className="card stack">
        <h3>이렇게 이용하세요</h3>
        <p>1. 목적지를 검색하고 출발지를 선택하세요.</p>
        <p>2. 사진과 안내를 확인하며 다음 지점으로 이동하세요.</p>
        <p>3. 각 지점에서 도착 버튼을 눌러 주세요.</p>
        <p>4. 길을 잃었다면 위치를 다시 선택하세요.</p>
      </div>
      <Notice tone="amber">
        <b className="row">
          <Info size={18} />
          시연 안내
        </b>
        <p>
          건물·일부 강의실은 공식 자료에 기반합니다. 사진, 거리, 실내 경로, 면접
          장소는 예시이며 현장 검증 전입니다. 사진 인식 API 미설정 시 직접
          선택으로 안내합니다.
        </p>
      </Notice>
      <a
        className="button secondary"
        href={sources.map}
        target="_blank"
        rel="noreferrer"
      >
        공식 캠퍼스맵 보기 ↗
      </a>
      <button className="button primary" onClick={() => go("home")}>
        목적지 찾아보기
      </button>
    </section>
  );
}
