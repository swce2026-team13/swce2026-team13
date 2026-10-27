import type { ConversationContext } from "../shared/utils/conversation-context.ts";

export type EvaluationCategory = "단순 장소" | "복합 질문" | "후속 질문" | "모호한 질문" | "의미·오타·별칭" | "범위 밖·미등록";
export type EvaluationCase = {
  id: string;
  query: string;
  category: EvaluationCategory;
  prior?: Omit<ConversationContext, "expiresAt">;
  intent: "destination" | "condition" | "next" | "outside";
  startId?: string;
  destinationIds: string[];
  elevator?: boolean;
  clarify: boolean;
  unregistered: boolean;
  source: "작성된 시뮬레이션";
  note?: string;
};

const cafe = ["facility-daeil-1", "facility-yudam-4", "facility-eunju2-1"];
const dining = ["facility-yudam-6", "facility-chungwoon-3", "facility-chungwoon-4", "facility-hallim-1"];
const stores = ["facility-bukak-1", "facility-yudam-5", "facility-chungwoon-1"];
const room301 = ["hyein-301", "room-daeil-301", "room-eunju1-301", "room-munye-301"];
const room302 = ["hyein-302", "room-daeil-302", "room-eunju1-302", "room-munye-302"];
const audio = ["hyein-av1", "hyein-av2", "hyein-av3", "hyein-av4"];

function make(id: string, category: EvaluationCategory, query: string, destinationIds: string[], extra: Partial<EvaluationCase> = {}): EvaluationCase {
  return {
    id, query, category, intent: "destination", destinationIds,
    clarify: destinationIds.length > 1, unregistered: false,
    source: "작성된 시뮬레이션", ...extra,
  };
}

const simple: Array<[string, string]> = [
  ["혜인관 어디에 있나요?", "hyein"],
  ["본관 가는 길", "bon"],
  ["유담관을 찾고 있어요", "yudam"],
  ["북악관은 어디예요?", "bukak"],
  ["문예관까지 가려고요", "munye"],
  ["대일관 위치 알려 줘", "daeil"],
  ["청운관으로 가야 해요", "chungwoon"],
  ["한림관은 어느 쪽이에요?", "hallim"],
  ["은주1관 찾습니다", "eunju1"],
  ["은주2관 안내해 주세요", "eunju2"],
  ["수인관에 가고 싶어요", "suin"],
  ["상승관 어디 있지?", "sangseung"],
  ["크리에이티브센터까지 어떻게 가요?", "creative"],
  ["혜인관 301호 강의실", "hyein-301"],
  ["혜인관 307호를 찾아요", "hyein-307"],
  ["대일관 303호 강의실에 가요", "room-daeil-303"],
  ["유담관 529호 어디죠?", "room-yudam-529"],
  ["유담관 H04 강의실 위치", "room-yudam-541"],
  ["유담관 701호 실습실", "room-yudam-701"],
  ["문예관 302호 대합주실", "room-munye-302"],
  ["카페 로렐 어디예요?", "facility-yudam-4"],
  ["우체국을 찾고 있어요", "facility-yudam-3"],
  ["신한은행 위치 알려 줘", "facility-yudam-2"],
  ["노브랜드버거에 갈래요", "facility-chungwoon-3"],
  ["수유리우동이 어디 있어요?", "facility-chungwoon-4"],
  ["면접 대기실 안내해 주세요", "interview"],
  ["공모전 발표 장소를 찾아요", "contest-final"],
  ["스콘스퀘어 가는 길", "스콘스퀘어"],
  ["제1주차장 P1은 어디예요?", "parking"],
  ["한림관 교직원/학생식당 위치", "facility-hallim-1"],
];

