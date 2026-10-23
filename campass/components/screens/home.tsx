"use client";

import { useState } from "react";

import {
  ArrowRight,
  Building2,
  CircleHelp,
  Coffee,
  Compass,
  Map,
  MessageSquareText,
  Navigation,
} from "lucide-react";

import { useCampus } from "@/components/campus-provider";

export default function Screen() {
  const { query, setQuery, session, busy, ready, go, search } = useCampus();

  const [eventIndex, setEventIndex] = useState(0);

  const events = [
    {
      title: "2026 수시 면접",
      status: "진행 중",
      place: "혜인관 3층",
      time: "09:00–17:00",
      query: "면접 보러 왔어요",
    },
    {
      title: "공모전 발표",
      status: "11/10",
      place: "유담관 L층",
      time: "발표 행사",
      query: "공모전 발표 보러 왔어요",
    },
  ];

  return (

    <div className="home-screen">
      <header className="home-topbar">
        <div className="home-brand">
          <span className="home-brand-icon">
            <Compass size={20} />
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
          <CircleHelp size={21} />
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
          <MessageSquareText size={19} />

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
            <ArrowRight />
          </button>
        </form>

        <div className="home-search-caption">
          <MessageSquareText size={14} />
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

  <div className="home-event-carousel">
    <button
      type="button"
      className="home-event-card card"
      onClick={() => setEventIndex((eventIndex + 1) % events.length)}
      aria-label="다음 행사 보기"
    >
      <div>
        <div className="home-event-title">
          <strong>{events[eventIndex].title}</strong>
          <span className="home-event-status">
            {events[eventIndex].status}
          </span>
        </div>

        <p>
          {events[eventIndex].place} · {events[eventIndex].time}
        </p>
      </div>

      <span
        className="home-event-link"
        onClick={(e) => {
          e.stopPropagation();
          search(events[eventIndex].query);
        }}
      >
        길찾기 <ArrowRight size={15} />
      </span>
    </button>
  </div>

  <div className="home-carousel-dots">
    {events.map((event, index) => (
      <button
        key={event.title}
        type="button"
        className={index === eventIndex ? "active" : ""}
        aria-label={`${index + 1}번째 행사 보기`}
        onClick={() => setEventIndex(index)}
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
                <Building2 size={22} />
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
                <Coffee size={22} />
              </span>

              <strong>편의시설</strong>
              <small>카페 · 편의점 · 식당</small>
            </button>
          </div>

          <button
            className="button secondary home-map-button"
            onClick={() => go("map")}
          >
            <Map size={20} />
            지도에서 고르기
          </button>

          {session && (
            <button
              className="button secondary"
              onClick={() =>
                go(session.status === "completed" ? "arrival" : "guide")
              }
            >
              <Navigation size={18} />
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