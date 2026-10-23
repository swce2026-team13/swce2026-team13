import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 피그마 아이콘으로 바꾼 lucide 아이콘
const replaced = [
  "ArrowLeft",
  "X",
  "ArrowRight",
  "Building2",
  "Camera",
  "Check",
  "CheckCircle2",
  "ChevronDown",
  "ChevronRight",
  "Coffee",
  "Map",
  "MessageSquareText",
  "Search",
];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("피그마 아이콘으로 바꾼 lucide 아이콘을 가져오는 파일이 없음", () => {
  const files = ["app", "components", "lib"].flatMap(sources);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g)) {
      const names = match[1].split(",").map((name) => name.trim().split(/\s+as\s+/)[0]);
      const left = names.filter((name) => replaced.includes(name));
      assert.deepEqual(left, [], file);
    }
  }
});
