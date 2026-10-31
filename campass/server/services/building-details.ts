import {
  campusBuildings,
  loadPlaces,
  loadRooms,
  type Room,
} from "../../shared/utils/campus3d/types.ts";
import type { BuildingDetailData } from "../../shared/types/building-detail.ts";

// 검색용 호실 목록을 바꾸지 않고 상세 화면에 필요한 요약만 서버에서 만든다.
const excluded = /화장실|기계실|기계식|전기실|창고|공실/;
function purpose(room: Room) {
  const name = room.name.trim();
  if (/시청각/.test(name)) return { group: "시청각실", label: "시청각실" };
  if (/PBL/i.test(name)) return { group: "PBL 강의실", label: "PBL 강의실" };
  if (/토익스피킹센터/.test(name))
    return { group: "토익스피킹센터", label: "토익스피킹센터" };
  if (/교수연구실/.test(name) || room.use === "교수연구실")
    return { group: "교수연구실", label: "교수연구실" };
  if (/입학처/.test(name)) return { group: "입학처", label: "입학처" };
  if (/강의실/.test(name) || /강의실/.test(room.use))
    return { group: "강의실", label: "강의실" };
  if (room.use === "실험실습실") {
    const label = /studio|스튜디오/i.test(name)
      ? "스튜디오"
      : /디자인|design/i.test(name)
        ? "디자인 실습실"
        : /영화|영상|CG|편집|녹음|시사/.test(name)
          ? "영화영상 실습실"
          : name
              .replace(/\d+(?=실$)/, "")
              .replace(/[\s_-]*\(?\d+\)?\s*$/, "")
              .trim();
    return { group: "실험실습실", label: label || "실험·실습실" };
  }
  return { group: room.use || name, label: room.use || name };
}

function summarize(rooms: Room[]) {
  const groups = new Map<
    string,
    { count: number; labels: Map<string, number>; numbers: Set<number> }
  >();
  for (const room of rooms) {
    if (excluded.test(`${room.name} ${room.use}`)) continue;
    const { group, label } = purpose(room);
    if (!group) continue;
    const entry = groups.get(group) ?? {
      count: 0,
      labels: new Map<string, number>(),
      numbers: new Set<number>(),
    };
    entry.count++;
    entry.labels.set(label, (entry.labels.get(label) ?? 0) + 1);
    if (group === "시청각실") {
      const number = room.name.match(/\d+/)?.[0];
      if (number) entry.numbers.add(Number(number));
    }
    groups.set(group, entry);
  }
  const tiePriority = (name: string) =>
    name === "토익스피킹센터"
      ? 3
      : name === "행정사무실"
        ? 2
        : name === "실험실습실"
          ? 1
          : 0;
  const ranked = [...groups].sort(
    ([a, aa], [b, bb]) =>
      bb.count - aa.count || tiePriority(b) - tiePriority(a),
  );
  return (
    ranked
      .filter(
        ([group, entry], i) =>
          i === 0 ||
          entry.count >= 2 ||
          ranked[0][1].count <= 2 ||
          tiePriority(group) >= 2,
      )
      .slice(0, 2)
      .map(([group, entry]) => {
        if (group === "시청각실" && entry.numbers.size) {
          const numbers = [...entry.numbers].sort((a, b) => a - b);
          const contiguous =
            numbers.at(-1)! - numbers[0] + 1 === numbers.length;
          return `시청각실 ${contiguous && numbers.length > 1 ? `${numbers[0]}~${numbers.at(-1)}` : numbers.join("·")}`;
        }
        return [...entry.labels].sort((a, b) => b[1] - a[1])[0][0];
      })
      .join(" · ")
  );
}

let cached: BuildingDetailData[] | undefined;
export function buildingDetails(): BuildingDetailData[] {
  if (cached) return cached;
  const rooms = loadRooms(),
    places = loadPlaces();
  return (cached = campusBuildings().map((building) => ({
    id: building.id,
    name: building.name,
    floorRange: [building.floors[0]?.label, building.floors.at(-1)?.label]
      .filter(Boolean)
      .join(" ~ "),
    elevator: building.elevator === true,
    entrances: places
      .filter(
        (p) =>
          p.category === "교통 및 출입" &&
          p.buildingId === building.id &&
          /입구/.test(p.name) &&
          p.local &&
          p.local.every(Number.isFinite),
      )
      .map((p) => ({ name: p.name, local: p.local! })),
    floors: building.floors.toReversed().map((floor) => ({
      code: floor.floor,
      label: floor.floor.startsWith("B") ? floor.floor : floor.label,
      summary: summarize(
        rooms.filter(
          (room) =>
            room.buildingId === building.id && room.floor === floor.floor,
        ),
      ),
    })),
    facilities: places
      .filter((p) => p.category === "편의/복지" && p.buildingId === building.id)
      .map((p) =>
        `${p.name.replace(`(${building.name})`, "")} ${p.floorLabel}`.trim(),
      )
      .join(" · "),
  })));
}
