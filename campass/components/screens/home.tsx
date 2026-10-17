"use client";

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

          <div className="home-event-card card">
            <div>
              <div className="home-event-title">
                <strong>2026 수시 면접</strong>
                <span className="home-event-status">진행 중</span>
              </div>

              <p>혜인관 5층 · 09:00–17:00</p>
            </div>

            <button
              className="home-event-link"
              disabled={busy || !ready}
              onClick={() => search("면접 보러 왔어요")}
            >
              길찾기 <ArrowRight size={15} />
            </button>
          </div>

          <div className="home-carousel-dots" aria-hidden="true">
            <span className="active" />
            <span />
          </div>
        </section>

        <section className="home-section">
          <h2>바로 찾기</h2>

          <div className="home-quick-grid">
            <button
              className="home-quick-card card"
              disabled={busy || !ready}
              onClick={() => search("", "classroom")}
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
              onClick={() => search("", "facility")}
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
