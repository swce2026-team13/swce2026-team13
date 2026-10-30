import { campusEntrances } from "@/shared/utils/campus3d/types";
import { routeCoordinate } from "@/shared/utils/campus-map";
import { markerStarts } from "@/shared/utils/map-pick";

// 표시할 입구만 고름. 원본 좌표나 경로 연결은 추가·수정하지 않음.
const entranceLabels = [
  { id: "gate_west", label: "서문(후문)", kind: "gate" },
  { id: "bus_stop_2115", label: "2115번 정류장", kind: "bus" },
  { id: "parking_entrance_2", label: "2주차장", kind: "parking" },
  { id: "parking_entrance_1", label: "1주차장", kind: "parking" },
  { id: "gate_main", label: "정문", kind: "gate" },
] as const;

export const mapEntrances = entranceLabels.map((pin) => {
  const entrance = campusEntrances().find((item) => item.id === pin.id)!;
  return {
    ...pin,
    local: entrance.local,
    coordinate: routeCoordinate(pin.id)!,
    start: markerStarts[pin.id],
  };
});

export type MapLabelBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};
export type EntranceProjection = {
  id: string;
  x: number;
  y: number;
  visible: boolean;
};
export type PlacedEntrancePin = EntranceProjection & {
  left: number;
  top: number;
  width: number;
  side: "above" | "below" | "left" | "right";
};

// 실제 좌표의 점은 옮기지 않고 이름표의 꼬리 방향·길이만 조정한다.
export function layoutEntrancePins(
  points: EntranceProjection[],
  width: number,
  height: number,
  labels: MapLabelBox[],
  denseLabels = false,
): PlacedEntrancePin[] {
  const occupied = [
    ...labels,
    { left: width - 110, right: width, top: 0, bottom: 60 },
    { left: width - 55, right: width, top: 60, bottom: 110 },
    { left: width - 60, right: width, top: height - 105, bottom: height },
  ];
  return points
    .filter(
      (p) => p.visible && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height,
    )
    .map((p) => {
      const pin = mapEntrances.find((item) => item.id === p.id)!;
      const w = [...pin.label].reduce(
        (sum, c) => sum + (c.charCodeAt(0) > 255 ? 11 : 6),
        30,
      );
      let best: PlacedEntrancePin | undefined;
      let bestScore = Infinity;
      for (const gap of denseLabels ? [10, 24, 40, 64] : [10, 24, 40]) {
        for (const side of ["above", "below", "left", "right"] as const) {
          for (const slide of denseLabels ? [0, -24, 24, -48, 48] : [0]) {
            const rawLeft =
              (side === "left"
                ? p.x - w - gap
                : side === "right"
                  ? p.x + gap
                  : p.x - w / 2) +
              (side === "above" || side === "below" ? slide : 0);
            const rawTop =
              (side === "above"
                ? p.y - 22 - gap
                : side === "below"
                  ? p.y + gap
                  : p.y - 11) +
              (side === "left" || side === "right" ? slide : 0);
            const left = Math.max(6, Math.min(rawLeft, width - w - 6));
            const top = Math.max(11, Math.min(rawTop, height - 33));
            const box = { left, right: left + w, top, bottom: top + 22 };
            const outside = Math.abs(rawLeft - left) + Math.abs(rawTop - top);
            const overlap = occupied.reduce(
              (sum, r) =>
                sum +
                Math.max(
                  0,
                  Math.min(box.right + 3, r.right) -
                    Math.max(box.left - 3, r.left),
                ) *
                  Math.max(
                    0,
                    Math.min(box.bottom + 3, r.bottom) -
                      Math.max(box.top - 3, r.top),
                  ),
              0,
            );
            const score =
              outside * 10 + overlap * 100 + gap + Math.abs(slide) * 0.5;
            if (score < bestScore) {
              bestScore = score;
              best = { ...p, left, top, width: w, side };
            }
          }
        }
      }
      const result = best!;
      occupied.push({
        left: result.left - 6,
        right: result.left + w + 6,
        top: result.top - 11,
        bottom: result.top + 33,
      });
      return result;
    });
}
