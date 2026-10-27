"use client";
import { sources } from "@/shared/utils/catalog";
import { Notice, Tag } from "@/components/ui";
import { FloorPlaceList } from "@/features/search/floor-places";
import { useCampus } from "@/features/navigation/campus-provider";
export default function Screen() {
  const {
    building,
    floor,
    setFloor,
    busy,
    choose,
    buildingPlaces,
    floors,
    shownFloors,
  } = useCampus();
  return (
    <section className="content stack">
      <Tag>선택한 건물</Tag>
      <h1>{building}</h1>
      <p>층별 주요 장소를 선택해 목적지로 설정하세요.</p>
      <div className="chips filters">
        {floors.map((f) => (
          <button
            className={floor === f ? "active" : ""}
            key={f}
            onClick={() => setFloor(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {shownFloors.map((f) => (
        <div
          className={`card floor-card ${f === "3층" ? "selected" : ""}`}
          key={f}
        >
          <div className="between">
            <h2>{f}</h2>
            <Tag tone={f === "3층" ? "blue" : "gray"}>
              {f === "3층" ? "시연 행사" : "주요 장소"}
            </Tag>
          </div>
          <FloorPlaceList
            items={buildingPlaces.filter((p) => p.floor === f)}
            busy={busy}
            onChoose={choose}
          />
        </div>
      ))}
      {buildingPlaces.length === 0 && (
        <Notice>
          <b>층별 정보를 준비하고 있어요</b>
          <p>
            건물명은 공식 자료에서 확인했으며 실내 장소는 아직 등록되지
            않았어요.
          </p>
        </Notice>
      )}
      <a
        className="button secondary"
        href={sources.notice}
        target="_blank"
        rel="noreferrer"
      >
        학교 공식 장소 정보 확인 ↗
      </a>
    </section>
  );
}
