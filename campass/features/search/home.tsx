"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp, Navigation } from "lucide-react";
import {
  CampassLogo,
  CampassWordmark,
} from "@/components/ui/campass-logo";

import {
  ArrowRightIcon,
  BuildingSolidIcon,
  ChevronRightIcon,
  CupSolidIcon,
  ElevatorIcon,
  PinIcon,
  SearchIcon,
  TapIcon,
} from "@/components/ui/icons";
import { useCampus } from "@/features/navigation/campus-provider";
import { places } from "@/shared/utils/catalog";
import { createRotation } from "@/shared/utils/rotation";
import { overviewMarkers } from "@/shared/utils/campus-overview";
import {
  buildingPaths,
  landPath,
  overviewFrame,
  overviewRoads,
  plazaPath,
} from "@/shared/utils/campus-overview-design";

const events = [
  {
    title: "2026 수시 면접",
    status: "진행 중",
    place: "혜인관 3층",
    time: "09:00–17:00",
    placeId: "interview",
  },
  {
    title: "공모전 발표",
    status: "11/12",
    place: "유담관 L층",
    time: "발표 행사",
    placeId: "contest-final",
  },
];

// 10초마다 다음 행사로 넘김. 화면이 안 보이거나 마우스·키보드 포커스가 카드에 있으면 멈춤
function useEventRotation(count: number) {
  const [index, setIndex] = useState(0);
  const rotation = useRef<ReturnType<typeof createRotation>>(null);
  useEffect(() => {
    const current = createRotation(count, setIndex);
    rotation.current = current;
    const onVisibility = () => current.hold("hidden", document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      current.stop();
      rotation.current = null;
    };
  }, [count]);
  return {
    index,
    select: (next: number) => rotation.current?.select(next),
    hold: (reason: string, on: boolean) => rotation.current?.hold(reason, on),
  };
}

// 나침반 다이얼 크기. 안쪽 원에 캠퍼스 개요도를 축소해 넣음
const DIAL = 260;
const CENTER = DIAL / 2;
const MAP_RADIUS = 96;
// 원 안에 캠퍼스가 들어오게 개요도 틀보다 조금 좁게 자름
const mapSide = Math.max(overviewFrame.width, overviewFrame.height) * 0.86;
const mapLeft = overviewFrame.cx - mapSide / 2;
const mapTop = overviewFrame.cy - mapSide / 2;
const toDial = ([x, y]: [number, number]) => [
  CENTER - MAP_RADIUS + ((x - mapLeft) / mapSide) * MAP_RADIUS * 2,
  CENTER - MAP_RADIUS + ((y - mapTop) / mapSide) * MAP_RADIUS * 2,
];
const gate = toDial(
  overviewMarkers.find((m) => m.id === "gate_main")?.position ?? [
    overviewFrame.cx,
    overviewFrame.cy,
  ],
);
// 청사진 격자. 지도 좌표 25 간격
const gridPath = Array.from(
  { length: Math.ceil(mapSide / 25) + 1 },
  (_, i) => {
    const x = Math.floor(mapLeft / 25) * 25 + i * 25;
    const y = Math.floor(mapTop / 25) * 25 + i * 25;
    return `M${x} ${mapTop}V${mapTop + mapSide}M${mapLeft} ${y}H${mapLeft + mapSide}`;
  },
).join("");
const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
const cardinals = [
  { label: "N", angle: 0 },
  { label: "E", angle: 90 },
  { label: "S", angle: 180 },
  { label: "W", angle: 270 },
];
const polar = (angle: number, radius: number) => [
  CENTER + Math.sin((angle * Math.PI) / 180) * radius,
  CENTER - Math.cos((angle * Math.PI) / 180) * radius,
];

