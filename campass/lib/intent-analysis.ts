import { searchPlaces, type Place } from "./catalog.ts";
import { allPlaces, floorPlaces } from "./rooms.ts";
import { campusBuildings } from "./campus3d/types.ts";
import type { IntentResult } from "./providers.ts";

const normalize = (text: string) => text.replaceAll("헤인", "혜인").replace(/\s/g, "").toLowerCase();

export function splitJourney(query: string) {
  const match = query.match(/^(.+?)(?:에서|부터)\s*(.+)$/);
  if (!match || /^(?:여기|지금|이곳)$/.test(match[1].trim())) return null;
  return { start: match[1].trim(), destination: match[2].replace(/까지.*$/, "").trim() };
}

export function resolveIntentPlaces(query: string): { places: Place[]; exact: boolean } {
  const text = normalize(query);
  const list = allPlaces();
  const buildings = campusBuildings().filter((b) => text.includes(normalize(b.name)));
  const building = buildings.length === 1 ? buildings[0] : undefined;
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
  const matches = searchPlaces(query, undefined, undefined, list);
  const named = matches.filter((p) => p.name.length >= 2 && text.includes(normalize(p.name)) &&
    p.category !== "building" && (!building || p.building === building.name));
  if (named.length) return { places: named, exact: named.length === 1 };
  // 건물 이름만 명확한 경우에는 같은 건물의 모든 시설을 후보로 펼치지 않아요.
  if (building && !/카페|커피|식당|편의점|매점|시청각|엘리베이터|승강기|말고|아니|근처/.test(text)) {
    const remaining = text.replace(normalize(building.name), "");
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
  const journey = splitJourney(searchQuery);
  if (journey) return true;
  if (/^\s*\d{3,4}호/.test(searchQuery) && !hasDestinationRequest(searchQuery.replace(/^\s*\d{3,4}호/, "")))
    return false;
  if (keyword.intent === "condition" && !hasDestinationRequest(searchQuery)) return false;
  if (!keyword.places.length) return true;
  if (/말고|아니|근처|가까운|중에서/.test(query)) return true;
  return !resolveIntentPlaces(searchQuery).exact;
}
