import buildingsData from "../../campus-data/buildings.json" with { type: "json" };
import linksData from "../../campus-data/links.json" with { type: "json" };
import entrancesData from "../../campus-data/entrances.json" with { type: "json" };

// 좌표는 모두 로컬 미터 [동쪽, 북쪽]. 기준점은 한림관
export type LocalPoint = [number, number];

export type Floor = {
  // 층 코드: "1", "B1" 처럼 씀. L층은 실제 층 번호
  floor: string;
  label: string;
  note?: string;
};

export type Footprint = {
  source: string;
  center: LocalPoint;
  lengthM: number;
  widthM: number;
  longSideAngleDeg: number;
  areaM2: number;
  polygon: LocalPoint[];
  approximate?: boolean;
};

export type Building = {
  id: string;
  name: string;
  nameEn: string;
  official: { lat: number; lon: number; local: LocalPoint } | null;
  footprint: Footprint;
  floors: Floor[];
  floorsSource: string;
  roomFloors: string[];
  elevator: boolean | null;
  elevatorSource: string;
  campusMapLevel?: string;
  sectionElevationDraft?: Record<string, number>;
  shape?: string;
  note?: string;
};

export type LinkStatus = "확인" | "확인 필요" | "추정" | "삭제";

export type LinkEnd = {
  // 건물 id 또는 건물이 아닌 지점 id(스콘스퀘어, 지하주차장)
  building: string;
  name: string;
  floor: string;
};

export type Link = {
  id: string;
  from: LinkEnd;
  to: LinkEnd;
  kind: "indoor" | "outdoor" | "parking";
  status: LinkStatus;
  stepFree: boolean | null;
  evidence: string[];
  note?: string;
};

export type Entrance = {
  id: string;
  name: string;
  kind:
    | "bus_stop"
    | "connector"
    | "gate"
    | "parking_entrance"
    | "building_entrance";
  building: string | null;
  buildingName: string | null;
  floor: string | null;
  stepFree: boolean | null;
  lat: number;
  lon: number;
  local: LocalPoint;
  // 걸어서 바로 이어지는 건물 층 (2115 정류장 · 정문)
  connectsTo?: { building: string; floor: string };
  connectsStatus?: LinkStatus;
  connectsEvidence?: string[];
};

// 건물이 아닌 지점: 스콘스퀘어(광장), 지하주차장
export type ExtraNode = {
  id: string;
  name: string;
  kind: "plaza" | "parking";
  note: string;
  approxLocal?: LocalPoint;
  approxLocalNote?: string;
  polygon?: LocalPoint[];
  areaM2?: number;
  polygonSource?: string;
};

export type Room = {
  building: string;
  buildingId: string;
  number: string;
  floor: string;
  name: string;
  use: string;
};

export type CampusPlace = {
  name: string;
  nameEn: string;
  building: string;
  buildingId: string;
  // 층 코드. 원래 글자는 floorLabel
  floor: string;
  floorLabel: string;
  number: string;
  category: string;
  hours: string;
  contact: string;
  lat: number | null;
  lon: number | null;
  local: LocalPoint | null;
};

export const nodeKey = (building: string, floor: string) =>
  `${building}|${floor}`;

// JSON에서 추론한 타입은 좌표를 number[]로 잡아서 직접 지정
const buildings = buildingsData.buildings as unknown as Building[];
const links = (linksData.links as unknown as Link[]).filter(
  (l) => l.status !== "삭제",
);
const extraNodes = linksData.extraNodes as unknown as ExtraNode[];
const entrances = entrancesData.entrances as unknown as Entrance[];

export const campusBuildings = () => buildings;
export const campusLinks = () => links;
export const campusExtraNodes = () => extraNodes;
export const campusEntrances = () => entrances;

export function buildingPosition(building: Building): LocalPoint {
  return building.official?.local ?? building.footprint.center;
}

// 장소 표의 층 글자를 층 코드로. 알 수 없는 글자(로비 등)는 빈칸
export function floorCode(buildingId: string, text: string) {
  const value = text.trim();
  if (value === "L층")
    return (
      buildings
        .find((b) => b.id === buildingId)
        ?.floors.find((f) => f.label === "L층")?.floor ?? ""
    );
  const match = value.match(/^(지하\s*)?(\d+)층/);
  if (!match) return "";
  return `${match[1] ? "B" : ""}${match[2]}`;
}

// 교수 연구실 이름에는 사람 이름이 들어 있어 이름을 빼고 돌려줌
// '○○교 수연구실'처럼 띄어쓰기로 갈라진 경우도 잡도록 공백을 빼고 봄
export const roomName = (name: string) =>
  name.replace(/\s/g, "").includes("교수") ? "교수연구실" : name;

// 호실·장소 표는 크기가 커서 서버에서만 읽음
function readTable(file: string) {
  const fs =
    typeof process === "undefined"
      ? undefined
      : process.getBuiltinModule?.("node:fs");
  if (!fs) throw new Error("캠퍼스 표 자료는 서버에서만 읽을 수 있어요.");
  const [, ...rows] = fs
    .readFileSync(`${process.cwd()}/campus-data/${file}`, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split("\t"));
  return rows;
}

const toNumber = (value: string) => (value === "" ? null : Number(value));

let rooms: Room[] | undefined;
export function loadRooms() {
  return (rooms ??= readTable("rooms.tsv").map(
    ([building, buildingId, number, floor, name, use]) => ({
      building,
      buildingId,
      number,
      floor,
      name: roomName(name),
      use,
    }),
  ));
}

let places: CampusPlace[] | undefined;
export function loadPlaces() {
  return (places ??= readTable("places.tsv").map(
    ([
      name,
      nameEn,
      building,
      buildingId,
      floorLabel,
      number,
      category,
      hours,
      contact,
      lat,
      lon,
      east,
      north,
    ]) => ({
      name,
      nameEn,
      building,
      buildingId,
      floor: floorCode(buildingId, floorLabel),
      floorLabel,
      number,
      category,
      hours,
      contact,
      lat: toNumber(lat),
      lon: toNumber(lon),
      local: east && north ? [Number(east), Number(north)] : null,
    }),
  ));
}
