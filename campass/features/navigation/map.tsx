"use client";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { CampusMap, Notice, Tag } from "@/components/ui";
import { useCampus } from "@/features/navigation/campus-provider";
import { buildingRoute, selectRouteBuilding } from "@/shared/utils/map-route";
import { sources } from "@/shared/utils/catalog";

export default function Screen() {
  const { begin, busy } = useCampus();
  const [selected, setSelected] = useState<string[]>([]);
  let preview: ReturnType<typeof buildingRoute> | null = null;
  let message = "";
  if (selected.length === 2) {
    try {
      preview = buildingRoute(selected);
    } catch (error) {
      message =
        error instanceof Error ? error.message : "경로를 확인하지 못했어요.";
    }
  }
  return (
    <section className="content stack">
      <div>
        <h1>어디로 가세요?</h1>
        <p>출발할 건물을 먼저 누르고, 갈 건물을 이어서 눌러 주세요.</p>
      </div>
      <div className="card stack" aria-live="polite">
        <div className="between">
          <strong>고른 건물</strong>
          <button
            className="text-button"
            disabled={busy || !selected.length}
            onClick={() => setSelected([])}
          >
            <RotateCcw size={14} /> 다시 선택
          </button>
        </div>
        {(["출발", "도착"] as const).map((label, index) => (
          <div className="between" key={label}>
            <div className="row">
              <Tag tone={index === 0 ? "green" : "blue"}>{label}</Tag>
              <strong>
                {selected[index] || `${label} 건물을 선택해 주세요`}
              </strong>
            </div>
            {selected[index] && (
              <Check size={17} className="blue-text" aria-label="선택 완료" />
            )}
          </div>
        ))}
      </div>
      <CampusMap
        selectedBuildings={selected}
        onBuilding={(name) => {
          if (!busy)
            setSelected((current) => selectRouteBuilding(current, name));
        }}
      />
      <p className="small muted">파랑 · 출발 건물　빨강 · 도착 건물</p>
      {preview && (
        <div className="card stack">
          <div className="between">
            <strong>{selected.join(" → ")}</strong>
            <Tag>{preview.route.steps.length}단계</Tag>
          </div>
          <ol className="stack" aria-label="안내 경로">
            {preview.route.steps.map((step, index) => (
              <li key={step.id}>
                {index + 1}. {step.name}
              </li>
            ))}
          </ol>
          <p className="small muted">
            약 {preview.route.distance}m · {preview.route.minutes}분 · 시연 경로
          </p>
        </div>
      )}
      {message && (
        <div role="alert">
          <Notice>{message}</Notice>
        </div>
      )}
      <p className="small muted">
        {preview
          ? "선택한 출발 건물부터 사진 안내를 시작해요. 지도는 건물 위치 미리보기이며, 실제 보행 동선은 현장 확인이 필요해요."
          : "현재 본관 ↔ 혜인관의 시연 안내 경로를 이용할 수 있어요."}
      </p>
      <button
        className="button primary"
        disabled={!preview || busy}
        onClick={() => {
          if (preview)
            void begin({
              start: preview.start,
              destination: preview.destination,
            });
        }}
      >
        {busy ? "안내 준비 중…" : "바로 안내 시작"}
      </button>
      <a
        className="text-button centered"
        href={sources.map}
        target="_blank"
        rel="noreferrer"
      >
        서경대학교 공식 캠퍼스맵 ↗
      </a>
    </section>
  );
}
