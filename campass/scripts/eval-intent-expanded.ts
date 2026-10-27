import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { campus } from "../lib/catalog.ts";
import { askGemini } from "../lib/gemini.ts";
import { evaluationCases } from "./intent-eval-cases.ts";
import { evaluateCases, summarize, type EvaluationMode } from "./intent-eval-core.ts";

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
if (live && (!args.has("--allow-paid-calls") || !process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL))
  throw new Error("실제 모델 평가는 --live --allow-paid-calls와 API 설정이 모두 필요해요.");
const modes: EvaluationMode[] = live ? ["live"] : args.has("--keyword-only") ? ["keyword"] : args.has("--mock-only") ? ["mock"] : ["keyword", "mock"];
const results = [];
for (const mode of modes) {
  const rows = await evaluateCases(mode, evaluationCases, mode === "live" ? askGemini : undefined);
  const summary = summarize(rows);
  results.push({ mode, summary, rows });
  console.log(`${mode}: 전체 ${summary.count}건, 전체 슬롯 ${summary.full.correct}/${summary.full.total}, 의도 ${summary.intent.correct}/${summary.intent.total}, 모델 호출 ${summary.calls}건, 폴백 ${summary.fallback}건, 오류 ${summary.errors}건`);
  console.log(`유형별: ${Object.entries(summary.byCategory).map(([category, value]) => `${category} ${value.correct}/${value.total}`).join(" · ")}`);
  console.log(`지연 시간: p50 ${summary.latency.p50?.toFixed(1) ?? "-"}ms · p95 ${summary.latency.p95?.toFixed(1) ?? "-"}ms`);
}
if (args.has("--write-results")) {
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const file = resolve("reports", `intent-evaluation-${date}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({
    source: "작성된 시뮬레이션",
    measuredAt: new Date().toISOString(),
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    nodeVersion: process.version,
    catalogCheckedAt: campus.checkedAt,
    modes: results,
    modelUsage: null,
    estimatedCost: null,
  }, null, 2) + "\n");
  console.log(`결과 저장: ${file}`);
}
