"use client";
import { CampusOverviewMap } from "@/features/navigation/campus-overview-map";
import { useSearchParams } from "next/navigation";
import { BuildingIcon, CoffeeIcon } from "@/components/ui/icons";
import { places, type Place } from "@/shared/utils/catalog";
import type { BuildingDetailData } from "@/shared/types/building-detail";
import { BuildingDetail } from "./building-detail";
import { navigationHref } from "@/shared/utils/navigation";
import { FacilityFinder } from "@/features/search/facility-finder";
import { useCampus } from "@/features/navigation/campus-provider";

const buildings = places.filter((p) => p.category === "building");

export default function Screen({
  buildingsInfo,
  facilities,
}: {
  buildingsInfo: BuildingDetailData[];
  facilities: Place[];
}) {
  const params = useSearchParams();
  const { busy, choose, go } = useCampus();
  const visibleFacilities = facilities.filter(
    (place) => place.id !== "eunju1_5f_front",
  );
  const tab = params.get("tab") === "facility" ? "facility" : "classroom";
  const building =
    buildings.find((b) => b.name === params.get("building"))?.name ?? "";
  const buildingInfo = buildingsInfo.find((item) => item.name === building);
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
      navigationHref(
        "find",
        Object.fromEntries(
          Object.entries({ ...next, tab, building, ...values }).filter(
            ([, value]) => value !== "",
          ),
        ),
      ),
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
        !buildingInfo ? (
          <>
            <div>
              <h1>어느 건물로 가세요?</h1>
              <p>지도에서 건물을 누르거나 아래 이름을 골라요.</p>
            </div>
            <div className="overview-card building-picker-map">
              <CampusOverviewMap
                buildingPicker
                height={360}
                onSelect={(id) => {
                  const selected = buildings.find((item) => item.id === id);
                  if (selected) update({ building: selected.name });
                }}
              />
            </div>
            <div className="building-name-picker">
              <h2>건물 이름으로 고르기</h2>
              <div
                className="chips building-name-scroll"
                role="group"
                aria-label="건물 이름으로 고르기"
              >
                {buildings.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => update({ building: item.name })}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <BuildingDetail
            building={buildingInfo}
            busy={busy}
            onBack={() => update({ building: "" })}
            onDirections={() => {
              const destination = buildings.find(
                (item) => item.id === buildingInfo.id,
              );
              if (destination) choose(destination);
            }}
            onPlaces={() => go("places", { building: buildingInfo.name })}
          />
        )
      ) : (
        <FacilityFinder facilities={visibleFacilities} />
      )}
    </section>
  );
}
