import { currentPlaceId, places, type Place } from "../../shared/utils/catalog.ts";
import {
  campusBuildings,
  loadPlaces,
  loadRooms,
} from "../../shared/utils/campus3d/types.ts";
import { parseHours } from "../../shared/utils/facility-hours.ts";

// 서버 전용: rooms.tsv·places.tsv를 읽어 강의실·편의시설 장소로 바꿈. 화면 코드에서는 가져오지 말 것
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

function facilityKind(name: string): NonNullable<Place["kind"]> {
  if (/카페/.test(name)) return "cafe";
  if (/편의점|매점/.test(name)) return "store";
  if (/식당|버거|우동/.test(name)) return "dining";
  if (/AED/.test(name)) return "aed";
  return "etc";
}

// 학교 편의시설. 건물이 없는 곳(산책로)은 빼고, 연락처는 넣지 않음
const facilityAliases: Record<NonNullable<Place["kind"]>, string[]> = {
  cafe: ["카페", "커피"],
  store: ["편의점", "매점", "음료"],
  dining: ["식당", "밥", "학식", "점심"],
  aed: ["AED", "제세동기", "심장"],
  etc: [],
};
let facilities: Place[] | undefined;
export function facilityPlaces() {
  if (facilities) return facilities;
  const counts = new Map<string, number>();
  const list = loadPlaces()
    .filter((p) => p.category === "편의/복지" && p.buildingId)
    .map((p): Place => {
      const index = (counts.get(p.buildingId) ?? 0) + 1;
      counts.set(p.buildingId, index);
      // 층 칸: '3층'은 층 이름으로, '1층 로비'의 '로비'는 위치 보충으로, '로비'처럼 층이 아니면 글자 그대로
      const rest = p.floorLabel.match(/^(?:지하\s*)?\d+층(.*)$/)?.[1].trim() ?? "";
      const floor = p.floor ? floorLabel(p.buildingId, p.floor) : p.floorLabel;
      // 호수 칸이 숫자가 아니면 위치 보충 (예: 미소식당 '서경스포렉스')
      const note = [
        p.floor && rest,
        p.number && !/^\d+$/.test(p.number) ? p.number : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        id: `facility-${p.buildingId}-${index}`,
        name: p.name,
        building: p.building,
        floor,
        category: "facility",
        aliases: [`${p.building} ${p.name}`, ...facilityAliases[facilityKind(p.name)]],
        verified: true,
        source: "학교 캠퍼스맵",
        description: parseHours(p.hours).summary,
        hours: p.hours,
        kind: facilityKind(p.name),
        ...(note ? { note } : {}),
      };
    });
  // 건물 이름순. 같은 건물 안에서는 places.tsv 순서를 유지
  return (facilities = list.sort((a, b) =>
    a.building.localeCompare(b.building, "ko"),
  ));
}

// 서버에서 쓰는 전체 장소 목록: 기존 장소 + 호실 + 학교 편의시설
let all: Place[] | undefined;
export const allPlaces = () =>
  (all ??= [...places, ...roomPlaces(), ...facilityPlaces()]);

export const findPlace = (id: string) =>
  allPlaces().find((p) => p.id === currentPlaceId(id)) ?? floorPlaces().find((p) => p.id === id);

// 등록된 그래프 층을 목적지로 표시해요. 강의실이나 시설을 새로 만들지 않아요.
export function floorPlaces(): Place[] {
  return campusBuildings().flatMap((b) => b.floors.map((f) => ({
    id: `${b.id}|${f.floor}`, name: `${b.name} ${f.label}`, building: b.name,
    floor: f.label, category: "floor" as const, aliases: [], verified: true,
    source: "학교 캠퍼스맵", description: "등록된 건물의 층이에요.",
  })));
}