const compound: Array<[string, string, string, boolean | undefined]> = [
  ["정문에서 혜인관까지 가요", "gate", "hyein", undefined],
  ["2115번 정류장에서 면접 대기실까지 엘리베이터로", "bus_stop_2115", "interview", true],
  ["제1주차장에서 본관까지 가는 길", "parking", "bon", undefined],
  ["본관에서 한림관까지 계단으로 가요", "bon", "hallim", false],
  ["한림관에서 혜인관까지 엘리베이터 타고", "hallim", "hyein", true],
  ["청운관에서 유담관까지 길 알려 주세요", "chungwoon", "yudam", undefined],
  ["유담관에서 스콘스퀘어까지 안내", "yudam", "스콘스퀘어", undefined],
  ["북악관에서 카페 로렐까지 이동해요", "bukak", "facility-yudam-4", undefined],
  ["혜인관에서 우체국까지 가고 싶어요", "hyein", "facility-yudam-3", undefined],
  ["정문에서 공모전 발표까지 승강기로 가요", "gate", "contest-final", true],
  ["2115 정류장에서 혜인관 301호까지", "bus_stop_2115", "hyein-301", undefined],
  ["본관부터 면접 대기실까지 계단 없이", "bon", "interview", true],
  ["대일관에서 청운관으로 가고 싶어요", "daeil", "chungwoon", undefined],
  ["수인관에서 한림관까지 가는 길", "suin", "hallim", undefined],
  ["문예관에서 본관까지 엘리베이터 이용해서", "munye", "bon", true],
  ["상승관에서 유담관까지 계단으로", "sangseung", "yudam", false],
  ["크리에이티브센터에서 혜인관까지 부탁해요", "creative", "hyein", undefined],
  ["은주1관에서 은주2관까지 갈래요", "eunju1", "eunju2", undefined],
  ["은주2관에서 북악관까지 안내해 줘", "eunju2", "bukak", undefined],
  ["혜인관부터 유담관 529호까지 엘리베이터로", "hyein", "room-yudam-529", true],
  ["정문에서 청운관 편의점까지 가요", "gate", "facility-chungwoon-1", undefined],
  ["본관에서 신한은행까지 가는 길", "bon", "facility-yudam-2", undefined],
  ["한림관에서 공모전 발표까지 계단 없이", "hallim", "contest-final", true],
  ["유담관에서 혜인관 307호까지", "yudam", "hyein-307", undefined],
  ["북악관부터 노브랜드버거까지", "bukak", "facility-chungwoon-3", undefined],
  ["대일관에서 면접 대기실까지 승강기로", "daeil", "interview", true],
  ["청운관에서 문예관까지 계단으로 이동", "chungwoon", "munye", false],
  ["정문에서 한림관 교직원/학생식당까지", "gate", "facility-hallim-1", undefined],
  ["2115번 정류장에서 카페 로렐까지", "bus_stop_2115", "facility-yudam-4", undefined],
  ["제1주차장에서 우체국까지 엘리베이터 타고", "parking", "facility-yudam-3", true],
  ["유담관에서 본관까지 휠체어로 가요", "yudam", "bon", true],
  ["혜인관에서 스콘스퀘어까지 계단으로", "hyein", "스콘스퀘어", false],
  ["은주1관에서 카페 로렐까지 엘리베이터로", "eunju1", "facility-yudam-4", true],
  ["본관에서 유담관 701호까지", "bon", "room-yudam-701", undefined],
  ["한림관에서 제1주차장까지 가고 싶어요", "hallim", "parking", undefined],
];

