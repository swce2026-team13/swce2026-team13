import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { calculateRoute } from "../shared/utils/routing.ts";
import { allPlaces } from "../server/services/rooms.ts";
import { Store } from "../server/db/store.ts";
import {
  guideLegLabel,
  toGuideMapData,
  toGuideViewModel,
} from "../shared/utils/guide-view.ts";
import { searchPlaces } from "../shared/utils/catalog.ts";
import {
  overviewLinkPair,
  overviewLinks,
  overviewRouteHighlight,
} from "../shared/utils/campus-overview.ts";
import { campusLinks } from "../shared/utils/campus3d/types.ts";

test("공모전 발표는 검색되고, 2115에서 엘리베이터로 본관 1층 → 유담관 8층 → L층으로 가요", () => {
  for (const q of ["공모전", "결선"])
    assert.equal(
      searchPlaces(q, undefined, undefined, allPlaces())[0]?.id,
      "contest-final",
    );
  const route = calculateRoute("bus_stop_2115", "contest-final", true, allPlaces());
  const option = route.options[0];
  assert.deepEqual(option.nodes, ["bus_stop_2115", "bon|1", "yudam|8", "yudam|6"]);
  assert.ok(!option.unverified);
  // 미리보기 지도는 지금 단계 없이 경로 전체만 가짐
  const map = toGuideMapData(option);
  assert.deepEqual(map.current, {});
  assert.equal(map.unverified, false);
});

test("2115에서 면접 대기실까지 모든 단계가 실제 노드와 건물 단계 번호를 갖는다", () => {
  const route = calculateRoute("bus_stop_2115", "interview", true, allPlaces());
  assert.deepEqual(
    route.steps.map(({ node, leg }) => [node, leg]),
    [
      ["bus_stop_2115", 0],
      ["bon|1", 0],
      ["bon|1", 0],
      ["bon|1", 0],
      ["bon|5", 0],
      ["hallim|3", 1],
      ["hallim|3", 1],
      ["hallim|6", 1],
      ["hallim|6", 1],
      ["eunju1|5", 2],
      ["스콘스퀘어", 2],
      ["hyein|1", 3],
      ["hyein|2", 3],
    ],
  );
  assert.equal(
    route.steps.find((step) => step.id === "to_hallim")?.link,
    "bon-5__hallim-3",
  );
  assert.equal(
    route.steps.find((step) => step.id === "hallim_6f_corridor")?.link,
    "hallim-6__eunju1-5",
  );
});

test("위치 정보를 제외한 경로 후보와 단계 순서·문구·개수는 변경 전과 같다", () => {
  const cases = [
    [
  "bus_stop_2115",
  "interview",
  true,
  "a71f788ebbe1f69b87cbc9cfd4f1b98fe38b603bad52965428834e1ea4428fb1",
],
[
  "bus_stop_2115",
  "interview",
  false,
  "53514961759da1d02abc393023b7838edf94464bd7078bb69c59eb97e1aef368",
],
[
  "yudam",
  "hyein",
  true,
  "87ca6c6397041c6f4e51fc10cf5e7a6970dd6457f8df98fd2b6ea78a5d92db1b",
],
[
  "gate",
  "interview",
  false,
  "574bef14119c8cf8d85c85eb6413bcd52d2d40d475659914bae3cf3fb5994939",
],
[
  "to_hallim",
  "interview",
  true,
  "e1d12343f9fe7842f6ceb0b15a465629a3cd41d6dbd1b857f24c9387ecf1b193",
],
[
  "hallim_6f_corridor",
  "interview",
  true,
  "0315e599cf36cacaede3375c6cccb7c88dae2243e4af00ad06026a27fff9aebf",
],
  ] as const;
  for (const [start, destination, elevator, expected] of cases) {
    const route = calculateRoute(start, destination, elevator, allPlaces());
    // 지도에서 안 쓰게 된 예전 좌표(x, y, stage)도 빼고 비교
    const before = JSON.stringify(route, (key, value) =>
  ["node", "link", "leg", "x", "y", "stage"].includes(key)
    ? undefined
    : value,
);
    assert.equal(
      createHash("sha256").update(before).digest("hex"),
      expected,
      start,
    );
  }
});

