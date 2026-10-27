import { places, type Place } from "./catalog.ts";
import { campusBuildings } from "./campus3d/types.ts";

export const digitsOnly = (value: string) => value.replace(/[^0-9]/g, "");

export function roomsOnFloor(
  building: string,
  floor: string,
  basement: boolean,
) {
  if (!floor || Number(floor) < 1) return [];
  const label = `${basement ? "지하 " : ""}${Number(floor)}층`;
  return places.filter(
    (p) =>
      p.category === "classroom" &&
      p.building === building &&
      p.floor === label,
  );
}

// 분류 목록의 층 카드. 층 순서는 buildings.json 층 목록(아래 → 위)을 따름
// 강의실이 등록된 건물만 지상층을 등록 장소의 최고층까지 채우고, 지하층은 장소가 있을 때만 보임. 강의실이 없는 층은 빈 목록(준비 중)
// list: 서버에서 넘겨받은 호실까지 넣은 장소 목록
export function classroomFloors(building: string, list: Place[] = places) {
  const inBuilding = list.filter(
    (p) => p.building === building && p.category !== "building" && p.floor,
  );
  const rooms = inBuilding.filter((p) => p.category === "classroom");
  if (rooms.length === 0) return [];
  const labels =
    campusBuildings()
      .find((b) => b.name === building)
      ?.floors.map((f) => f.label) ?? [];
  const top = Math.max(...inBuilding.map((p) => labels.indexOf(p.floor)));
  return labels
    .filter(
      (label, index) =>
        index <= top &&
        (!label.startsWith("지하") ||
          inBuilding.some((p) => p.floor === label)),
    )
    .map((floor) => ({
      floor,
      rooms: rooms.filter((p) => p.floor === floor),
    }));
}

// '541호 H04' → 'h04'. 호수 뒤 이름이 없거나 흔한 이름이면 빈칸
function roomLabel(p: Place) {
  const label = p.name.replace(/^\S+호\s*/, "").replace(/\s/g, "").toLowerCase();
  return label.length >= 2 && label !== "강의실" ? label : "";
}

export function classroomSearch(
  query: string,
  results: Place[],
  category?: string,
) {
  const buildings = places.filter((p) => p.category === "building");
  const normalized = query.replaceAll("헤인", "혜인").replace(/\s/g, "");
  const namedBuilding = buildings.find((p) => normalized.includes(p.name));
  const roomNumber = normalized.match(/(\d{3,4})(?:호)?/)?.[1];
  // 호실은 서버 검색 결과에만 있으므로 결과까지 같이 찾음. 'H04'처럼 호실 이름으로도 찾음
  const inBuilding = (p: Place) =>
    p.category === "classroom" &&
    (!namedBuilding || p.building === namedBuilding.name);
  const room = roomNumber
    ? [...places, ...results].find(
        (p) => inBuilding(p) && p.name.startsWith(`${roomNumber}호`),
      )
    : results.find(
        (p) =>
          inBuilding(p) &&
          p.number &&
          roomLabel(p) &&
          normalized.toLowerCase().includes(roomLabel(p)),
      );
  const wantsClassroom =
    category === "classroom" ||
    /강의실|교실|호실|\d+호/.test(normalized) ||
    Boolean(roomNumber) ||
    Boolean(room);
  const selectedBuilding = wantsClassroom
    ? namedBuilding || buildings.find((p) => p.name === room?.building)
    : undefined;
  const candidates =
    category === "classroom"
      ? buildings
      : selectedBuilding
        ? [selectedBuilding]
        : [
            ...new Map(
              results.map((p) => {
                const candidate =
                  p.category === "classroom"
                    ? buildings.find((b) => b.name === p.building)
                    : p;
                return [candidate?.id, candidate] as const;
              }),
            ).values(),
          ].filter((p): p is Place => Boolean(p));
  const pickerBuildingIds =
    category === "building"
      ? []
      : candidates
          .filter(
            (p) =>
              p.category === "building" &&
              (wantsClassroom ||
                results.some(
                  (r) => r.category === "classroom" && r.building === p.name,
                )),
          )
          .map((p) => p.id);
  const explicitFloor = normalized.match(/(지하)?(\d+)층/);
  return {
    candidates,
    pickerBuildingIds,
    selectedBuilding,
    room,
    floor:
      room?.floor.match(/\d+/)?.[0] ||
      explicitFloor?.[2] ||
      (roomNumber ? String(Math.floor(Number(roomNumber) / 100)) : ""),
    basement: room
      ? room.floor.startsWith("지하")
      : Boolean(explicitFloor?.[1]),
  };
}
