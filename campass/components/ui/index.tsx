"use client";
import Image from "next/image";
import { ArrowUp, ArrowUpRight, CornerUpLeft, Camera } from "lucide-react";
export { CampusMap } from "../../features/navigation/campus-map";
export function Tag({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function Notice({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
export function Progress({
  current,
  total,
  done = false,
}: {
  current: number;
  total: number;
  done?: boolean;
}) {
  return (
    <div className={`progress ${done ? "done" : ""}`}>
      <div>
        <b>
          {current} / {total} 단계
        </b>
        <span>{done ? "안내 완료" : "사진으로 단계 확인"}</span>
      </div>
      <progress aria-label="안내 진행률" max={total} value={current} />
    </div>
  );
}
export function Photo({
  src = "corridor",
  uploaded,
  direction,
  label = "등록 사진 · 예시 사진",
}: {
  src?: string;
  uploaded?: string;
  direction?: string;
  label?: string;
}) {
  return (
    <div className="photo">
      <Image
        src={uploaded || `/images/${src}.jpg`}
        alt={
          uploaded
            ? "선택한 주변 사진"
            : src === "bus"
              ? "정류장 예시 사진"
              : "복도 예시 사진"
        }
        width={700}
        height={484}
        unoptimized={Boolean(uploaded)}
        priority
      />
      <span className="photo-label">{label}</span>
      {direction && (
        <div className={`direction ${direction === "backward" ? "turn" : ""}`}>
          {direction === "backward" ? (
            <CornerUpLeft />
          ) : direction === "right" ? (
            <ArrowUpRight />
          ) : (
            <ArrowUp />
          )}
        </div>
      )}
    </div>
  );
}
export function Upload({
  onFile,
  busy,
  label = "사진 촬영 · 업로드",
}: {
  onFile: (file: File) => void;
  busy: boolean;
  label?: string;
}) {
  return (
    <label className={`button secondary upload ${busy ? "disabled" : ""}`}>
      <Camera size={20} />
      {busy ? "사진 확인 중…" : label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