function CompassDial() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      className="home-compass-dial"
      viewBox={`0 0 ${DIAL} ${DIAL}`}
      width={DIAL}
      height={DIAL}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`${id}-map`}>
          <circle cx={CENTER} cy={CENTER} r={MAP_RADIUS} />
        </clipPath>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={CENTER - 1} className="home-compass-face" />

      <g className="home-compass-ticks">
        {ticks.map((angle) => {
          const major = angle % 30 === 0;
          const [x1, y1] = polar(angle, major ? 116 : 120);
          const [x2, y2] = polar(angle, 126);
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={major ? 1.6 : 1}
              opacity={major ? 0.75 : 0.35}
            />
          );
        })}
      </g>

      {cardinals.map(({ label, angle }) => {
        const [x, y] = polar(angle, 108);
        return (
          <text
            key={label}
            x={x}
            y={y}
            className={`home-compass-cardinal${label === "N" ? " north" : ""}`}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {label}
          </text>
        );
      })}

      <g clipPath={`url(#${id}-map)`}>
        <svg
          x={CENTER - MAP_RADIUS}
          y={CENTER - MAP_RADIUS}
          width={MAP_RADIUS * 2}
          height={MAP_RADIUS * 2}
          viewBox={`${mapLeft} ${mapTop} ${mapSide} ${mapSide}`}
        >
          {/* 청사진: 진파랑 바탕, 옅은 격자, 흰 선 건물 */}
          <rect x={mapLeft} y={mapTop} width={mapSide} height={mapSide} fill="#123c9e" />
          <path
            d={gridPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.13)"
            strokeWidth={0.8}
          />
          <path
            d={landPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          {overviewRoads.map((road, i) => (
            <path
              key={i}
              d={road.path}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <path
            d={plazaPath}
            fill="rgba(255, 255, 255, 0.08)"
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth={1.2}
            strokeDasharray="3 3"
          />
          {buildingPaths.map((path, i) => (
            <path
              key={i}
              d={path}
              fill="rgba(255, 255, 255, 0.14)"
              stroke="white"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </g>

      <circle
        cx={CENTER}
        cy={CENTER}
        r={MAP_RADIUS + 1.5}
        fill="none"
        stroke="#174fd6"
        strokeWidth={3}
      />
      {/* 진파랑 지도와 파란 링이 붙어 보이지 않게 안쪽에 흰 선 */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={MAP_RADIUS - 0.5}
        fill="none"
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth={1}
      />

      {/* 정문 현재 위치 */}
      <circle cx={gate[0]} cy={gate[1]} r={5} className="home-compass-pulse" />
      <circle cx={gate[0]} cy={gate[1]} r={5} fill="#ffd166" stroke="white" strokeWidth={2} />

      <g className="home-compass-needle">
        <path
          d={`M${CENTER} ${CENTER - 46} L${CENTER + 6} ${CENTER} H${CENTER - 6} Z`}
          fill="white"
        />
        <path
          d={`M${CENTER} ${CENTER + 46} L${CENTER + 6} ${CENTER} H${CENTER - 6} Z`}
          fill="rgba(255, 255, 255, 0.35)"
        />
        <circle cx={CENTER} cy={CENTER} r={5} fill="white" stroke="#174fd6" strokeWidth={2} />
      </g>
    </svg>
  );
}

export default function Screen() {
  const { query, setQuery, session, busy, ready, go, search, choose } =
    useCampus();

  const carousel = useEventRotation(events.length);
  const eventIndex = carousel.index;

  return (

    <div className="home-screen">
      <header className="home-topbar">
        <div className="home-brand">
          <CampassLogo
           size={36}
            ariaHidden
           className="home-brand-mark"
         />

    <CampassWordmark
     size={25}
      className="home-brand-wordmark"
    />
  </div>

        <button
          className="home-help"
          aria-label="도움말"
          onClick={() => go("help")}
        >
          <CircleHelp size={21} strokeWidth={1.65} />
        </button>
      </header>

      <main className="home-main">
        <section className="home-intro home-rise">
          <p>처음 가는 길도 헤매지 않게</p>
          <h1>어디로 가시나요?</h1>
        </section>

        <section className="home-compass home-rise">
          <button
            type="button"
            className="home-compass-button"
            aria-label="지도에서 목적지 고르기"
            onClick={() =>
              go("prepare", {
                pick: "start",
                start: "",
                destination: "",
                elevator: "false",
              })
            }
          >
            <CompassDial />
          </button>

          <p className="home-compass-hint">
            <TapIcon size={22} />
            <span>
              나침반을 누르면 <strong>지도에서 목적지</strong>를 고를 수 있어요
            </span>
          </p>
        </section>

        <div className="home-rise">
          <form
            className="search-box glass-card home-search"
            onSubmit={(e) => {
              e.preventDefault();

              if (query.trim()) {
                search();
              }
            }}
          >
            <span className="home-search-icon">
              <SearchIcon size={18} />
            </span>

            <input
              aria-label="목적지 검색"
              placeholder="어디든 물어보세요 · 혜인관 301호"
              value={query}
              maxLength={200}
              onChange={(e) => setQuery(e.target.value)}
            />

            <button
              aria-label="목적지 찾기"
              disabled={busy || !ready || !query.trim()}
            >
              <ArrowRightIcon size={20} />
            </button>
          </form>

          <div className="home-question-chips">
            <button
              className="from-left"
              disabled={busy || !ready}
              onClick={() => search("엘리베이터로 갈래요")}
            >
              <ElevatorIcon size={16} />
              엘리베이터로 갈래요
            </button>

            <button
              className="from-right"
              disabled={busy || !ready}
              onClick={() => search("혜인관 301호 어디예요?")}
            >
              <PinIcon size={16} />
              혜인관 301호 어디예요?
            </button>
          </div>
        </div>

        <section className="home-section home-rise">
  <h2>오늘의 행사</h2>

  <div
    className="home-event-carousel"
    onPointerEnter={(e) => {
      if (e.pointerType === "mouse") carousel.hold("pointer", true);
    }}
    onPointerLeave={(e) => {
      if (e.pointerType === "mouse") carousel.hold("pointer", false);
    }}
    onFocus={(e) => {
      // 클릭으로 생긴 포커스는 빼고 키보드 포커스만 멈춤
      if (e.target.matches(":focus-visible")) carousel.hold("focus", true);
    }}
    onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget))
        carousel.hold("focus", false);
    }}
  >
    {/* 카드 안 버튼이 겹치지 않게 '다음 행사'와 '길찾기'를 따로 둠 */}
    <div className="home-event-card card">
      <button
        type="button"
        className="home-event-next"
        onClick={() => carousel.select(eventIndex + 1)}
        aria-label={`${events[eventIndex].title} · 다음 행사 보기`}
      >
        <span className="home-event-title">
          <strong>{events[eventIndex].title}</strong>
          <span
            className={`home-event-status${
              events[eventIndex].status === "진행 중" ? " live" : ""
            }`}
          >
            {events[eventIndex].status}
          </span>
        </span>

        <span className="home-event-place">
          {events[eventIndex].place} · {events[eventIndex].time}
        </span>
      </button>

      {/* 검색을 거치지 않고 그 행사 장소로 바로 경로 준비 */}
      <button
        type="button"
        className="home-event-link"
        disabled={busy}
        onClick={() => {
          const place = places.find(
            (p) => p.id === events[eventIndex].placeId,
          );
          if (place) void choose(place);
        }}
      >
        안내 <ArrowRightIcon size={14} />
      </button>
    </div>
  </div>

  <div className="home-carousel-dots">
    {events.map((event, index) => (
      <button
        key={event.title}
        type="button"
        className={index === eventIndex ? "active" : ""}
        aria-label={`${index + 1}번째 행사 보기`}
        onClick={() => carousel.select(index)}
      />
    ))}
  </div>
</section>

        <section className="home-section home-rise">
          <h2>바로 찾기</h2>

          <div className="home-quick-grid">
            <button
              className="home-quick-card card"
              disabled={busy || !ready}
              onClick={() => go("find", { tab: "classroom", building: "" })}
            >
              <span className="home-quick-icon">
                <BuildingSolidIcon size={20} />
              </span>

              <strong>건물·강의실</strong>
              <ChevronRightIcon size={16} className="home-quick-arrow" />
            </button>

            <button
              className="home-quick-card card"
              disabled={busy || !ready}
              onClick={() => go("find", { tab: "facility" })}
            >
              <span className="home-quick-icon">
                <CupSolidIcon size={20} />
              </span>

              <strong>편의시설</strong>
              <ChevronRightIcon size={16} className="home-quick-arrow" />
            </button>
          </div>

          {session && (
            <button
              className="button secondary home-resume-button"
              onClick={() =>
                go(session.status === "completed" ? "arrival" : "guide")
              }
            >
              <Navigation size={18} strokeWidth={1.65} />
              {session.status === "completed"
                ? "최근 안내·피드백 보기"
                : "이전 안내 이어가기"}
            </button>
          )}
        </section>
      </main>

      <footer className="home-new-footer">© 2026 서경대학교 · CAMPASS</footer>
    </div>
  );
}
