import { currentPlaceId, type Place } from "./catalog.ts";
import { campusBuildings } from "./campus3d/types.ts";
import { graphEdges, graphNodes, nodeArea, nodeLabel, PARKING } from "./campus3d/route.ts";
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
  if (place) return placeLabel(place);
  return graphNodes.includes(id) ? nodeLabel(id) : "출발지를 선택해 주세요";
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