type Followup = [string, string, string | undefined, boolean | undefined, string | undefined, boolean | undefined, "destination" | "condition" | "next"];
const followups: Followup[] = [
  ["그럼 엘리베이터로는?", "hyein", "gate", false, "hyein", true, "condition"],
  ["아니 혜인관으로 바꿀게요", "hallim", "bon", undefined, "hyein", undefined, "destination"],
  ["거기까지 계단으로 갈게요", "interview", "bus_stop_2115", true, "interview", false, "condition"],
  ["그럼 승강기를 타고 싶어요", "contest-final", "gate", false, "contest-final", true, "condition"],
  ["목적지를 유담관으로 바꿔줘", "bon", "gate", undefined, "yudam", undefined, "destination"],
  ["대신 카페 로렐로 가요", "facility-yudam-3", "hyein", undefined, "facility-yudam-4", undefined, "destination"],
  ["그쪽까지 계단 없이 갈 수 있어요?", "hallim", "bon", false, "hallim", true, "condition"],
  ["아니 한림관으로 변경할게요", "hyein", "gate", true, "hallim", true, "destination"],
  ["엘리베이터 말고 계단으로요", "hyein-301", "bon", true, "hyein-301", false, "condition"],
  ["그럼 휠체어로 가야 해요", "interview", "gate", false, "interview", true, "condition"],
  ["이제 본관으로 가고 싶어요", "munye", "parking", undefined, "bon", undefined, "destination"],
  ["아니 공모전 발표 장소로 바꿔 주세요", "interview", "gate", true, "contest-final", true, "destination"],
  ["거기까지 승강기 이용해서 가요", "facility-hallim-1", "bon", false, "facility-hallim-1", true, "condition"],
  ["아니다 우체국으로 갈래요", "facility-yudam-2", "hyein", undefined, "facility-yudam-3", undefined, "destination"],
  ["다음엔 어느 쪽으로 가요?", "hyein", "gate", undefined, "hyein", undefined, "next"],
  ["여기서 어디로 가야 해요?", "contest-final", "bus_stop_2115", true, "contest-final", true, "next"],
  ["그럼 목적지는 그대로 두고 엘리베이터로", "bon", "hyein", false, "bon", true, "condition"],
  ["본관 말고 혜인관에 가려고요", "bon", "gate", undefined, "hyein", undefined, "destination"],
  ["청운관으로 다시 안내해 줘", "yudam", "parking", undefined, "chungwoon", undefined, "destination"],
  ["계단으로 가는 길도 알려 줘", "room-yudam-529", "bon", true, "room-yudam-529", false, "condition"],
  ["한림관 대신 유담관으로 변경", "hallim", "gate", undefined, "yudam", undefined, "destination"],
  ["그럼 다리가 아파서 계단은 싫어요", "interview", "parking", false, "interview", true, "condition"],
  ["아니 301호 말고 혜인관 307호", "hyein-301", "bon", undefined, "hyein-307", undefined, "destination"],
  ["거기로 계단 타고 가면?", "facility-yudam-4", "gate", true, "facility-yudam-4", false, "condition"],
  ["이제 스콘스퀘어로 가요", "hyein", "bon", undefined, "스콘스퀘어", undefined, "destination"],
  ["그럼 짐이 많아서 엘리베이터 타고", "hallim", "gate", false, "hallim", true, "condition"],
  ["본관으로 목적지 변경할게요", "eunju1", "parking", true, "bon", true, "destination"],
  ["아니 신한은행이요", "facility-yudam-3", "hyein", undefined, "facility-yudam-2", undefined, "destination"],
  ["거기까지 엘리베이터 없이 가요", "yudam", "gate", true, "yudam", false, "condition"],
  ["다음 이동은 뭐예요?", "facility-chungwoon-3", "bon", undefined, "facility-chungwoon-3", undefined, "next"],
];

const ambiguous: Array<[string, string[]]> = [
  ["301호 가고 싶어요", room301],
  ["302호 수업 어디서 해요?", room302],
  ["시청각실을 찾아요", audio],
  ["편의점은 어디예요?", stores],
  ["카페 가고 싶어요", cafe],
  ["밥 먹을 곳 알려 줘", dining],
  ["제세동기 위치", ["facility-bukak-3", "facility-yudam-8", "facility-yudam-9", "facility-chungwoon-7", "facility-hyein-1"]],
  ["혜인관 시청각실 가야 해요", audio],
  ["근처 커피집 어디야?", cafe],
  ["점심을 먹으려면 어디로 가요?", dining],
  ["간식 사려면 편의점 어디 있나요", stores],
  ["강의실 301호 알려 주세요", room301],
  ["302호는 어느 건물이야?", room302],
  ["시청각실 중 한 곳으로 갈래요", audio],
  ["아메리카노 파는 곳 추천해 줘", cafe],
  ["매점이 어디에 있어요?", stores],
  ["학교 식당 가려고요", dining],
  ["AED 있는 데 알려 줘", ["facility-bukak-3", "facility-yudam-8", "facility-yudam-9", "facility-chungwoon-7", "facility-hyein-1"]],
  ["302호 강의실은 어느 건물인가요?", room302],
  ["커피 한 잔 할 곳", cafe],
  ["배고픈데 음식 파는 데", dining],
  ["어느 편의점으로 가면 돼요?", stores],
  ["시청각 수업 장소가 어디죠", audio],
  ["301호가 여러 개라는데 어디로?", room301],
  ["302호 건물부터 골라야 하나요?", room302],
];

