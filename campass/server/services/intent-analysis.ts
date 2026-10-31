import { searchPlaces, type Place } from "../../shared/utils/catalog.ts";
import { allPlaces, floorPlaces } from "./rooms.ts";
import { campusBuildings } from "../../shared/utils/campus3d/types.ts";
import { MAP_MARKERS, type MapMarker } from "../../shared/utils/campus-map.ts";
import type { IntentResult } from "../integrations/providers.ts";

const normalize = (text: string) => text.replaceAll("헤인", "혜인").replace(/\s/g, "").toLowerCase();

// 지도 출발 지점(정문·정류장·주차장)을 부르는 다른 이름
const startAliases: Record<string, string[]> = {
  gate: ["정문", "학교 정문", "정문 입구"],
  bus_stop_2115: ["2115번 정류장", "2115번", "2115", "정류장", "버스 정류장"],
  parking: ["1주차장", "주차장"],
};

// 글로 쓴 출발 지점을 지도 표시로 바꿔요. 출발로만 쓰고 도착 후보에는 넣지 않아요.
export function resolveStartPoint(text: string): MapMarker | undefined {
  const target = normalize(text)
    .replace(/(?:에서|부터|으로|로|이요|이에요|예요|입니다|요|이|가|은|는)?[.!?]*$/u, "");
  return MAP_MARKERS.find((marker) =>
    [marker.label, ...(startAliases[marker.routeId] ?? [])]
      .some((name) => normalize(name) === target));
}

// 건물 이름이나 출발 지점만 쓴 말인지. '본관 혜인관'처럼 띄어 쓴 출발·도착을 나눌 때만 써요.
function isEndpoint(text: string) {
  const target = normalize(text);
  return Boolean(resolveStartPoint(text)) || campusBuildings().some((b) =>
    normalize(b.name) === target || (b.name.endsWith("관") && b.name.length >= 3 &&
      normalize(b.name.slice(0, -1)) === target));
}

export function splitJourney(query: string) {
  const journey = (start: string, destination: string) =>
    /^(?:여기|지금|이곳)$/.test(start.trim()) ? null
      : { start: start.trim(), destination: destination.replace(/까지.*$/, "").trim() };
  const match = query.match(/^(.+?)(?:에서|부터)\s*(.+)$/) ??
    query.match(/^(.+?)\s*(?:↔|→|->|~)\s*(.+)$/);
  if (match) return journey(match[1], match[2]);
  // 띄어쓰기만 있으면 앞뒤가 둘 다 건물이나 출발 지점일 때만 앞을 출발, 뒤를 도착으로 봐요.
  const words = query.trim().split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const start = words.slice(0, i).join(" ");
    const destination = words.slice(i).join(" ").replace(/까지.*$/, "");
    if (isEndpoint(start) && isEndpoint(destination)) return journey(start, destination);
  }
  return null;
}

