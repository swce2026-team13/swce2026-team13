"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp, Navigation } from "lucide-react";

import {
  ArrowRightIcon,
  BuildingIcon,
  CoffeeIcon,
  MapIcon,
  MessageIcon,
} from "@/components/ui/icons";
import { useCampus } from "@/features/navigation/campus-provider";
import { places } from "@/shared/utils/catalog";
import { createRotation } from "@/shared/utils/rotation";

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

export default function Screen() {
  const { query, setQuery, session, busy, ready, go, search, choose } =
    useCampus();

  const carousel = useEventRotation(events.length);
  const eventIndex = carousel.index;

  return (

    <div className="home-screen">
      <header className="home-topbar">
        <div className="home-brand">
          <span className="home-brand-icon">
            <img
               src="/images/campass-logo.png"
                alt="CAMPASS 로고"
                className="home-brand-logo"
            />
          </span>

          <strong>
            CAM<span>PASS</span>
          </strong>
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
        <section className="home-intro">
          <p>처음 가는 길도 헤매지 않게</p>
          <h1>어디로 가시나요?</h1>
        </section>

        <form
          className="search-box glass-card home-search"
          onSubmit={(e) => {
            e.preventDefault();

            if (query.trim()) {
              search();
            }
          }}
        >
          <MessageIcon size={19} />

          <input
            aria-label="목적지 검색"
            placeholder="예: 혜인관 면접 대기실로 가고 싶어요"
            value={query}
            maxLength={200}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button
            aria-label="목적지 찾기"
            disabled={busy || !ready || !query.trim()}
          >
            <ArrowRightIcon />
          </button>
        </form>

        <div className="home-search-caption">
          <MessageIcon size={14} />
          <span>건물·강의실을 검색하거나 목적지를 말해보세요</span>
        </div>

        <div className="home-question-chips">
          <button
            disabled={busy || !ready}
            onClick={() => search("엘리베이터로 갈래요")}
          >
            엘리베이터로 갈래요
          </button>

          <button
            disabled={busy || !ready}
            onClick={() => search("혜인관 301호 어디예요?")}
          >
            혜인관 301호 어디예요?
          </button>
        </div>

        <section className="home-section">
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
          <span className="home-event-status">
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
        길찾기 <ArrowRightIcon size={15} />
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

        <section className="home-section">
          <h2>바로 찾기</h2>

          <div className="home-quick-grid">
            <button
              className="home-quick-card card"
              disabled={busy || !ready}
              onClick={() => go("find", { tab: "classroom" })}
            >
              <span className="home-quick-icon">
                <BuildingIcon size={22} />
              </span>

              <strong>건물·강의실</strong>
              <small>건물 → 층 → 호실</small>
            </button>

            <button
              className="home-quick-card card"
              disabled={busy || !ready}
              onClick={() => go("find", { tab: "facility" })}
            >
              <span className="home-quick-icon">
                <CoffeeIcon size={22} />
              </span>

              <strong>편의시설</strong>
              <small>카페 · 편의점 · 식당</small>
            </button>
          </div>

          <button
            className="button secondary home-map-button"
            onClick={() => go("map")}
          >
            <MapIcon size={20} />
            지도에서 고르기
          </button>

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