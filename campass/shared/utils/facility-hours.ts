// 학교 캠퍼스맵 편의시설 운영 시간 해석. 학기 중 기준이고 방학 값은 무시함
// 서버와 화면이 같이 쓰므로 파일을 읽지 않음

type Day =
  | { type: "open"; from: string; to: string }
  | { type: "allday" }
  | { type: "closed" }
  | { type: "unknown" };

export type FacilityHours = {
  // 상세 화면용 줄 (예: { label: "평일", value: "08:00–20:00" })
  lines: { label: string; value: string }[];
  // 카드용 한 줄 (예: '평일 08:00–20:00 · 일 10:30–17:30')
  summary: string;
  // 월요일부터 일요일까지. 원문이 없으면 null
  week: Day[] | null;
};

const dayNames = ["월", "화", "수", "목", "금", "토", "일"];
const UNKNOWN = "운영 시간 확인 중";

const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const pad = (time: string) => time.padStart(5, "0");

function timeDay(from: string, to: string): Day {
  if (minutes(from) === 0 && minutes(to) === 24 * 60) return { type: "allday" };
  // 끝이 시작보다 이르면(예: 10:00 ~ 04:00) 원문이 맞는지 알 수 없음
  if (minutes(to) <= minutes(from)) return { type: "unknown" };
  return { type: "open", from: pad(from), to: pad(to) };
}

function dayText(day: Day) {
  if (day.type === "open") return `${day.from}–${day.to}`;
  if (day.type === "allday") return "24시간";
  if (day.type === "closed") return "휴무";
  return "확인 중";
}

const same = (a: Day, b: Day) => dayText(a) === dayText(b);

export function parseHours(raw: string | undefined): FacilityHours {
  const text = raw?.trim() ?? "";
  if (!text)
    return {
      lines: [{ label: "운영 시간", value: "확인 중" }],
      summary: UNKNOWN,
      week: null,
    };

  let openDays = dayNames.map(() => true);
  let base: Day | undefined;
  const overrides = new Map<number, Day>();
  let vacation = false;
  for (const part of text.split("/").map((p) => p.trim())) {
    if (part.startsWith("방학중")) vacation = true;
    const days = part.match(
      /^요일\s*:\s*([월화수목금토일])\s*~\s*([월화수목금토일])/,
    );
    if (days) {
      vacation = false;
      const from = dayNames.indexOf(days[1]);
      const to = dayNames.indexOf(days[2]);
      openDays = dayNames.map((_, i) => i >= from && i <= to);
      continue;
    }
    if (vacation) continue;
    const single = part.match(/^([토일])요일\s*(.*)$/);
    const time = (single ? single[2] : part).match(
      /^(?:학기중|평일)?\s*(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})/,
    );
    if (single) {
      const index = dayNames.indexOf(single[1]);
      if (/휴무/.test(single[2])) overrides.set(index, { type: "closed" });
      else if (time) overrides.set(index, timeDay(time[1], time[2]));
    } else if (time) base = timeDay(time[1], time[2]);
  }

  const week: Day[] = dayNames.map((_, i) =>
    !openDays[i]
      ? { type: "closed" }
      : (overrides.get(i) ?? base ?? { type: "unknown" }),
  );
  return { ...describe(week), week };
}

function describe(week: Day[]) {
  if (week.every((d) => same(d, week[0]))) {
    if (week[0].type === "allday")
      return {
        lines: [{ label: "매일", value: "24시간" }],
        summary: "24시간 · 매일",
      };
    if (week[0].type === "unknown")
      return {
        lines: [{ label: "운영 시간", value: "확인 중" }],
        summary: UNKNOWN,
      };
    return {
      lines: [{ label: "매일", value: dayText(week[0]) }],
      summary: `매일 ${dayText(week[0])}`,
    };
  }
  const lines: { label: string; value: string }[] = [];
  const weekdays = week.slice(0, 5);
  if (weekdays.every((d) => same(d, weekdays[0])))
    lines.push({ label: "평일", value: dayText(weekdays[0]) });
  else
    weekdays.forEach((d, i) =>
      lines.push({ label: `${dayNames[i]}요일`, value: dayText(d) }),
    );
  const [saturday, sunday] = week.slice(5);
  if (same(saturday, sunday))
    lines.push({ label: "주말", value: dayText(saturday) });
  else {
    lines.push({ label: "토요일", value: dayText(saturday) });
    lines.push({ label: "일요일", value: dayText(sunday) });
  }
  // 요약에는 여는 날만. '토요일' → '토'
  const open = lines.filter((l) => l.value !== "휴무" && l.value !== "확인 중");
  const summary = open.length
    ? open
        .map((l) => `${l.label.replace(/^([토일])요일$/, "$1")} ${l.value}`)
        .join(" · ")
    : UNKNOWN;
  return { lines, summary };
}

// 지금 열려 있는지. 모르면 null. 시간은 서울 기준이고 공휴일은 따지지 않음
export function isOpenNow(hours: FacilityHours, now: Date): boolean | null {
  if (!hours.week) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    get("weekday"),
  );
  const day = hours.week[index];
  if (!day || day.type === "unknown") return null;
  if (day.type === "closed") return false;
  if (day.type === "allday") return true;
  const current = Number(get("hour")) * 60 + Number(get("minute"));
  return current >= minutes(day.from) && current < minutes(day.to);
}
