export type LabelBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

// 지도 이름표와 겹치지 않는 가장 가까운 자리. 좌표·크기는 같은 SVG 좌표계를 사용한다.
export function placeRouteBadge(
  anchor: [number, number],
  width: number,
  height: number,
  occupied: LabelBox[],
  viewport: LabelBox,
): [number, number] {
  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(high, value));
  let best: [number, number] = anchor;
  let bestOverlap = Infinity;
  for (let ring = 1; ring <= 6; ring++) {
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const x = clamp(
        anchor[0] + dx * (width / 2 + 10) * ring,
        viewport.left + width / 2,
        viewport.right - width / 2,
      );
      const y = clamp(
        anchor[1] + dy * (height / 2 + 10) * ring,
        viewport.top + height / 2,
        viewport.bottom - height / 2,
      );
      const overlap = occupied.reduce(
        (sum, b) =>
          sum +
          Math.max(
            0,
            Math.min(x + width / 2, b.right) - Math.max(x - width / 2, b.left),
          ) *
            Math.max(
              0,
              Math.min(y + height / 2, b.bottom) -
                Math.max(y - height / 2, b.top),
            ),
        0,
      );
      if (overlap === 0) return [x, y];
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = [x, y];
      }
    }
  }
  return best;
}
