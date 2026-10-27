// 행사 카드처럼 일정 시간마다 다음 항목으로 넘기는 타이머
// 멈춤 이유(화면 숨김, 마우스, 포커스)가 하나라도 있으면 넘기지 않고, 다시 움직일 때 처음부터 셈
export const ROTATION_DELAY = 10_000;

export function createRotation(
  count: number,
  onChange: (index: number) => void,
  delay = ROTATION_DELAY,
) {
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const holds = new Set<string>();

  function schedule() {
    clearTimeout(timer);
    timer = undefined;
    if (count < 2 || holds.size) return;
    timer = setTimeout(() => {
      index = (index + 1) % count;
      onChange(index);
      schedule();
    }, delay);
  }

  schedule();
  return {
    get index() {
      return index;
    },
    select(next: number) {
      index = ((next % count) + count) % count;
      onChange(index);
      schedule();
    },
    hold(reason: string, on: boolean) {
      if (on === holds.has(reason)) return;
      if (on) holds.add(reason);
      else holds.delete(reason);
      schedule();
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
