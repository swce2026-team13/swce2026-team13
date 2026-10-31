import test from "node:test";
import assert from "node:assert/strict";
import {
  navigationHref,
  legacyPlacesHref,
  screenTitle,
} from "../shared/utils/navigation.ts";
import {
  routeRequestState,
  routeRecoveryAction,
} from "../shared/utils/directions-state.ts";
import { mapPickLocations } from "../shared/utils/map-pick.ts";
import { routeChips } from "../shared/utils/route-summary.ts";
import { routeModeLabel } from "../shared/utils/route-presentation.ts";
import { placeRouteBadge } from "../shared/utils/map-labels.ts";
import { calculateRoute } from "../shared/utils/routing.ts";
import { places } from "../shared/utils/catalog.ts";

test("바로 찾기는 이전 경로와 옵션을 주소에 남기지 않는다", () => {
  const url = new URL(
    navigationHref("find", {
      tab: "classroom",
      building: "혜인관",
      destination: "hyein",
      start: "bus_stop_2115",
      elevator: "true",
      option: "old",
      recovering: "true",
    }),
    "http://localhost",
  );
  assert.deepEqual([...url.searchParams.keys()], ["tab", "building"]);
  assert.equal(
    navigationHref("help", {
      destination: "hyein",
      start: "gate",
      elevator: "true",
    }),
    "/help",
  );
});
test("모든 옛 층별 장소 주소는 선택한 건물 상세로 연결", () => {
  for (const p of places.filter((p) => p.category === "building")) {
    for (const value of [p.name, p.id]) {
      const url = new URL(legacyPlacesHref(value), "http://localhost");
      assert.equal(url.pathname, "/find");
      assert.equal(url.searchParams.get("building"), p.name);
      assert.equal(url.searchParams.get("tab"), "classroom");
    }
  }
  assert.equal(legacyPlacesHref("unknown"), "/find?tab=classroom");
});
test("현재 요청이 끝나기 전에는 이전 성공·실패 상태를 쓰지 않는다", () => {
  assert.equal(
    routeRequestState("new", { key: "old", status: "failed" }, true),
    "loading",
  );
  assert.equal(
    routeRequestState("new", { key: "old", status: "ready" }, true),
    "loading",
  );
  assert.equal(
    routeRequestState("new", { key: "new", status: "failed" }, true),
    "failed",
  );
  assert.equal(
    routeRequestState("new", { key: "new", status: "ready" }, true),
    "ready",
  );
  assert.equal(
    routeRequestState("new", { key: "new", status: "failed" }, false),
    "inactive",
  );
});
test("복구 사진 제목과 안내 건물 이름을 중복 없이 표시", () => {
  const hyein = places.find((p) => p.id === "hyein")!;
  assert.equal(screenTitle("photo", hyein, true), "현재 위치 찍기");
  assert.equal(screenTitle("photo", hyein, false), "출발 위치 찍기");
  assert.equal(screenTitle("guide", hyein, false), "혜인관");
});
test("계단으로만 갈 수 있는 목적지는 엘리베이터를 끄는 복구 동작을 제공", () => {
  assert.throws(
    () => calculateRoute("bus_stop_2115", "chungwoon|3", true),
    (error: unknown) => {
      assert.ok(error instanceof Error && "code" in error);
      const request = {
        key: "current",
        status: "failed" as const,
        errorCode: String(error.code),
      };
      assert.equal(
        routeRecoveryAction("current", request, true),
        "disable-elevator",
      );
      assert.equal(routeRecoveryAction("next", request, true), null);
      assert.equal(routeRecoveryAction("current", request, false), null);
      return true;
    },
  );
  assert.ok(
    calculateRoute("bus_stop_2115", "chungwoon|3", false).options.length,
  );
  assert.equal(
    routeRecoveryAction(
      "current",
      { key: "current", status: "failed", errorCode: "ROUTE_UNAVAILABLE" },
      true,
    ),
    "change-destination",
  );
});
test("직접 고르기와 지도는 같은 다섯 입구 이름을 사용", () => {
  assert.deepEqual(
    mapPickLocations.map((p) => p.label).sort(),
    ["정문", "1주차장", "2주차장", "2115번 정류장", "서문(후문)"].sort(),
  );
});
test("외부 계단 분류와 이동 방식 칩은 서로 모순되지 않는다", () => {
  const options = calculateRoute("bus_stop_2115", "hyein", false).options;
  const hill = options.find((o) => o.hillMode === "hill")!;
  const stairs = options.find((o) => o.hillMode === "stairs")!;
  const lift = options.find((o) => o.hillMode === "elevator")!;
  assert.equal(routeModeLabel(stairs), "실외 길 (계단길)");
  assert.ok(routeChips(hill).includes("현장 확인 전"));
  assert.ok(routeChips(stairs).includes("실외 길"));
  assert.ok(!routeChips(stairs).includes("실내 위주"));
  assert.ok(routeChips(lift).includes("엘리베이터"));
  assert.ok(!routeChips(lift).includes("실외 길"));
});
test("도착 알약은 건물 이름 영역과 지도 경계를 피한다", () => {
  const box = { left: 60, right: 140, top: 80, bottom: 100 };
  const badge = placeRouteBadge([100, 90], 52, 28, [box], {
    left: 0,
    right: 240,
    top: 0,
    bottom: 220,
  });
  assert.ok(
    badge[0] + 26 <= box.left ||
      badge[0] - 26 >= box.right ||
      badge[1] + 14 <= box.top ||
      badge[1] - 14 >= box.bottom,
  );
  assert.ok(
    badge[0] >= 26 && badge[0] <= 214 && badge[1] >= 14 && badge[1] <= 206,
  );
});

test("바로 찾기의 편의시설 종류·건물 필터는 계속 유지", () => {
  const url = new URL(
    navigationHref("find", {
      tab: "facility",
      kind: "cafe",
      area: "혜인관",
      destination: "hyein",
      start: "gate",
      elevator: "false",
    }),
    "http://localhost",
  );
  assert.equal(url.searchParams.get("kind"), "cafe");
  assert.equal(url.searchParams.get("area"), "혜인관");
  assert.equal(url.searchParams.get("destination"), null);
});
