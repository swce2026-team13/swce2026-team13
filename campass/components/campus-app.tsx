"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Columns2,
  Compass,
  DoorOpen,
  Info,
  Map,
  MapPin,
  Navigation,
  Presentation,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { campus, places, sources, type Place } from "@/lib/catalog";
import { waypoints, type Route } from "@/lib/routing";
import type { Session } from "@/lib/store";
import type { Candidate, Recognition } from "@/lib/providers";
import { CampusMap, Notice, Photo, Progress, Tag, Upload } from "./ui";
import { classroomSearch } from "@/lib/classrooms";
import { ClassroomPicker } from "./classroom-picker";
type View =
  | "home"
  | "search"
  | "prepare"
  | "photo"
  | "recognition"
  | "failed"
  | "recovery"
  | "guide"
  | "arrival"
  | "admin"
  | "map"
  | "places"
  | "guide-map"
  | "help";
type Insight = {
  passages: number;
  confusions: number;
  rate: number;
  feedbacks: number;
  points: {
    id: string;
    name: string;
    passages: number;
    confusions: number;
    rate: number;
  }[];
};
const titles: Record<View, string> = {
  home: "캠퍼스 길찾기",
  search: "목적지 검색",
  prepare: "길찾기",
  photo: "사진으로 위치 확인",
  recognition: "출발 위치 확인",
  failed: "사진으로 위치 확인",
  recovery: "현재 위치 다시 확인",
  guide: "사진으로 길찾기",
  arrival: "도착 안내",
  admin: "관리자 인사이트",
  map: "캠퍼스 지도",
  places: "건물 · 층별 주요 장소",
  "guide-map": "안내 중 캠퍼스 지도",
  help: "이용 안내",
};
function subscribe(fn: () => void) {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
}
function snapshot() {
  const value = window.location.hash.slice(1);
  return value in titles ? (value as View) : "home";
}
async function api<T>(
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body instanceof FormData
        ? {}
        : body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error?.message || "요청을 완료하지 못했어요.");
  return value;
}
export default function CampusApp() {
  const view = useSyncExternalStore(subscribe, snapshot, () => "home" as View);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Place[]>([]),
    [searchNote, setSearchNote] = useState("");
  const [classroomSelection, setClassroomSelection] = useState<ReturnType<
    typeof classroomSearch
  > | null>(null);
  const [classroomBuilding, setClassroomBuilding] = useState<Place | null>(
    null,
  );
  const [searchRevision, setSearchRevision] = useState(0);
  const [destination, setDestination] = useState<Place>(places[0]),
    [start, setStart] = useState("bus"),
    [elevator, setElevator] = useState(true),
    [route, setRoute] = useState<Route | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [building, setBuilding] = useState("혜인관"),
    [floor, setFloor] = useState("전체");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [vision, setVision] = useState(false);
  const [preview, setPreview] = useState(""),
    [recognition, setRecognition] = useState<Recognition | null>(null),
    [candidate, setCandidate] = useState<Candidate | null>(null),
    [recovering, setRecovering] = useState(false);
  const [confused, setConfused] = useState(true),
    [feedbackPoint, setFeedbackPoint] = useState(""),
    [reason, setReason] = useState("방향 혼란"),
    [comment, setComment] = useState(""),
    [sent, setSent] = useState(false);
  const [adminToken, setAdminToken] = useState(""),
    [insight, setInsight] = useState<Insight | null>(null);
  const imageRef = useRef("");
  const searchId = useRef(0);
  function go(next: View) {
    setError("");
    window.history.pushState(null, "", `#${next}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function saveSession(s: Session) {
    if (s.id !== session?.id) {
      setFeedbackPoint("");
      setReason("방향 혼란");
      setComment("");
      setConfused(true);
    }
    setSession(s);
    sessionStorage.setItem("campass-session", s.id);
    setSent(s.feedbackSubmitted);
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    api<{ visionEnabled: boolean }>("catalog")
      .then(async (data) => {
        if (cancelled) return;
        setVision(data.visionEnabled);
        setReady(true);
        const id = sessionStorage.getItem("campass-session");
        if (id) {
          try {
            const s = await api<Session>(`sessions/${id}`);
            if (!cancelled) {
              setSession(s);
              setSent(s.feedbackSubmitted);
              setDestination(
                places.find((p) => p.id === s.destination) || places[0],
              );
            }
          } catch {
            sessionStorage.removeItem("campass-session");
          }
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("서버에 연결하지 못했어요. 새로고침해 주세요.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(
    () => () => {
      if (imageRef.current) URL.revokeObjectURL(imageRef.current);
    },
    [],
  );
  async function search(value = query, category?: string) {
    await run(async () => {
      const id = ++searchId.current;
      const result = category
        ? await api<{ places: Place[] }>(`places?category=${category}`)
        : await api<{ places: Place[]; message?: string }>("intent", {
            query: value,
          });
      if (id !== searchId.current) return;
      setQuery(value);
      const selection = classroomSearch(value, result.places, category);
      setResults(selection.candidates);
      setClassroomSelection(selection);
      setSearchRevision(id);
      setClassroomBuilding(selection.selectedBuilding || null);
      setSearchNote(
        category
          ? category === "classroom"
            ? "건물을 선택한 뒤 호실을 입력해 주세요."
            : "종류별 장소 목록"
          : "message" in result
            ? String(result.message)
            : "검색 결과",
      );
      go("search");
    });
  }
  async function choose(p: Place) {
    setDestination(p);
    setRoute(null);
    go("prepare");
    await run(async () => {
      setRoute(
        await api<Route>("routes", { start, destination: p.id, elevator }),
      );
    });
  }
  async function updateRoute(nextStart = start, nextElevator = elevator) {
    setStart(nextStart);
    setElevator(nextElevator);
    setRoute(null);
    await run(async () => {
      setRoute(
        await api<Route>("routes", {
          start: nextStart,
          destination: destination.id,
          elevator: nextElevator,
        }),
      );
    });
  }
  async function begin() {
    await run(async () => {
      const s = await api<Session>("sessions", {
        start,
        destination: destination.id,
        elevator,
      });
      saveSession(s);
      setRecovering(false);
      setCandidate(null);
      go(s.status === "completed" ? "arrival" : "guide");
    });
  }
  async function advance() {
    if (!session) return;
    await run(async () => {
      const s = await api<Session>(`sessions/${session.id}/advance`, {
        version: session.version,
      });
      saveSession(s);
      go(s.status === "completed" ? "arrival" : "guide");
    });
  }
  async function lost() {
    if (!session) return;
    await run(async () => {
      await api(`sessions/${session.id}/confusion`, {});
      setRecovering(true);
      setRecognition(null);
      setCandidate(null);
      go("photo");
    });
  }
  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("사진은 5MB 이하로 선택해 주세요.");
      return;
    }
    if (imageRef.current) URL.revokeObjectURL(imageRef.current);
    imageRef.current = URL.createObjectURL(file);
    setPreview(imageRef.current);
    await run(async () => {
      const form = new FormData();
      form.append("image", file);
      const r = await api<Recognition>("recognize", form);
      setRecognition(r);
      setCandidate(r.candidates[0] ?? null);
      go(
        r.status === "matched"
          ? recovering
            ? "recovery"
            : "recognition"
          : "failed",
      );
    });
  }
  async function confirmLocation(id: string, confirmedCandidate?: Candidate) {
    if (recovering && session) {
      await run(async () => {
        const s = await api<Session>(`sessions/${session.id}/recover`, {
          waypointId: id,
          version: session.version,
          direction:
            confirmedCandidate?.waypointId === id
              ? confirmedCandidate.direction
              : "unknown",
        });
        saveSession(s);
        go(s.status === "completed" ? "arrival" : "guide");
      });
    } else {
      go("prepare");
      await updateRoute(id);
    }
  }
  async function sendFeedback() {
    if (!session) return;
    await run(async () => {
      await api(`sessions/${session.id}/feedback`, {
        confused,
        ...(confused
          ? {
              waypointId: session.visited.includes(feedbackPoint)
                ? feedbackPoint
                : session.visited[0],
              reason,
            }
          : {}),
        comment,
      });
      setSent(true);
      setSession({ ...session, feedbackSubmitted: true });
    });
  }
  function browseBuilding(name: string) {
    setBuilding(name);
    setFloor("전체");
    go("places");
  }
  function back() {
    if (view === "guide-map") go("guide");
    else if (["photo", "recognition", "failed", "recovery"].includes(view))
      go(recovering ? "guide" : "prepare");
    else if (view === "places") go("map");
    else go("home");
  }
  const step = session?.route.steps[session.currentStep],
    nextStep = session?.route.steps[(session?.currentStep ?? 0) + 1];
  const guideViews = ["guide", "arrival", "guide-map"];
  const hasSession = Boolean(session);
  const buildingPlaces = places.filter(
    (p) => p.building === building && p.category !== "building",
  );
  const floors = [
    "전체",
    ...new Set(buildingPlaces.map((p) => p.floor).filter(Boolean)),
  ];
  const shownFloors = floor === "전체" ? floors.slice(1) : [floor];
  const displayDestination =
    guideViews.includes(view) && session
      ? places.find((p) => p.id === session.destination) || destination
      : destination;
  const destinationCard = (
    <div className="card destination-card">
      <div className="row">
        <span className="icon-box">
          <Building2 />
        </span>
        <div>
          <h2>
            {displayDestination.building} {displayDestination.floor}
          </h2>
          <strong>{displayDestination.name}</strong>
        </div>
      </div>
      <div className="divider" />
      <div className="between">
        <span className="muted small">
          {displayDestination.category === "event"
            ? "공모전 시연용 면접 안내"
            : displayDestination.description}
        </span>
        <Tag tone={displayDestination.verified ? "green" : "amber"}>
          {displayDestination.verified ? "공식 자료" : "예시 장소"}
        </Tag>
      </div>
    </div>
  );
  const manualPicker = (
    <div className="stack">
      <h3>위치를 직접 선택할 수 있어요</h3>
      {waypoints
        .filter((w) => !["stairs", "interview"].includes(w.id))
        .map((w) => (
          <button
            className="choice"
            key={w.id}
            disabled={busy}
            onClick={() => confirmLocation(w.id)}
          >
            <MapPin size={18} />
            <span>{w.name}</span>
            <ChevronRight size={18} />
          </button>
        ))}
    </div>
  );
  return (
    <div className="phone">
      <header className="app-header">
        {view === "home" ? (
          <Building2 className="brand-icon" />
        ) : (
          <button className="icon-button" aria-label="뒤로 가기" onClick={back}>
            <ArrowLeft size={21} />
          </button>
        )}
        <strong>
          {view === "guide"
            ? `${displayDestination.building} ${displayDestination.name}`
            : titles[view]}
        </strong>
        {view === "home" ? (
          <button
            className="icon-button"
            aria-label="이용 안내"
            onClick={() => go("help")}
          >
            <CircleHelp size={20} />
          </button>
        ) : view === "guide" ? (
          <button
            className="icon-button"
            aria-label="안내 중 지도 보기"
            onClick={() => go("guide-map")}
          >
            <Map size={21} />
          </button>
        ) : (
          <button
            className="icon-button"
            aria-label="홈으로"
            onClick={() => go("home")}
          >
            <X size={21} />
          </button>
        )}
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="오류 닫기" onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {busy && (
        <div className="loading-line" role="status" aria-label="처리 중" />
      )}
      <main id="main-content">
        {view === "home" && (
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
        )}
        {view === "search" && (
          <section className="content stack">
            <h1>어디를 찾으시나요?</h1>
            <form
              className="search-box"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) search();
              }}
            >
              <Search size={20} />
              <input
                aria-label="검색어 수정"
                value={query}
                placeholder="건물명, 강의실, 행사 검색"
                onChange={(e) => setQuery(e.target.value)}
              />
              <button disabled={busy || !query.trim()} aria-label="다시 검색">
                <ArrowRight />
              </button>
            </form>
            <p>{searchNote}</p>
            {classroomBuilding && classroomSelection ? (
              <ClassroomPicker
                key={`${searchRevision}-${classroomBuilding.id}`}
                building={classroomBuilding}
                initialRoom={classroomSelection.room}
                busy={busy}
                onChoose={choose}
                onBack={() => {
                  setClassroomBuilding(null);
                  setResults(places.filter((p) => p.category === "building"));
                  setClassroomSelection({
                    ...classroomSelection,
                    floor: "",
                    basement: false,
                    room: undefined,
                    pickerBuildingIds: places
                      .filter((p) => p.category === "building")
                      .map((p) => p.id),
                  });
                }}
              />
            ) : (
              <>
                <div className="between">
                  <h3>목적지 후보</h3>
                  <span className="muted small">{results.length}곳</span>
                </div>
                {results.length === 0 ? (
                  <Notice>
                    <b>일치하는 장소가 없어요</b>
                    <p>혜인관, 301, 면접처럼 장소명으로 다시 검색해 주세요.</p>
                  </Notice>
                ) : (
                  results.map((p) => (
                    <button
                      className="card place-result"
                      key={p.id}
                      disabled={busy}
                      onClick={() =>
                        classroomSelection?.pickerBuildingIds.includes(p.id)
                          ? setClassroomBuilding(p)
                          : choose(p)
                      }
                    >
                      <span className="icon-box">
                        <Building2 size={22} />
                      </span>
                      <span>
                        <b>{p.name}</b>
                        <small>
                          {classroomSelection?.pickerBuildingIds.includes(p.id)
                            ? "호실 입력하기"
                            : `${p.building} ${p.floor}`}
                        </small>
                        <Tag tone={p.verified ? "gray" : "amber"}>
                          {p.verified ? "공식 자료" : "시연용 예시"}
                        </Tag>
                      </span>
                      <ChevronRight size={20} />
                    </button>
                  ))
                )}
              </>
            )}
          </section>
        )}
        {view === "prepare" && (
          <>
            <section className="content stack">
              <Notice>
                <Tag>목적지 확인</Tag>
                <b>
                  {destination.building} {destination.floor} {destination.name}
                  로 안내할까요?
                </b>
                <small>목적지를 확인한 뒤 출발 위치를 선택해 주세요.</small>
              </Notice>
              <div className="between">
                <h3>목적지</h3>
                <button className="text-button" onClick={() => go("home")}>
                  변경
                </button>
              </div>
              {destinationCard}
              <h3>어디에서 출발하시나요?</h3>
              {["bus", "main"].map((id) => (
                <button
                  key={id}
                  disabled={busy}
                  className={`choice ${start === id ? "selected" : ""}`}
                  onClick={() => updateRoute(id)}
                >
                  <span className="radio" />
                  <span>
                    <b>{waypoints.find((w) => w.id === id)!.name}</b>
                    {id === "bus" && <small>정류장 바로 앞</small>}
                  </span>
                </button>
              ))}
              {!["bus", "main"].includes(start) && (
                <div className="choice selected">
                  <CheckCircle2 size={20} />
                  {waypoints.find((w) => w.id === start)?.name}
                </div>
              )}
              <button
                className="button secondary"
                onClick={() => {
                  setRecovering(false);
                  setRecognition(null);
                  go("photo");
                }}
              >
                <Camera size={20} />
                현재 위치를 모르겠어요 · 사진으로 찾기
              </button>
              <div className="card">
                <div className="between">
                  <strong className="row">
                    <Columns2 size={20} />
                    엘리베이터로 이동
                  </strong>
                  <button
                    className={`switch ${elevator ? "on" : ""}`}
                    role="switch"
                    aria-checked={elevator}
                    aria-label="엘리베이터로 이동"
                    disabled={busy}
                    onClick={() => updateRoute(start, !elevator)}
                  >
                    <span />
                  </button>
                </div>
                <small className="muted">
                  층 이동 시 계단을 제외하고 경로를 찾아요
                </small>
              </div>
              {route && (
                <div className="card">
                  <div className="between">
                    <b>추천 경로</b>
                    <strong className="blue-text">
                      약 {route.minutes}분{" "}
                      <small>{route.steps.length}개 지점</small>
                    </strong>
                  </div>
                  <p className="small">
                    시연용 동선 · 실제 거리와 다를 수 있어요
                  </p>
                  <ol className="route-list">
                    {route.steps.map((w) => (
                      <li key={w.id}>{w.name}</li>
                    ))}
                  </ol>
                  <button
                    className="text-button centered"
                    onClick={() => go("map")}
                  >
                    전체 지도 보기 →
                  </button>
                </div>
              )}
              <p className="fine-print">
                실내 동선은 현장 검증 전 시연 데이터입니다.
              </p>
            </section>
            <div className="actions">
              <button
                className="button primary"
                disabled={!route || busy || !ready}
                onClick={begin}
              >
                안내 시작
                <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}
        {view === "photo" && (
          <section className="content stack">
            <h1>
              {recovering
                ? "주변 모습을 다시 찍어주세요"
                : "사진으로 출발 위치를 찾아요"}
            </h1>
            <p>입구, 통로, 주변 표지판이 함께 보이게 촬영해 주세요.</p>
            <div className="capture-placeholder">
              <Camera size={42} />
              <b>주변을 한 장에 담아주세요</b>
              <small>JPG · PNG · WebP / 최대 5MB</small>
            </div>
            <Upload onFile={upload} busy={busy} />
            {!vision && (
              <Notice tone="amber">
                <b>사진 인식 기능을 준비하고 있어요</b>
                <p>지금은 출발 위치를 직접 선택할 수 있어요.</p>
              </Notice>
            )}
            {manualPicker}
          </section>
        )}
        {["recognition", "recovery"].includes(view) && (
          <>
            <section className="content stack">
              <h1>
                {recovering
                  ? "지금 위치를 다시 찾았어요"
                  : "사진 속 위치가 맞나요?"}
              </h1>
              <p>
                촬영한 주변 모습과 등록 사진을 비교했어요. 주변을 확인한 뒤
                위치를 선택해 주세요.
              </p>
              {preview && <Photo uploaded={preview} label="촬영한 사진" />}
              <div className="between">
                <Tag>인공지능 사진 인식</Tag>
                <Tag tone="green">분석 완료</Tag>
              </div>
              {recognition?.candidates.map((c) => (
                <button
                  key={c.waypointId}
                  className={`card candidate ${candidate?.waypointId === c.waypointId ? "selected" : ""}`}
                  onClick={() => setCandidate(c)}
                >
                  <div className="between">
                    <h3>
                      {waypoints.find((w) => w.id === c.waypointId)?.name}
                    </h3>
                    <CheckCircle2 size={21} />
                  </div>
                  <p>주변 모습과 위치를 직접 확인해 주세요.</p>
                  <Tag>
                    {c.direction === "backward"
                      ? "반대 방향"
                      : c.direction === "forward"
                        ? "진행 방향"
                        : "방향 확인 필요"}
                  </Tag>
                  <div className="between small">
                    <span>모델 유사도</span>
                    <b>{Math.round(c.confidence * 100)}%</b>
                  </div>
                  <progress value={c.confidence} max={1} />
                </button>
              ))}
              {!recognition?.candidates.length && (
                <Notice>
                  사진을 먼저 업로드하거나 위치를 직접 선택해 주세요.
                </Notice>
              )}
              {manualPicker}
            </section>
            <div className="actions">
              <button
                className="button primary"
                disabled={!candidate || busy}
                onClick={() =>
                  candidate && confirmLocation(candidate.waypointId, candidate)
                }
              >
                여기가 맞아요
              </button>
              <button
                className="text-button centered"
                onClick={() => go("photo")}
              >
                다시 촬영
              </button>
            </div>
          </>
        )}
        {view === "failed" && (
          <section className="content stack">
            <div className="between">
              <Tag>인공지능 사진 인식</Tag>
              <Tag tone="amber">
                {recognition?.status === "unavailable"
                  ? "기능 준비 중"
                  : "일치 후보 없음"}
              </Tag>
            </div>
            {preview && <Photo uploaded={preview} label="촬영한 사진" />}
            <Notice tone="amber">
              <b className="row">
                <Camera size={18} />
                위치를 찾지 못했어요
              </b>
              <p>
                {recognition?.message ||
                  "다시 촬영하거나 위치를 직접 선택해 주세요."}
              </p>
            </Notice>
            <h3>이렇게 찍어보세요</h3>
            <div className="card tips">
              {[
                [
                  "통로나 입구가 함께 보이게",
                  "벽만 찍기보다 문, 기둥, 통로를 함께 담아주세요.",
                ],
                [
                  "밝은 곳에서 정면으로",
                  "주변 구조가 잘 보이도록 카메라를 들어주세요.",
                ],
                [
                  "잠깐 멈춰서 촬영하기",
                  "움직임을 멈추고 흐리지 않은 사진을 찍어주세요.",
                ],
              ].map(([title, desc]) => (
                <div className="row" key={title}>
                  <span className="check-icon">
                    <Check size={17} />
                  </span>
                  <div>
                    <b>{title}</b>
                    <small>{desc}</small>
                  </div>
                </div>
              ))}
            </div>
            <Upload onFile={upload} busy={busy} label="다시 촬영하기" />
            {manualPicker}
          </section>
        )}
        {guideViews.includes(view) && !hasSession && (
          <section className="content stack">
            <Notice>진행 중인 안내가 없어요. 목적지를 선택해 주세요.</Notice>
            <button className="button primary" onClick={() => go("home")}>
              목적지 찾기
            </button>
          </section>
        )}
        {view === "guide" && session && step && (
          <>
            <section className="content stack">
              {session.recovered && (
                <Notice tone="green">
                  <b className="row">
                    <CheckCircle2 size={18} />
                    선택한 위치에서 안내를 복구했어요
                  </b>
                  <p>현재 위치를 기준으로 목적지까지 경로를 다시 계산했어요.</p>
                </Notice>
              )}
              <Progress
                current={session.currentStep + 1}
                total={session.route.steps.length}
              />
              <Photo
                src={step.photo}
                direction={
                  session.recovered && session.recoveryDirection === "backward"
                    ? "backward"
                    : step.direction
                }
              />
              <div className="card instruction">
                <h1>
                  {session.recovered && session.recoveryDirection === "backward"
                    ? "뒤돌아 통로를 따라 가세요"
                    : step.instruction}
                </h1>
                <p>{step.detail}</p>
                <div className="current-next">
                  <div>
                    <span>● 현재</span>
                    <b>{step.name}</b>
                  </div>
                  <div>
                    <span>○ 다음</span>
                    <b>{nextStep?.name || "목적지"}</b>
                  </div>
                </div>
              </div>
              <button
                className="button secondary"
                onClick={lost}
                disabled={busy || session.status === "completed"}
              >
                <Camera size={20} />
                길을 잃었어요
              </button>
              <p className="fine-print">
                주변 사진으로 현재 위치를 다시 확인할 수 있어요
              </p>
              <div className="card">
                <span className="search-caption">
                  <Sparkles size={16} />
                  이동 중 다른 장소를 찾으시나요?
                </span>
                <form
                  className="search-box compact"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (query.trim()) search();
                  }}
                >
                  <input
                    aria-label="이동 중 목적지 질문"
                    placeholder="어디로 가고 싶으세요?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button
                    aria-label="장소 질문 검색"
                    disabled={busy || !query.trim()}
                  >
                    <ArrowRight size={18} />
                  </button>
                </form>
              </div>
              <button
                className="text-button centered"
                onClick={() => go("guide-map")}
              >
                <Map size={16} />
                지도에서 현재 단계 보기
              </button>
              <p className="fine-print">
                시연용 사진·동선입니다. 실제 안내는 현장 검증 후 제공돼요.
              </p>
            </section>
            <div className="actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={
                  session.status === "completed" ? () => go("arrival") : advance
                }
              >
                {session.status === "completed"
                  ? "도착 안내 보기"
                  : "다음 지점에 도착했어요"}
                <Check size={18} />
              </button>
              <span className="fine-print">
                자동 위치 추적 없이 직접 도착을 확인합니다
              </span>
            </div>
          </>
        )}
        {view === "arrival" && session?.status === "active" && (
          <section className="content stack">
            <Notice>
              아직 안내 중이에요. 목적지까지 남은 경로를 확인해 주세요.
            </Notice>
            <button className="button primary" onClick={() => go("guide")}>
              안내 이어가기
            </button>
          </section>
        )}
        {view === "arrival" && session?.status === "completed" && (
          <>
            <section className="content stack">
              <div className="arrival-intro">
                <span className="arrival-icon">
                  <CheckCircle2 size={39} />
                </span>
                <h1>목적지에 도착했어요</h1>
                <p>캠퍼스 길찾기가 여러분의 방문을 응원할게요.</p>
              </div>
              {destinationCard}
              <Progress
                current={session.route.steps.length}
                total={session.route.steps.length}
                done
              />
              {sent ? (
                <Notice tone="green">
                  <b>피드백을 보내주셔서 감사해요</b>
                  <p>더 찾기 쉬운 캠퍼스를 만드는 데 도움이 됩니다.</p>
                </Notice>
              ) : (
                <>
                  <h3>헷갈리는 구간이 있었나요?</h3>
                  <div className="two-columns">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        className={`choice ${confused === v ? "selected" : ""}`}
                        onClick={() => setConfused(v)}
                      >
                        <span className="radio" />
                        <b>{v ? "있었어요" : "없었어요"}</b>
                      </button>
                    ))}
                  </div>
                  {confused && (
                    <div className="card stack">
                      <b>어느 구간이었나요?</b>
                      <div className="select-wrap">
                        <select
                          aria-label="혼란 구간"
                          value={
                            session.visited.includes(feedbackPoint)
                              ? feedbackPoint
                              : session.visited[0]
                          }
                          onChange={(e) => setFeedbackPoint(e.target.value)}
                        >
                          {session.visited.map((id) => (
                            <option key={id} value={id}>
                              {waypoints.find((w) => w.id === id)?.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={17} />
                      </div>
                      <div className="chips">
                        {[
                          "방향 혼란",
                          "사진 불일치",
                          "표지판 부족",
                          "기타",
                        ].map((r) => (
                          <button
                            className={reason === r ? "active" : ""}
                            key={r}
                            onClick={() => setReason(r)}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <label className="field-label">
                    더 알려주실 내용이 있나요? <small>선택</small>
                    <textarea
                      maxLength={500}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="헷갈렸던 부분을 편하게 알려주세요"
                    />
                    <span className="muted small">{comment.length}/500</span>
                  </label>
                </>
              )}
            </section>
            <div className="actions">
              {!sent && (
                <button
                  className="button primary"
                  disabled={busy || session.status !== "completed"}
                  onClick={sendFeedback}
                >
                  피드백 보내기
                </button>
              )}
              <button
                className={`button ${sent ? "primary" : "secondary"}`}
                onClick={() => go("home")}
              >
                처음으로 돌아가기
              </button>
            </div>
          </>
        )}
        {(view === "map" || (view === "guide-map" && session)) && (
          <section className="content stack">
            {view === "map" ? (
              <>
                <h1>어느 건물을 찾으세요?</h1>
                <p>건물을 선택하면 주요 장소를 확인할 수 있어요.</p>
              </>
            ) : (
              <Progress
                current={session!.currentStep + 1}
                total={session!.route.steps.length}
              />
            )}
            <CampusMap
              route={view === "guide-map" ? session!.route : undefined}
              current={session?.currentStep}
              onBuilding={view === "map" ? browseBuilding : undefined}
            />
            {view === "guide-map" ? (
              <>
                <div className="card">
                  <Tag>현재 {session!.currentStep + 1}단계</Tag>
                  <h3>{step?.name}</h3>
                  <p>다음 · {nextStep?.name || "목적지"}</p>
                </div>
                <button className="button primary" onClick={() => go("guide")}>
                  사진 안내로 돌아가기
                </button>
              </>
            ) : (
              <>
                <button
                  className="card place-result"
                  onClick={() => browseBuilding("혜인관")}
                >
                  <span className="icon-box">
                    <Building2 />
                  </span>
                  <span>
                    <h2>혜인관</h2>
                    <small>층별 주요 장소 확인</small>
                  </span>
                  <ChevronRight />
                </button>
                <h3>서경대학교 건물</h3>
                <div className="chips">
                  {places
                    .filter((p) => p.category === "building")
                    .map((p) => (
                      <button key={p.id} onClick={() => browseBuilding(p.name)}>
                        {p.name}
                      </button>
                    ))}
                </div>
              </>
            )}
            <a
              className="text-button centered"
              href={sources.map}
              target="_blank"
              rel="noreferrer"
            >
              서경대학교 공식 캠퍼스맵 ↗
            </a>
          </section>
        )}
        {view === "places" && (
          <section className="content stack">
            <Tag>선택한 건물</Tag>
            <h1>{building}</h1>
            <p>층별 주요 장소를 선택해 목적지로 설정하세요.</p>
            <div className="chips filters">
              {floors.map((f) => (
                <button
                  className={floor === f ? "active" : ""}
                  key={f}
                  onClick={() => setFloor(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            {shownFloors.map((f) => (
              <div
                className={`card floor-card ${f === "5층" ? "selected" : ""}`}
                key={f}
              >
                <div className="between">
                  <h2>{f}</h2>
                  <Tag tone={f === "5층" ? "blue" : "gray"}>
                    {f === "5층" ? "시연 행사" : "주요 장소"}
                  </Tag>
                </div>
                {buildingPlaces
                  .filter((p) => p.floor === f)
                  .map((p) => (
                    <div className="floor-place" key={p.id}>
                      <CalendarDays size={20} />
                      <div>
                        <b>{p.name}</b>
                        <small>
                          {p.verified
                            ? "공식 공지에 등재"
                            : "예시 · 현장 확인 필요"}
                        </small>
                      </div>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => choose(p)}
                      >
                        선택
                      </button>
                    </div>
                  ))}
              </div>
            ))}
            {buildingPlaces.length === 0 && (
              <Notice>
                <b>층별 정보를 준비하고 있어요</b>
                <p>
                  건물명은 공식 자료에서 확인했으며 실내 장소는 아직 등록되지
                  않았어요.
                </p>
              </Notice>
            )}
            <a
              className="button secondary"
              href={sources.notice}
              target="_blank"
              rel="noreferrer"
            >
              학교 공식 장소 정보 확인 ↗
            </a>
          </section>
        )}
        {view === "admin" && (
          <section className="content stack">
            <div className="row">
              <Tag tone="gray">관리자 전용</Tag>
              <Tag tone="amber">시연 경로 이용 기록</Tag>
            </div>
            <h1>어디에서 많이 헷갈릴까요?</h1>
            <p>
              피드백과 위치 재확인 신호를 통행량과 함께 살펴보고, 안내 개선
              우선순위를 정해요.
            </p>
            {!insight ? (
              <form
                className="card stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () =>
                    setInsight(
                      await api<Insight>(
                        "admin/insights",
                        undefined,
                        adminToken,
                      ),
                    ),
                  );
                }}
              >
                <ShieldCheck className="blue-text" />
                <h3>관리자 인증</h3>
                <label className="field-label">
                  관리자 토큰
                  <input
                    type="password"
                    autoComplete="off"
                    value={adminToken}
                    onChange={(e) => setAdminToken(e.target.value)}
                    placeholder="서버에 설정한 토큰"
                  />
                </label>
                <button
                  className="button primary"
                  disabled={busy || !adminToken}
                >
                  인사이트 열기
                </button>
                <p className="small">
                  관리자 토큰은 이 화면을 사용하는 동안만 메모리에 보관해요.
                </p>
              </form>
            ) : (
              <>
                <div className="stats-grid">
                  {[
                    [
                      "지점 통과",
                      `${insight.passages}건`,
                      "세션·지점별 중복 제외",
                    ],
                    [
                      "혼란 신호",
                      `${insight.confusions}건`,
                      "피드백·위치 재확인 합집합",
                    ],
                    [
                      "전체 혼란 비율",
                      `${insight.rate}%`,
                      "혼란 신호 ÷ 지점 통과",
                    ],
                    [
                      "검토 지점",
                      `${insight.points.filter((p) => p.confusions > 0).length}곳`,
                      "혼란 신호가 있는 지점",
                    ],
                  ].map(([a, b, c]) => (
                    <div className="card stat" key={a}>
                      <small>{a}</small>
                      <strong>{b}</strong>
                      <small>{c}</small>
                    </div>
                  ))}
                </div>
                <div className="between">
                  <h3>혼란 지점 우선순위</h3>
                  <Tag>비율순</Tag>
                </div>
                <p className="small">
                  전체 기간 · 지점별로 같은 세션을 한 번만 집계해요.
                </p>
                {insight.points.length === 0 && (
                  <Notice>
                    아직 안내 기록이 없어요. 길찾기를 사용하면 통계가 쌓여요.
                  </Notice>
                )}
                {insight.points.map((p, i) => (
                  <div
                    className={`card insight-point ${i === 0 ? "selected" : ""}`}
                    key={p.id}
                  >
                    <div className="row">
                      <span className="rank">{i + 1}</span>
                      <b>{p.name}</b>
                    </div>
                    <div className="between">
                      <span className="small muted">
                        혼란 {p.confusions}건 / 통과 {p.passages}건
                      </span>
                      <strong className="blue-text">{p.rate}%</strong>
                    </div>
                    <progress value={p.rate} max={100} />
                  </div>
                ))}
                <p className="small">
                  제출된 피드백 {insight.feedbacks}건 · 수동 도착 확인 기반
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () =>
                      setInsight(
                        await api<Insight>(
                          "admin/insights",
                          undefined,
                          adminToken,
                        ),
                      ),
                    )
                  }
                >
                  통계 새로고침
                </button>
                <button
                  className="text-button centered"
                  onClick={() => {
                    setAdminToken("");
                    setInsight(null);
                  }}
                >
                  관리자 로그아웃
                </button>
              </>
            )}
          </section>
        )}
        {view === "help" && (
          <section className="content stack">
            <span className="icon-box">
              <Compass />
            </span>
            <h1>
              처음 방문해도,
              <br />
              사진을 따라 차근차근
            </h1>
            <p>{campus.name} 캠퍼스 길찾기 시연 서비스입니다.</p>
            <div className="card stack">
              <h3>이렇게 이용하세요</h3>
              <p>1. 목적지를 검색하고 출발지를 선택하세요.</p>
              <p>2. 사진과 안내를 확인하며 다음 지점으로 이동하세요.</p>
              <p>3. 각 지점에서 도착 버튼을 눌러 주세요.</p>
              <p>4. 길을 잃었다면 위치를 다시 선택하세요.</p>
            </div>
            <Notice tone="amber">
              <b className="row">
                <Info size={18} />
                시연 안내
              </b>
              <p>
                건물·일부 강의실은 공식 자료에 기반합니다. 사진, 거리, 실내
                경로, 면접 장소는 예시이며 현장 검증 전입니다. 사진 인식 API
                미설정 시 직접 선택으로 안내합니다.
              </p>
            </Notice>
            <a
              className="button secondary"
              href={sources.map}
              target="_blank"
              rel="noreferrer"
            >
              공식 캠퍼스맵 보기 ↗
            </a>
            <button className="button primary" onClick={() => go("home")}>
              목적지 찾아보기
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