const semantic: Array<[string, string[]]> = [
  ["헤인관으로 가고 싶어요", ["hyein"]],
  ["배고파요", dining],
  ["커피 마시고 싶어요", cafe],
  ["택배 부치려고요", ["facility-yudam-3"]],
  ["면접 보러 왔어요", ["interview"]],
  ["결선 발표 어디서 하죠?", ["contest-final"]],
  ["코워킹 스페이스 찾는 중", ["contest-final", "room-yudam-606"]],
  ["밥 먹을 데 있나요?", dining],
  ["카페인 충전하려고요", cafe],
  ["소포 보내는 곳", ["facility-yudam-3"]],
  ["수시 면접 대기 장소가 어디예요?", ["interview"]],
  ["본선 보러 왔는데 어디로 가요", ["contest-final"]],
  ["헤인 3층 301호", ["hyein-301"]],
  ["H04로 이동해야 해요", ["room-yudam-541"]],
  ["햄버거 파는 곳", ["facility-chungwoon-3"]],
  ["우동 먹으러 갈래", ["facility-chungwoon-4"]],
  ["은행 업무를 봐야 해요", ["facility-yudam-2"]],
  ["편지 부치러 왔어요", ["facility-yudam-3"]],
  ["아메리카노 마실래요", cafe],
  ["학식 어디서 먹지?", dining],
  ["문구를 사고 싶어요", ["facility-chungwoon-6"]],
  ["체육관 운동하러 가요", ["facility-suin-1"]],
  ["AED를 찾고 있어요", ["facility-bukak-3", "facility-yudam-8", "facility-yudam-9", "facility-chungwoon-7", "facility-hyein-1"]],
  ["차를 어디에 세우나요", ["parking"]],
  ["북악 편의점", ["facility-bukak-1"]],
  ["청운관 이마트는 어디죠", ["facility-chungwoon-1"]],
  ["유담 매점 가는 길", ["facility-yudam-5"]],
  ["스콘 광장으로 가요", ["스콘스퀘어"]],
  ["공모전 OT 장소 찾습니다", ["contest-final"]],
  ["입시 대기하러 왔어요", ["interview"]],
  ["카페 로렐에서 만나기로 했어요", ["facility-yudam-4"]],
  ["주차한 차 찾으러 P1 가요", ["parking"]],
  ["서점에서 공책 사려구요", ["facility-chungwoon-6"]],
  ["편의점에서 물 사야 해요", stores],
  ["점심시간인데 식당이 어딨어요", dining],
];

const outside: Array<[string, boolean]> = [
  ["강남역 가는 법", true],
  ["오늘 날씨는 어때요?", false],
  ["서울역까지 지하철 노선", true],
  ["내일 비가 오나요", false],
  ["없는관 301호로 안내해 줘", true],
  ["등록되지 않은 9999호 어디죠", true],
  ["롯데월드에 가고 싶어요", true],
  ["시청역 버스 타는 곳", true],
  ["환율 좀 알려 줘", false],
  ["점심 메뉴 추천해 줘", false],
  ["기말고사 날짜는 언제예요", false],
  ["서울시청까지 가는 길", true],
  ["국립중앙박물관 어디예요", true],
  ["노트북 고장 났어요", false],
  ["학사 일정 알려 주세요", false],
  ["지금 몇 시야?", false],
  ["에펠탑으로 길찾기", true],
  ["화성 캠퍼스 1호관", true],
  ["존재하지 않는 카페 별빛", true],
  ["오늘 주식 시세", false],
  ["12345호 수업실은 어디죠", true],
  ["학교 밖 우체국 어디 있어요", true],
  ["운동장 너머 없는 건물", true],
  ["그냥 궁금해서요", false],
  ["길", false],
];

export const evaluationCases: EvaluationCase[] = [
  ...simple.map(([query, id], index) => make(`S${String(index + 1).padStart(2, "0")}`, "단순 장소", query, [id])),
  ...compound.map(([query, startId, id, elevator], index) => make(`C${String(index + 1).padStart(2, "0")}`, "복합 질문", query, [id], { startId, elevator })),
  ...followups.map(([query, priorDestination, priorStart, priorElevator, destination, elevator, intent], index) => make(
    `F${String(index + 1).padStart(2, "0")}`, "후속 질문", query,
    destination ? [destination] : [], {
      intent, startId: priorStart, elevator, clarify: false,
      prior: {
        ...(priorStart ? { startPlaceId: priorStart } : {}),
        destinationPlaceId: priorDestination,
        ...(priorElevator !== undefined ? { elevator: priorElevator } : {}),
        candidateIds: [], pending: false,
      },
    },
  )),
  ...ambiguous.map(([query, ids], index) => make(`A${String(index + 1).padStart(2, "0")}`, "모호한 질문", query, ids)),
  ...semantic.map(([query, ids], index) => make(`M${String(index + 1).padStart(2, "0")}`, "의미·오타·별칭", query, ids)),
  ...outside.map(([query, unregistered], index) => make(`O${String(index + 1).padStart(2, "0")}`, "범위 밖·미등록", query, [], {
    intent: "outside", unregistered, clarify: false,
    note: unregistered ? "미등록 장소를 확정하면 실패" : "서비스 범위 밖이거나 목적지가 없음",
  })),
];