export function resolveIntentPlaces(query: string): { places: Place[]; exact: boolean } {
  const target = query.replace(/^(?:아니|그럼)\s*/, "")
    .replace(/(?:으로|로)\s*(?:바꿀게요|바꿔줘|변경할게요).*$/, "");
  const text = normalize(target);
  const list = allPlaces();
  const buildings = campusBuildings().map((b) => {
    const short = b.name.endsWith("관") ? b.name.slice(0, -1) : "";
    const mention = [b.name, ...(short.length >= 2 ? [short] : [])]
      .find((name) => text.includes(normalize(name)));
    return { building: b, mention };
  }).filter((item) => item.mention);
  const building = buildings.length === 1 ? buildings[0].building : undefined;
  const buildingMention = buildings.length === 1 ? buildings[0].mention : undefined;
  const number = text.match(/(\d{3,4})(?:호)?/)?.[1];
  const floor = text.match(/(지하\d+|b\d+|\d+|l)층/);
  if (number) {
    if (!building && /[가-힣]+관/.test(text)) return { places: [], exact: false };
    const rooms = list.filter((p) => p.category === "classroom" &&
      (!building || p.building === building.name) &&
      (p.number === number || p.name.startsWith(`${number}호`)));
    return { places: rooms, exact: rooms.length === 1 && Boolean(building) };
  }
  if (building && floor) {
    const registered = building.floors.find((f) =>
      normalize(f.label) === floor[0] || `${f.floor.toLowerCase()}층` === floor[0]);
    const place = registered && floorPlaces().find((p) => p.id === `${building.id}|${registered.floor}`);
    return { places: place ? [place] : [], exact: Boolean(place) };
  }
  const matches = searchPlaces(target, undefined, undefined, list);
  const named = matches.filter((p) => p.name.length >= 2 && text.includes(normalize(p.name)) &&
    p.category !== "building" && (!building || p.building === building.name));
  if (named.length) return { places: named, exact: named.length === 1 };
  const purpose = /배고파|배고프|허기|밥\s*먹|식사|점심|저녁|학식|식당/.test(target)
    ? "dining" : /커피|카페|아메리카노/.test(target) ? "cafe" : "";
  if (purpose) {
    const options = list.filter((p) => p.kind === purpose && (!building || p.building === building.name));
    if (options.length) return { places: options, exact: false };
  }
  if (/택배|소포|우편|편지\s*부치/.test(target)) {
    const options = list.filter((p) => p.name === "우체국" && (!building || p.building === building.name));
    if (options.length) return { places: options, exact: false };
  }
  // 건물 이름만 명확한 경우에는 같은 건물의 모든 시설을 후보로 펼치지 않아요.
  if (building && !/카페|커피|식당|편의점|매점|시청각|엘리베이터|승강기|말고|아니|근처/.test(text)) {
    const remaining = text.replace(normalize(buildingMention ?? building.name), "");
    if (/^(?:은|는|이|가|을|를|으로|로|까지|어디|예요|에요|인가요|가고|싶어요|가는|길|알려|주세요|가야|해요|갈게요|[?.!])*$/u.test(remaining))
      return { places: list.filter((p) => p.id === building.id), exact: true };
  }
  const scoped = building ? matches.filter((p) => p.building === building.name && p.category !== "building") : matches;
  return { places: scoped, exact: scoped.length === 1 };
}

export function hasDestinationRequest(searchQuery: string) {
  const remaining = searchQuery.replace(/(?:계단은?\s*못\s*가요|여기서|때문에|들고|많아요|부탁해요|할래요|타고|으로|로|가고|싶어요|갈래요|갈게요|가려(?:고요|고)|가려고요|가요|이동|해요|주세요|[을은이가]|[\s.!?])/g, "");
  return Boolean(remaining);
}

export function shouldComplementIntent(query: string, searchQuery: string, keyword: IntentResult) {
  if (!searchQuery || (keyword.intent === "next" && !splitJourney(searchQuery))) return false;
  if (resolveStartPoint(searchQuery)) return false;
  const journey = splitJourney(searchQuery);
  if (journey) return true;
  if (/^\s*\d{3,4}호/.test(searchQuery) && !hasDestinationRequest(searchQuery.replace(/^\s*\d{3,4}호/, "")))
    return false;
  if (keyword.intent === "condition" && !hasDestinationRequest(searchQuery)) return false;
  if (!keyword.places.length) return true;
  if (/^(?:배고파요|커피\s*마시고\s*싶어요|택배\s*부치려고요)[.!?]?$/u.test(searchQuery.trim()))
    return false;
  if (/^(?:아니|그럼)\s*.+(?:바꿀게요|바꿔줘|변경할게요)/.test(searchQuery) &&
      resolveIntentPlaces(searchQuery).exact) return false;
  if (/말고|아니|근처|가까운|중에서/.test(query)) return true;
  return !resolveIntentPlaces(searchQuery).exact;
}
