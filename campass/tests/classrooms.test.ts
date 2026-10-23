import test from "node:test";
import assert from "node:assert/strict";
import { places, searchPlaces } from "../lib/catalog.ts";
import {
  classroomFloors,
  classroomSearch,
  roomsOnFloor,
  digitsOnly,
} from "../lib/classrooms.ts";

test("classroom category shows buildings instead of individual rooms", () => {
  const result = classroomSearch(
    "",
    places.filter((p) => p.category === "classroom"),
    "classroom",
  );
  assert.equal(result.candidates.length, 13);
  assert.ok(result.candidates.every((p) => p.category === "building"));
  assert.equal(result.selectedBuilding, undefined);
});

test("building and room query opens matching room, without unrelated rooms", () => {
  const result = classroomSearch("헤인관 301호", searchPlaces("헤인관 301호"));
  assert.deepEqual(
    result.candidates.map((p) => p.id),
    ["hyein"],
  );
  assert.equal(result.selectedBuilding?.id, "hyein");
  assert.equal(result.room?.id, "hyein-301");
  assert.equal(
    classroomSearch("혜인관 999호", searchPlaces("혜인관 999호")).room,
    undefined,
  );
});

test("broad search groups classrooms; explicit building category keeps direct navigation", () => {
  const result = classroomSearch("혜인관", searchPlaces("혜인관"));
  assert.equal(result.candidates.filter((p) => p.id === "hyein").length, 1);
  assert.ok(result.candidates.every((p) => p.category !== "classroom"));
  assert.ok(result.pickerBuildingIds.includes("hyein"));
  assert.deepEqual(
    classroomSearch(
      "",
      places.filter((p) => p.category === "building"),
      "building",
    ).pickerBuildingIds,
    [],
  );
});

test("floor input accepts digits and floor filter distinguishes basement", () => {
  assert.equal(digitsOnly("-3층e.한2"), "32");
  assert.equal(roomsOnFloor("혜인관", "3", false).length, 7);
  assert.equal(roomsOnFloor("혜인관", "1", true).length, 4);
  assert.equal(roomsOnFloor("혜인관", "", false).length, 0);
  assert.equal(roomsOnFloor("본관", "3", false).length, 0);
});

test("분류 목록은 등록 강의실만 보여 주고 나머지 층과 건물은 준비 중", () => {
  const floors = classroomFloors("혜인관");
  assert.deepEqual(
    floors.map((f) => [f.floor, f.rooms.length]),
    [
      ["지하 1층", 4],
      ["1층", 0],
      ["2층", 0],
      ["3층", 7],
    ],
  );
  assert.ok(
    floors.every((f) => f.rooms.every((p) => p.category === "classroom")),
  );
  assert.deepEqual(classroomFloors("본관"), []);
  assert.deepEqual(classroomFloors("은주1관"), []);
});
