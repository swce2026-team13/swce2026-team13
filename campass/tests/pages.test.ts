import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { navigationHref } from "../lib/navigation.ts";

test("새 목적지 이동에서 이전 세션의 위치 복구 모드 해제", () => {
  for (const next of ["prepare", "guide", "search"] as const) {
    const url = new URL(
      navigationHref(next, { recovering: "true" }),
      "http://localhost",
    );
    assert.notEqual(url.searchParams.get("recovering"), "true");
  }
});

test("사진 재촬영의 복구 상태와 한글 검색어 보존", () => {
  const photo = new URL(
    navigationHref("photo", { recovering: "true" }),
    "http://localhost",
  );
  assert.equal(photo.searchParams.get("recovering"), "true");
  const search = new URL(
    navigationHref("search", { q: "혜인관 301호" }),
    "http://localhost",
  );
  assert.equal(search.pathname, "/search");
  assert.equal(search.searchParams.get("q"), "혜인관 301호");
  assert.equal(navigationHref("home", { recovering: "true" }), "/");
});

const pages = [
  "",
  "search",
  "directions",
  "directions/photo",
  "directions/recognition",
  "directions/failed",
  "directions/recovery",
  "guide",
  "guide/arrival",
  "guide/map",
  "map",
  "map/places",
  "help",
  "admin",
];

test("모든 화면에 직접 접속 가능한 App Router 페이지 제공", () => {
  for (const page of pages) {
    assert.ok(
      existsSync(`app/${page ? `${page}/` : ""}page.tsx`),
      `페이지 누락: /${page}`,
    );
  }
});

test("모달 직접 접속과 일반 이동의 슬롯 초기화 지원", () => {
  for (const page of [
    "default.tsx",
    "page.tsx",
    "[...catchAll]/page.tsx",
    "(.)help/page.tsx",
    "(.)map/page.tsx",
    "(.)map/places/page.tsx",
    "(.)guide/map/page.tsx",
  ]) {
    assert.ok(existsSync(`app/@modal/${page}`), `슬롯 누락: ${page}`);
  }
});

test("공통 레이아웃에서 페이지와 모달 연결", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /\{modal\}/);
  assert.match(layout, /CampusProvider/);
});
