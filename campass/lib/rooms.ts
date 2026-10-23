import { currentPlaceId, places, type Place } from "./catalog.ts";
import { campusBuildings, loadRooms } from "./campus3d/types.ts";

// 서버 전용: rooms.tsv를 읽어 강의실 장소로 바꿈. 화면 코드에서는 가져오지 말 것
const roomUses = ["강의실", "멀티미디어강의실", "실험실습실"];

function floorLabel(buildingId: string, floor: string) {
  const label = campusBuildings()
    .find((b) => b.id === buildingId)
    ?.floors.find((f) => f.floor === floor)?.label;
  if (label) return label;
  return floor.startsWith("B") ? `지하 ${floor.slice(1)}층` : `${floor}층`;
}

// '시청각3실'과 '시청각실 3'을 같은 이름으로 봄
const nameKey = (name: string) =>
  `${name.replace(/[\d\s]/g, "")}${name.replace(/\D/g, "")}`;

// 혜인관은 catalog.ts에 있는 강의실을 그대로 쓰고, 같은 호수나 이름은 뺌
const hyeinRooms = places.filter(
  (p) => p.building === "혜인관" && p.category === "classroom",
);
const hyeinNumbers = new Set(
  hyeinRooms.map((p) => p.name.match(/^(\S+)호/)?.[1]).filter(Boolean),
);
const hyeinNames = new Set(hyeinRooms.map((p) => nameKey(p.name)));

let rooms: Place[] | undefined;
export function roomPlaces() {
  if (rooms) return rooms;
  const list = loadRooms()
    .filter((r) => roomUses.includes(r.use) && r.floor)
    .filter(
      (r) =>
        r.buildingId !== "hyein" ||
        (!hyeinNumbers.has(r.number) && !hyeinNames.has(nameKey(r.name))),
    )
    .map((r): Place => {
      const named = r.name && r.name !== r.use;
      // '강의실' 같은 흔한 이름은 별칭으로 넣으면 검색 결과가 너무 많아짐
      const alias = named && r.name !== "강의실";
      return {
        id: `room-${r.buildingId}-${r.number}`,
        name: `${r.number}호 ${named ? r.name : "강의실"}`,
        building: r.building,
        floor: floorLabel(r.buildingId, r.floor),
        category: "classroom",
        aliases: [
          r.number,
          `${r.building} ${r.number}`,
          ...(alias ? [r.name, `${r.building} ${r.name}`] : []),
        ],
        verified: true,
        source: "학교 캠퍼스맵",
        description: r.use,
        number: r.number,
      };
    });
  // 같은 호실명이 여러 층에 있으면 유담관 5층이 먼저 나오도록 앞에 둠
  const first = (p: Place) => p.building === "유담관" && p.floor === "5층";
  return (rooms = [...list.filter(first), ...list.filter((p) => !first(p))]);
}

// 서버에서 쓰는 전체 장소 목록: 기존 장소 + 호실
let all: Place[] | undefined;
export const allPlaces = () => (all ??= [...places, ...roomPlaces()]);

export const findPlace = (id: string) =>
  allPlaces().find((p) => p.id === currentPlaceId(id));
