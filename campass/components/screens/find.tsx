"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRightIcon, BuildingIcon, CoffeeIcon } from "@/components/icons";
import { places, type Place } from "@/lib/catalog";
import { classroomFloors } from "@/lib/classrooms";
import { navigationHref } from "@/lib/navigation";
import { Notice } from "@/components/ui";
import { FloorPlaceList } from "@/components/floor-places";
import { FacilityFinder } from "@/components/facility-finder";
import { useCampus } from "@/components/campus-provider";

const buildings = places.filter((p) => p.category === "building");

export default function Screen({
  rooms,
  facilities,
}: {
  rooms: Place[];
  facilities: Place[];
}) {
  const params = useSearchParams();
  const { busy, choose, go } = useCampus();
  const visibleFacilities = facilities.filter(
  (place) => place.id !== "eunju1_5f_front",
);
  const tab = params.get("tab") === "facility" ? "facility" : "classroom";
  const building =
    buildings.find((b) => b.name === params.get("building"))?.name ?? "혜인관";
  const [openFloor, setOpenFloor] = useState("");
  const floors = classroomFloors(building, [...places, ...rooms]);
  // 편의시설 상세(A4a)에서는 탭을 숨김
 const detail =
  tab === "facility" &&
  visibleFacilities.some((p) => p.id === params.get("place"));

  // 탭과 건물 선택은 기록을 쌓지 않고 주소에만 남겨 새로고침해도 유지
  function update(values: Record<string, string>) {
    const next = Object.fromEntries(params);
    window.history.replaceState(
      null,
      "",
      navigationHref("find", { ...next, tab, building, ...values }),
    );
  }

  return (
    <section className="content stack find-screen">
      {!detail && (
        <div className="find-tabs" role="tablist" aria-label="찾을 장소 분류">
          <button
            role="tab"
            aria-selected={tab === "classroom"}
            className={tab === "classroom" ? "active" : ""}
            onClick={() => update({ tab: "classroom" })}
          >
            <BuildingIcon size={17} />
            건물·강의실
          </button>
          <button
            role="tab"
            aria-selected={tab === "facility"}
            className={tab === "facility" ? "active" : ""}
            onClick={() => update({ tab: "facility" })}
          >
            <CoffeeIcon size={17} />
            편의시설
          </button>
        </div>
      )}

      {tab === "classroom" ? (
        <>
          <h1>어느 건물로 가세요?</h1>
          <p>건물 → 층 → 호실 순서로 골라요.</p>
          <div className="chips filters">
            {buildings.map((b) => (
              <button
                key={b.id}
                className={b.name === building ? "active" : ""}
                aria-pressed={b.name === building}
                onClick={() => {
                  setOpenFloor("");
                  update({ building: b.name });
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
          <p className="find-step" role="status">
            {building} · 층을 골라 주세요
          </p>
          <button
          type="button"
           className="button secondary"
         onClick={() => go("places", { building })}
        >
  {building} 층별 주요 장소 보기
</button>
          {floors.length === 0 ? (
            <Notice>
              <b>층별 강의실 정보를 준비하고 있어요</b>
              <p>이 건물의 강의실은 아직 등록되지 않았어요.</p>
            </Notice>
          ) : (
            floors.map((f) => {
              const open = openFloor === f.floor;
              return (
                <div className="card floor-card find-floor" key={f.floor}>
                  <div className="between">
                    <div>
                      <h2>{f.floor}</h2>
                      <small>
                        {f.rooms.length
                          ? `등록 강의실 ${f.rooms.length}곳`
                          : "등록된 강의실이 아직 없어요"}
                      </small>
                    </div>
                    <button
                      className="find-route-button"
                      disabled={!f.rooms.length}
                      aria-expanded={f.rooms.length ? open : undefined}
                      onClick={() => setOpenFloor(open ? "" : f.floor)}
                    >
                      {f.rooms.length ? "길찾기" : "준비 중"}
                      {f.rooms.length > 0 && <ArrowRightIcon size={15} />}
                    </button>
                  </div>
                  {open && (
                    <FloorPlaceList
                      items={f.rooms}
                      busy={busy}
                      onChoose={choose}
                    />
                  )}
                </div>
              );
            })
          )}
        </>
      ) : (
        <FacilityFinder facilities={visibleFacilities} />
      )}
    </section>
  );
}
