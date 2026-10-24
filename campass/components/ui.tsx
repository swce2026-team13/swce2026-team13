"use client";
import Image from "next/image";
import {
  ArrowUp,
  ArrowUpRight,
  CornerUpLeft,
  Minus,
  Plus,
} from "lucide-react";
import { CameraIcon } from "@/components/icons";
import { useState } from "react";
import type { Route } from "@/lib/routing";
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
      {/* 사진 안내 지점이 없는 글자 단계는 사진 없이 보여 줌 */}
      {!uploaded && !src ? (
        <div className="photo-empty" />
      ) : (
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
      )}
      <span className="photo-label">{label}</span>
      {direction && (
        <div className={`direction ${direction === "backward" ? "turn" : ""}`}>
          {direction === "backward" ? (
            <CornerUpLeft strokeWidth={1.65} />
          ) : direction === "right" ? (
            <ArrowUpRight strokeWidth={1.65} />
          ) : (
            <ArrowUp strokeWidth={1.65} />
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
      <CameraIcon size={20} />
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
export function CampusMap({
  route,
  current = 0,
  onBuilding,
}: {
  route?: Route;
  current?: number;
  onBuilding?: (name: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const point = route?.steps[current];
  return (
    <div className="map-card">
      <div className="map-heading">
        <b>캠퍼스 개요도</b>
        <Tag tone="gray">예시 배치</Tag>
      </div>
      <div className="map-viewport">
        <div className="map-art" style={{ transform: `scale(${zoom})` }}>
          <svg
            viewBox="0 0 350 345"
            role="img"
            aria-label="본관, 제1주차장, 혜인관의 관계를 보여주는 시연 개요도"
          >
            <rect width="350" height="345" fill="#edf1f4" />
            <rect x="145" width="35" height="345" fill="white" />
            <rect y="142" width="350" height="33" fill="white" />
            <rect
              x="16"
              y="15"
              width="110"
              height="64"
              rx="25"
              fill="#e5f0e9"
            />
            <rect
              x="245"
              y="246"
              width="82"
              height="70"
              rx="24"
              fill="#e5f0e9"
            />
            <rect
              x="25"
              y="88"
              width="104"
              height="54"
              rx="12"
              fill="#d9e1eb"
              stroke="#cdd5df"
            />
            <text x="43" y="113" className="map-label">
              본관
            </text>
            <text x="43" y="132" className="map-small">
              본관 입구
            </text>
            <rect
              x="25"
              y="195"
              width="196"
              height="69"
              rx="13"
              fill="#dfe8f4"
              stroke="#cbd9eb"
            />
            <text x="43" y="218" className="map-label">
              지하주차장 P1
            </text>
            <text x="78" y="251" className="map-small">
              P1 중앙
            </text>
            <rect
              x="205"
              y="27"
              width="122"
              height="88"
              rx="14"
              fill="#edf3ff"
              stroke="#2b61e9"
              strokeWidth="2"
            />
            <text x="235" y="63" className="map-destination">
              혜인관
            </text>
            <text x="220" y="93" className="map-small blue-text">
              3층 · 면접 대기실
            </text>
            <polyline
              points="52,303 52,160 160,160 160,240 263,240 263,115"
              fill="none"
              stroke="#9bafd4"
              strokeWidth="3"
            />
            {route && (
              <polyline
                points={route.steps.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#2861eb"
                strokeWidth="3"
              />
            )}
            <circle
              cx="52"
              cy="303"
              r="6"
              fill="white"
              stroke="#2861eb"
              strokeWidth="2"
            />
            <text x="70" y="307" className="map-small">
              2115번 정류장
            </text>
            {point && (
              <g>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="8"
                  fill="#2861eb"
                  stroke="white"
                  strokeWidth="4"
                />
                <rect
                  x={Math.min(200, Math.max(4, point.x - 61))}
                  y={Math.max(3, point.y - 33)}
                  width="126"
                  height="25"
                  rx="5"
                  fill="#2861eb"
                />
                <text
                  x={Math.min(263, Math.max(67, point.x + 2))}
                  y={Math.max(20, point.y - 16)}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                >
                  현재 · {point.name.slice(0, 10)}
                </text>
              </g>
            )}
          </svg>
          {onBuilding && (
            <>
              <button
                className="map-hit hyein"
                aria-label="지도에서 혜인관 선택"
                onClick={() => onBuilding("혜인관")}
              />
              <button
                className="map-hit main"
                aria-label="지도에서 본관 선택"
                onClick={() => onBuilding("본관")}
              />
            </>
          )}
        </div>
        <div className="zoom">
          <button
            aria-label="지도 확대"
            disabled={zoom >= 1.5}
            onClick={() => setZoom(Math.min(1.5, zoom + 0.25))}
          >
            <Plus size={18} strokeWidth={1.65} />
          </button>
          <button
            aria-label="지도 축소"
            disabled={zoom <= 1}
            onClick={() => setZoom(Math.max(1, zoom - 0.25))}
          >
            <Minus size={18} strokeWidth={1.65} />
          </button>
        </div>
      </div>
      <div className="map-caption">
        <span>— {route ? "현재 경로" : "선택한 목적지"}</span> 위치 관계를
        보여주는 예시입니다
      </div>
    </div>
  );
}
