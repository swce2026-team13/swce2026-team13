import test from "node:test";
import assert from "node:assert/strict";
import { places, searchPlaces } from "../lib/catalog.ts";
import { classroomFloors, classroomSearch } from "../lib/classrooms.ts";
import { calculateRoute } from "../lib/routing.ts";
import { allPlaces, findPlace, roomPlaces } from "../lib/rooms.ts";
import { loadRooms } from "../lib/campus3d/types.ts";
import { geminiCatalog } from "../lib/gemini.ts";
import { Store } from "../lib/store.ts";

const rooms = roomPlaces();
const search = (query: string) =>
  searchPlaces(query, undefined, undefined, allPlaces());
const floors = (building: string) =>
  classroomFloors(building, [...places, ...rooms]);

test("호실 변환은 강의실 용도이고 층이 있는 호실만 넣음", () => {
  const uses = new Set(rooms.map((p) => p.description));
  assert.deepEqual(
    [...uses].sort(),
    ["강의실", "멀티미디어강의실", "실험실습실"].sort(),
  );
  assert.ok(rooms.every((p) => p.category === "classroom" && p.floor));
  const skipped = loadRooms().filter(
    (r) => r.use === "실험실습실" && !r.floor,
  );
  for (const r of skipped)
    assert.ok(!rooms.some((p) => p.id === `room-${r.buildingId}-${r.number}`));
});

test("호실 id는 room-건물ID-호수 형식이고 겹치지 않음", () => {
  assert.ok(rooms.every((p) => /^room-[a-z0-9]+-\S+$/.test(p.id)));
  assert.equal(new Set(rooms.map((p) => p.id)).size, rooms.length);
  const h04 = rooms.find((p) => p.id === "room-yudam-541")!;
  assert.equal(h04.name, "541호 H04");
  assert.equal(h04.floor, "5층");
  assert.deepEqual(h04.aliases, ["541", "유담관 541", "H04", "유담관 H04"]);
  assert.equal(h04.verified, true);
  assert.equal(h04.source, "학교 캠퍼스맵");
  assert.equal(rooms.find((p) => p.id === "room-hyein-306")?.name, "306호 강의실");
});

test("호실 이름에 '교수'가 들어간 것이 없음", () => {
  assert.ok(rooms.every((p) => !p.name.includes("교수")));
  assert.ok(rooms.every((p) => p.aliases.every((a) => !a.includes("교수"))));
});

test("혜인관 기존 강의실 11곳과 겹치는 호실은 넣지 않음", () => {
  const hyein = places.filter(
    (p) => p.building === "혜인관" && p.category === "classroom",
  );
  assert.equal(hyein.length, 11);
  const added = rooms.filter((p) => p.building === "혜인관");
  for (const number of ["301", "302", "303", "304", "305", "307", "311"])
    assert.ok(!added.some((p) => p.number === number), number);
  assert.ok(!added.some((p) => p.name.includes("시청각")));
  for (const p of hyein) assert.equal(findPlace(p.id), p);
});

test("유담관 5층 목록에 541호 H04가 있음", () => {
  const fifth = floors("유담관").find((f) => f.floor === "5층")!;
  assert.ok(fifth.rooms.some((p) => p.name === "541호 H04"));
});

test("문예관 L층은 3층 자리에 나옴", () => {
  const names = floors("문예관").map((f) => f.floor);
  assert.deepEqual(names.slice(0, 4), ["1층", "2층", "L층", "5층"]);
  assert.ok(floors("문예관").find((f) => f.floor === "L층")!.rooms.length > 0);
});

test("넣을 호실이 없는 건물은 빈 목록", () => {
  for (const building of ["한림관", "청운관", "상승관", "크리에이티브센터"])
    assert.deepEqual(floors(building), [], building);
  for (const building of ["유담관", "북악관", "문예관", "대일관", "은주1관", "은주2관", "본관", "수인관"])
    assert.ok(floors(building).some((f) => f.rooms.length), building);
});

test("H04 검색 첫 결과는 유담관 541호", () => {
  assert.equal(search("H04")[0]?.id, "room-yudam-541");
  assert.equal(search("유담관 H04")[0]?.id, "room-yudam-541");
  assert.equal(search("529호")[0]?.id, "room-yudam-529");
});

test("H02 검색 첫 결과는 유담관 5층 533호", () => {
  const result = search("H02");
  assert.equal(result[0]?.id, "room-yudam-533");
  assert.ok(result.some((p) => p.id === "room-yudam-1102"));
});

test("검색 화면은 호실 이름으로 그 호실을 고름", () => {
  const h04 = classroomSearch("H04", search("H04"));
  assert.equal(h04.room?.id, "room-yudam-541");
  assert.equal(h04.selectedBuilding?.id, "yudam");
  assert.equal(classroomSearch("529호", search("529호")).room?.id, "room-yudam-529");
  assert.equal(
    classroomSearch("헤인관 301호", search("헤인관 301호")).room?.id,
    "hyein-301",
  );
});

test("호실 id로 경로를 요청하면 장소로 인정하고 확인 전 연결까지 써서 길을 찾음", () => {
  const route = calculateRoute("bus_stop_2115", "room-yudam-541", true, allPlaces());
  assert.equal(route.options[0].unverified, true);
  assert.equal(route.options[0].nodes.at(-1), "yudam|5");
  const store = new Store(":memory:");
  const session = store.create("owner", "bus_stop_2115", "room-yudam-541", true);
  assert.equal(session.destination, "room-yudam-541");
  store.close();
});

test("고른 호실은 id로 다시 찾아도 같은 이름", () => {
  const room = findPlace("room-yudam-541");
  assert.equal(room?.name, "541호 H04");
  assert.equal(room?.building, "유담관");
  assert.equal(findPlace("room-yudam-0000"), undefined);
});

test("Gemini에 보내는 장소 목록은 호실을 넣기 전과 같은 개수", () => {
  assert.equal(geminiCatalog.length, places.length);
  assert.ok(geminiCatalog.every((p) => !p.id.startsWith("room-")));
});
