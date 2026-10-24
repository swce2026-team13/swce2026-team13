export type Place = {
  id: string;
  name: string;
  building: string;
  floor: string;
  category: "building" | "classroom" | "facility" | "event";
  aliases: string[];
  verified: boolean;
  source: string;
  description: string;
  // 학교 캠퍼스맵 호실 번호 (호실 장소만)
  number?: string;
  // 운영 시간 원문 (학교 편의시설만)
  hours?: string;
  // 편의시설 종류
  kind?: "cafe" | "store" | "dining" | "aed" | "etc";
  // 위치 보충 (예: 서경스포렉스 안, 로비)
  note?: string;
};
export const sources = {
  map: "https://www.skuniv.ac.kr/campus-map",
  notice: "https://www.skuniv.ac.kr/notice/61233",
  figma: "https://www.figma.com/design/ktNH70g1zWpBa3tDQKYASe/1",
};
export const campus = {
  name: "서경대학교",
  address: "서울특별시 성북구 서경로 124",
  checkedAt: "2026-10-08",
  sources,
};
const names: [string, string][] = [
  ["hyein", "혜인관"],
  ["bon", "본관"],
  ["yudam", "유담관"],
  ["bukak", "북악관"],
  ["munye", "문예관"],
  ["daeil", "대일관"],
  ["chungwoon", "청운관"],
  ["hallim", "한림관"],
  ["eunju1", "은주1관"],
  ["eunju2", "은주2관"],
  ["suin", "수인관"],
  ["sangseung", "상승관"],
  ["creative", "크리에이티브센터"],
];
export const places: Place[] = [
  {
    id: "interview",
    name: "면접 대기실",
    building: "혜인관",
    floor: "3층",
    category: "event",
    aliases: ["면접", "수시", "면접 보러 왔어요", "혜인관 3층"],
    verified: false,
    source: sources.figma,
    description: "시연용 행사 · 실제 면접 장소는 입학 공지 확인",
  },
  ...names.map(([id, name]): Place => ({
    id,
    name,
    building: name,
    floor: "",
    category: "building",
    aliases: [name],
    verified: true,
    source: sources.notice,
    description: "서경대학교 공식 캠퍼스맵 등재",
  })),
  ...["301", "302", "303", "304", "305", "307", "311"].map((room): Place => ({
    id: `hyein-${room}`,
    name: `${room}호 강의실`,
    building: "혜인관",
    floor: "3층",
    category: "classroom",
    aliases: [room, `혜인관 ${room}`],
    verified: true,
    source: sources.notice,
    description: "2026 신입생 OT 공지에 등재 · 층은 호실 번호 기준",
  })),
  ...[1, 2, 3, 4].map((n): Place => ({
    id: `hyein-av${n}`,
    name: `시청각실 ${n}`,
    building: "혜인관",
    floor: "지하 1층",
    category: "classroom",
    aliases: [`시청각실${n}`],
    verified: true,
    source: sources.notice,
    description: "2026 신입생 OT 공지에 지하 1층으로 명시",
  })),
  {
    id: "parking",
    name: "제1주차장 P1",
    building: "제1주차장",
    floor: "",
    category: "facility",
    aliases: ["주차장", "P1"],
    verified: true,
    source: sources.notice,
    description: "공식 캠퍼스맵 등재 · 실내 동선은 미검증",
  },
  {
    id: "elevator",
    name: "엘리베이터",
    building: "혜인관",
    floor: "1층",
    category: "facility",
    aliases: ["엘리베이터", "승강기"],
    verified: false,
    source: sources.figma,
    description: "시연용 위치 · 현장 확인 필요",
  },
  {
     id: "eunju1_5f_front",
     name: "은주1관 5층 앞",
     building: "은주1관",
     floor: "5층",
     category: "facility",
     aliases: ["은주1관", "은주관 5층", "은주1관 5층"],
     verified: false,
     source: "시연 동선(임시)",
     description: "한림관 6층 연결통로를 지나 도착하는 은주1관 5층 앞",
   }, 
  {
    id: "스콘스퀘어",
    name: "스콘스퀘어",
    building: "스콘스퀘어",
    floor: "",
    category: "facility",
    aliases: ["스콘스퀘어", "광장"],
    verified: true,
    source: sources.map,
    description: "은주1관 · 혜인관 사이 광장 · 아래가 지하주차장",
  },
];
// 건물 id를 캠퍼스 데이터에 맞추기 전의 id. 저장된 세션과 이전 요청을 새 id로 받음
const renamedPlaceIds: Record<string, string> = {
  main: "bon",
  cheongun: "chungwoon",
  hanlim: "hallim",
};
export const currentPlaceId = (id: string) => renamedPlaceIds[id] ?? id;
// 서버에서는 호실까지 넣은 목록을 list로 넘김
export function searchPlaces(
  query: string,
  category?: string,
  building?: string,
  list: Place[] = places,
): Place[] {
  const normalize = (s: string) =>
    s.toLowerCase().replaceAll("헤인", "혜인").replace(/\s/g, "");
  const q = normalize(query.trim());
  const filtered = list.filter(
    (p) =>
      (!category || p.category === category) &&
      (!building || p.building === building),
  );
  if (!q) return filtered;
  return filtered
    .map((p) => {
      const full = normalize(`${p.building}${p.floor}${p.name}`);
      const terms = [
        ...new Set([...p.aliases, p.building, p.name].map(normalize)),
      ];
      const score = full.includes(q)
        ? 100
        : terms.reduce(
            (n, a) => n + (a.length >= 2 && q.includes(a) ? a.length : 0),
            0,
          );
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}
