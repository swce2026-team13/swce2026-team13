"use client";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronRight,
  DoorOpen,
  Map,
  Navigation,
  Presentation,
  Search,
  Sparkles,
} from "lucide-react";
import { Tag } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
export default function Screen() {
  const { query, setQuery, session, busy, ready, go, search } = useCampus();
  return (
    <>
      {
        <>
          <section className="hero">
            <Tag>처음 방문해도, 사진을 따라 차근차근</Tag>
            <h1>어디로 가시나요?</h1>
            <p>목적지를 검색하거나 편하게 말해보세요</p>
            <form
              className="search-box"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) search();
              }}
            >
              <Search size={22} />
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
            <div className="search-caption">
              <Sparkles size={16} />
              <span>목적지 찾기 · 말 속에서 등록된 장소를 찾아요</span>
            </div>
            <div className="chips">
              {[
                "면접 보러 왔어요",
                "혜인관 5층으로 가고 싶어요",
                "엘리베이터로 가고 싶어요",
              ].map((t) => (
                <button
                  key={t}
                  disabled={busy || !ready}
                  onClick={() => search(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>
          <section className="content home-content">
            <h3>어디를 찾고 계신가요?</h3>
            <div className="category-grid">
              {[
                {
                  name: "행사",
                  sub: "면접·행사 장소",
                  icon: CalendarDays,
                  id: "event",
                },
                {
                  name: "강의실",
                  sub: "강의실·호실 찾기",
                  icon: Presentation,
                  id: "classroom",
                },
                {
                  name: "시설",
                  sub: "엘리베이터·편의시설",
                  icon: DoorOpen,
                  id: "facility",
                },
                {
                  name: "건물",
                  sub: "캠퍼스 건물 안내",
                  icon: Building2,
                  id: "building",
                },
              ].map((c) => (
                <button
                  className="category card"
                  key={c.id}
                  disabled={busy || !ready}
                  onClick={() => search("", c.id)}
                >
                  <span>
                    <c.icon size={23} />
                    <b>{c.name}</b>
                  </span>
                  <small>{c.sub}</small>
                </button>
              ))}
            </div>
            <button className="button secondary" onClick={() => go("map")}>
              <Map size={20} />
              캠퍼스 지도 보기
              <ChevronRight size={18} />
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
            <div className="home-footer">
              <span>서경대학교 · CAMPASS</span>
              <button onClick={() => go("admin")}>관리자</button>
            </div>
          </section>
        </>
      }
    </>
  );
}
