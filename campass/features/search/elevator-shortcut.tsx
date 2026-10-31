"use client";
import { useMemo, useState } from "react";
import { ChevronDownIcon, SwapIcon } from "@/components/ui/icons";
import { ElevatorSectionCard } from "@/features/navigation/elevator-section-card";
import { elevatorSection, elevatorShortcutAreas } from "@/shared/utils/elevator-shortcut";

// 자주 찾는 길. 지금 데이터에 없는 곳이 섞이면 보여 주지 않음
const frequent: [string, string][] = [
  ["bus_stop_2115", "hyein"],
  ["bon", "eunju1"],
  ["hallim", "hyein"],
];

export function ElevatorShortcut({
  busy,
  onStart,
}: {
  busy: boolean;
  onStart: (start: string, destination: string) => void;
}) {
  const { areas } = useMemo(() => elevatorShortcutAreas(), []);
  const destinations = areas.filter((a) => !a.startOnly);
  const pick = (id: string, fallback: number) =>
    areas.some((a) => a.id === id) ? id : destinations[fallback]?.id ?? "";
  const [start, setStart] = useState(() => pick("bon", 0));
  const [destination, setDestination] = useState(() => pick("hyein", destinations.length - 1));
  const [shown, setShown] = useState(false);
  const section = shown ? elevatorSection(start, destination) : undefined;
  const name = (id: string) => areas.find((a) => a.id === id)?.name ?? id;
  const canSwap = !areas.find((a) => a.id === start)?.startOnly;

  if (!areas.length) return null;
  if (section)
    return (
      <ElevatorSectionCard
        section={section}
        busy={busy}
        onStart={() => onStart(start, destination)}
        onReverse={canSwap ? () => { setStart(destination); setDestination(start); } : undefined}
        onPickAgain={() => setShown(false)}
      />
    );

  return (
    <div className="card elevator-shortcut">
      <strong>엘리베이터 길 찾기</strong>
      <div className="elevator-shortcut-fields">
        <label>
          <span>출발 건물</span>
          <span className="select-wrap">
            <select value={start} onChange={(e) => setStart(e.target.value)}>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <ChevronDownIcon size={14} />
          </span>
        </label>
        <button
          type="button"
          className="elevator-shortcut-swap"
          aria-label="출발과 도착 바꾸기"
          disabled={!canSwap}
          onClick={() => { setStart(destination); setDestination(start); }}
        >
          <SwapIcon size={18} />
        </button>
        <label>
          <span>도착 건물</span>
          <span className="select-wrap">
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              {destinations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <ChevronDownIcon size={14} />
          </span>
        </label>
      </div>

      <span className="elevator-shortcut-label">자주 찾는 길</span>
      <div className="chips elevator-shortcut-frequent">
        {frequent.filter(([a, b]) => areas.some((x) => x.id === a) && destinations.some((x) => x.id === b))
          .map(([a, b]) => (
            <button
              key={`${a}-${b}`}
              type="button"
              onClick={() => { setStart(a); setDestination(b); setShown(true); }}
            >
              {a === "bus_stop_2115" ? "정류장" : name(a)} {a === "bus_stop_2115" ? "→" : "↔"} {name(b)}
            </button>
          ))}
      </div>

      {start === destination && <p className="muted small">출발과 도착을 다르게 골라 주세요.</p>}
      <button
        type="button"
        className="button primary"
        disabled={start === destination}
        onClick={() => setShown(true)}
      >
        단면도로 길 보기
      </button>
    </div>
  );
}
