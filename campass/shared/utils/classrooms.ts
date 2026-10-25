import { places, type Place } from "./catalog.ts";

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

export function classroomSearch(
  query: string,
  results: Place[],
  category?: string,
) {
  const buildings = places.filter((p) => p.category === "building");
  const normalized = query.replaceAll("헤인", "혜인").replace(/\s/g, "");
  const namedBuilding = buildings.find((p) => normalized.includes(p.name));
  const roomNumber = normalized.match(/(\d{3,4})(?:호)?/)?.[1];
  const wantsClassroom =
    category === "classroom" ||
    /강의실|교실|호실|\d+호/.test(normalized) ||
    Boolean(roomNumber);
  const room = roomNumber
    ? places.find(
        (p) =>
          p.category === "classroom" &&
          p.name.startsWith(`${roomNumber}호`) &&
          (!namedBuilding || p.building === namedBuilding.name),
      )
    : undefined;
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
