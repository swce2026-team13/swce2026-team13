import { currentPlaceId, searchPlaces, type Place } from "./catalog.ts";
import { campusBuildings } from "./campus3d/types.ts";
import { graphEdges, nodeArea, PARKING } from "./campus3d/route.ts";
import { markerStarts } from "./map-pick.ts";
import { startPoint, waypoints } from "./routing.ts";

export function placeLabel(place: Place) {
  const location = [place.building, place.floor].filter(Boolean).join(" ");
  if (location && place.name.startsWith(location)) return place.name;
  return [
    ...new Set([place.building, place.floor, place.name].filter(Boolean)),
  ].join(" ");
}

export function startLabel(id: string, list: Place[]) {
  const waypoint = waypoints.find((point) => point.id === id);
  if (waypoint) return waypoint.name;
  const place = list.find((item) => item.id === id);
  return place ? placeLabel(place) : "출발지를 선택해 주세요";
}

export function startChoices(query: string, list: Place[]) {
  const normalized = query.trim().replace(/\s/g, "").toLowerCase();
  if (!normalized) return [];
  const ids = new Set(
    searchPlaces(query, undefined, undefined, list).map((p) => p.id),
  );
  for (const point of waypoints) {
    if (point.name.replace(/\s/g, "").toLowerCase().includes(normalized))
      ids.add(point.id);
  }
  return [...ids].map((id) => ({ id, name: startLabel(id, list) }));
}

export function startMapIds(id: string, list: Place[]) {
  if (!id) return [];
  const marker = Object.keys(markerStarts).find(
    (key) => markerStarts[key] === id,
  );
  if (marker) return [marker];
  const point = startPoint(id, list);
  if (point?.link) {
    const edge = graphEdges.find((item) => item.id === point.link);
    return edge ? [...new Set([nodeArea(edge.a), nodeArea(edge.b)])] : [];
  }
  if (point)
    return [
      point.node === PARKING ? "parking_entrance_1" : nodeArea(point.node),
    ];
  const place = list.find((item) => item.id === id);
  const building = campusBuildings().find(
    (item) => item.name === place?.building,
  );
  return building ? [building.id] : [];
}

export function samePlace(start: string, destination: string) {
  return (
    Boolean(start) && currentPlaceId(start) === currentPlaceId(destination)
  );
}
