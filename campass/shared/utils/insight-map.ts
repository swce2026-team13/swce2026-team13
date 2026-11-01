import { waypointLinks, waypointNodes } from "./routing.ts";
import { PARKING, PLAZA, graphEdges, nodeArea } from "./campus3d/route.ts";
import { overviewBuildings, overviewMarkers } from "./campus-overview.ts";
import { plazaLabel } from "./campus-overview-design.ts";
import { campusBuildings } from "./campus3d/types.ts";

// 관리자 열지도: 혼란 기록 지점 id를 2D 캠퍼스 지도(개요도) 좌표로 바꾼다.
// 지점 id는 「건물|층」 노드, 사진 안내 지점(waypoint), 연결통로 위 지점 중 하나

type Point = [number, number];

// 그래프 노드의 지도 위치: 건물 층은 그 건물, 광장, 출발 지점(정류장·정문·주차장)
function nodePosition(node: string): Point | undefined {
  if (node === PLAZA) return plazaLabel;
  if (node === PARKING) return overviewMarkers.find((m) => m.id === "parking_entrance_1")?.position;
  const marker = overviewMarkers.find((m) => m.id === node);
  if (marker) return marker.position;
  return overviewBuildings.find((b) => b.id === nodeArea(node))?.center;
}

// 좌표를 못 찾으면 undefined(지도에서는 빼고 목록에는 그대로 둔다)
export function insightPointPosition(id: string): Point | undefined {
  // 연결통로 위 지점: 양 끝 사이 가운데
  const linkId = waypointLinks[id];
  if (linkId) {
    const edge = graphEdges.find((e) => e.id === linkId);
    const a = edge && nodePosition(edge.a);
    const b = edge && nodePosition(edge.b);
    return a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a ?? b;
  }
  return nodePosition(waypointNodes[id] ?? id);
}

// 지점이 속한 건물 이름(관리자 표의 작은 글씨). 연결통로는 양 끝 건물을 함께, 건물 밖 지점은 undefined
export function insightPointBuilding(id: string): string | undefined {
  const name = (node: string) =>
    node === PLAZA ? PLAZA : campusBuildings().find((b) => b.id === nodeArea(node))?.name;
  const linkId = waypointLinks[id];
  const edge = linkId ? graphEdges.find((e) => e.id === linkId) : undefined;
  if (edge) return [...new Set([name(edge.a), name(edge.b)].filter(Boolean))].join(" · ") || undefined;
  return name(waypointNodes[id] ?? id);
}
