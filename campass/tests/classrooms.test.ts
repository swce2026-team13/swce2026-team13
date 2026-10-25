import test from "node:test";
import assert from "node:assert/strict";
import { places, searchPlaces } from "../shared/utils/catalog.ts";
import {
  classroomSearch,
  roomsOnFloor,
  digitsOnly,
} from "../shared/utils/classrooms.ts";

test("classroom category shows buildings instead of individual rooms", () => {
  const result = classroomSearch(
    "",
    places.filter((p) => p.category === "classroom"),
    "classroom",
  );
  assert.equal(result.candidates.length, 12);
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