test("안내 지도는 선택한 후보와 현재 단계의 위치 정보를 사용한다", () => {
  const store = new Store(":memory:");
  try {
    const session = store.create("검증", "bus_stop_2115", "interview", false);
    const option = session.route.options.at(-1)!;
    session.route.option = option.id;
    session.route.steps = option.steps;
    session.currentStep = option.steps.findIndex((step) => step.link);
    assert.ok(session.currentStep >= 0);
    const step = option.steps[session.currentStep];
    const guide = toGuideViewModel(session);
    assert.deepEqual(guide.map, {
      nodes: option.nodes,
      links: option.links,
      legs: option.legs,
      current: { node: step.node, link: step.link, leg: step.leg },
      unverified: Boolean(option.unverified),
    });
    assert.equal(guide.legLabel, guideLegLabel(guide.map!));
    session.route.option = "없는 후보";
    assert.deepEqual(
      toGuideViewModel(session).map?.nodes,
      session.route.options[0].nodes,
    );
  } finally {
    store.db.close();
  }
});

test("건물 단계 글자는 실제 건물과 층을 표시하고 예전 세션은 위치 없이도 열린다", () => {
  const store = new Store(":memory:");
  try {
    const session = store.create("검증", "bus_stop_2115", "interview", true);
    assert.equal(toGuideViewModel(session).legLabel, "본관 1층 → 5층 · 1/4");
    for (const step of session.route.steps) {
      delete step.node;
      delete step.link;
      delete step.leg;
    }
    const guide = toGuideViewModel(session);
    assert.deepEqual(guide.map?.current, {});
    assert.equal(guide.legLabel, "");
    session.route.options = [];
    assert.equal(toGuideViewModel(session).map, null);
    assert.equal(toGuideViewModel(null).map, null);
  } finally {
    store.db.close();
  }
});

test("층이 다른 연결도 같은 건물 쌍으로 강조하고 지하주차장은 광장에 표시한다", () => {
  const links = campusLinks();
  const hidden = links.find(
    (link) =>
      !overviewLinks.some((line) => line.id === link.id) &&
      overviewLinks.some(
        (line) => overviewLinkPair(line.id) === overviewLinkPair(link.id),
      ),
  );
  assert.ok(hidden);
  const highlight = overviewRouteHighlight({
    nodes: ["bus_stop_2115", "gate_main", "bon|1", "지하주차장"],
    links: [hidden.id, "bon|1>bon|5", "bus_stop_2115>bon|1"],
    legs: [],
    current: { node: "지하주차장", link: hidden.id },
    unverified: true,
  });
  assert.ok(highlight.areas.has("bon"));
  assert.ok(highlight.areas.has("스콘스퀘어"));
  assert.equal(highlight.currentArea, "스콘스퀘어");
  assert.ok(highlight.markers.has("bus_stop_2115"));
  assert.ok(highlight.markers.has("gate_main"));
  assert.ok(highlight.markers.has("parking_entrance_1"));
  assert.equal(highlight.currentMarker, "parking_entrance_1");
  assert.equal(highlight.pairs.size, 1);
  assert.ok(
    overviewLinks.some(
      (line) => overviewLinkPair(line.id) === highlight.currentPair,
    ),
  );
});

test("다른 목적지와 후보도 단계 위치가 경로 안에 있고 건물 순서를 거스르지 않는다", () => {
  for (const [start, destination] of [
    ["bus_stop_2115", "facility-yudam-4"],
    ["yudam", "hyein"],
    ["gate", "interview"],
    ["parking", "interview"],
  ]) {
    for (const option of calculateRoute(start, destination, true, allPlaces())
      .options) {
      let previous = 0;
      for (const step of option.steps) {
        assert.ok(step.node && option.nodes.includes(step.node));
        assert.ok(
          step.leg !== undefined &&
            step.leg >= previous &&
            step.leg < option.legs.length,
        );
        previous = step.leg;
        if (step.link)
          assert.ok(campusLinks().some((link) => link.id === step.link));
      }
    }
  }
});
