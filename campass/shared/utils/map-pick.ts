import { calculateRoute } from "./routing.ts";

// 지도에서 고른 출발·도착. 값은 장소 id(건물 · 스콘스퀘어) 또는 지도 표시(입구) id
export type MapPick = { start: string | null; destination: string | null };

export const emptyPick: MapPick = { start: null, destination: null };

// 출발로 고를 수 있는 지도 표시와 길찾기에서 쓰는 출발지 id. 건물은 id를 그대로 씀
export const markerStarts: Record<string, string> = {
  bus_stop_2115: "bus_stop_2115",
  gate_main: "gate",
  parking_entrance_1: "parking",
};

// 처음 누른 곳이 출발, 다음에 누른 건물이 도착. 고른 곳을 다시 누르면 취소
// 지도 표시(정류장·정문·주차장)는 출발로만 고를 수 있음
export function pickOnMap(pick: MapPick, id: string, building: boolean): MapPick {
  if (pick.start === id) return { ...pick, start: null };
  if (pick.destination === id) return { ...pick, destination: null };
  if (!pick.start || !building) return { ...pick, start: id };
  return { ...pick, destination: id };
}

// 안내 가능 여부는 엘리베이터를 켠 경로부터 보고, 없으면 계단 길로 다시 봄
export function pickStatus(pick: MapPick): {
  ready: boolean;
  start?: string;
  elevator: boolean;
  message: string;
} {
  const start = pick.start ? (markerStarts[pick.start] ?? pick.start) : undefined;
  if (!start || !pick.destination)
    return { ready: false, start, elevator: true, message: "" };
  for (const elevator of [true, false]) {
    try {
      calculateRoute(start, pick.destination, elevator);
      return { ready: true, start, elevator, message: "" };
    } catch {}
  }
  return {
    ready: false,
    start,
    elevator: true,
    message: "아직 안내 경로가 없는 곳이에요",
  };
}
