"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { BuildingIcon, ChevronRightIcon } from "./icons";
import { places, type Place } from "@/lib/catalog";
import { DEFAULT_START, waypoints, type Route } from "@/lib/routing";
import type { Session } from "@/lib/store";
import type {
  Candidate,
  Recognition,
  Intent,
  IntentResult,
} from "@/lib/providers";
import { Tag } from "@/components/ui";
import { classroomSearch } from "@/lib/classrooms";
import { createContext, useContext } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { navigationHref, viewForPath, type View } from "@/lib/navigation";
export type Insight = {
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
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body instanceof FormData
        ? {}
        : body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
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
    throw Object.assign(
      new Error(value.error?.message || "요청을 완료하지 못했어요."),
      { status: response.status },
    );
  return value;
}
function useCampusState() {
  const router = useRouter();
  const view = viewForPath(usePathname());
  const params = useSearchParams();
  const selectedDestination = params.get("destination") || places[0].id;
  const selectedStart = params.get("start") || DEFAULT_START;
  const selectedElevator = params.get("elevator") !== "false";
  const selectedBuilding = params.get("building") || "혜인관";
  const selectedQuery = params.get("q") || "";
  const selectedCategory = params.get("category") || "";
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Place[]>([]),
    [searchNote, setSearchNote] = useState("");
  const [searchIntent, setSearchIntent] = useState<Intent>("destination");
  const [classroomSelection, setClassroomSelection] = useState<ReturnType<
    typeof classroomSearch
  > | null>(null);
  const [classroomBuilding, setClassroomBuilding] = useState<Place | null>(
    null,
  );
  const [searchRevision, setSearchRevision] = useState(0);
  const [destination, setDestination] = useState<Place>(places[0]),
    [start, setStart] = useState(DEFAULT_START),
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
  const [insight, setInsight] = useState<Insight | null>(null);
  const imageRef = useRef("");
  function go(next: View, values: Record<string, string> = {}) {
    setError("");
    const href = navigationHref(next, {
      destination: destination.id,
      start,
      elevator: String(elevator),
      building,
      recovering: String(recovering),
      ...values,
    });
    router.push(href, {
      scroll: !["map", "places", "guide-map", "help"].includes(next),
    });
  }
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      const destination =
        places.find((place) => place.id === selectedDestination) || places[0];
      setDestination(destination);
      setStart(selectedStart);
      setElevator(selectedElevator);
      setBuilding(selectedBuilding);
      setRecovering(view === "recovery" || params.get("recovering") === "true");
      if (view === "prepare") {
        setRoute(null);
        try {
          const route = await api<Route>("routes", {
            start: selectedStart,
            destination: destination.id,
            elevator: selectedElevator,
          });
          if (!cancelled) setRoute(route);
        } catch (error) {
          if (!cancelled)
            setError(
              error instanceof Error
                ? error.message
                : "경로를 불러오지 못했어요.",
            );
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    view,
    params,
    selectedDestination,
    selectedStart,
    selectedElevator,
    selectedBuilding,
  ]);
  useEffect(() => {
    if (view !== "search") return;
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setQuery(selectedQuery);
      setResults([]);
      setSearchIntent("destination");
      setClassroomSelection(null);
      setClassroomBuilding(null);
      setSearchNote("검색 결과");
      if (!selectedQuery && !selectedCategory) return;
      try {
        const result: Pick<IntentResult, "intent" | "conditions" | "places"> =
          selectedCategory
            ? {
                ...(await api<{ places: Place[] }>(
                  `places?category=${encodeURIComponent(selectedCategory)}`,
                )),
                intent: "destination",
                conditions: {},
              }
            : await api<IntentResult>("intent", { query: selectedQuery });
        if (cancelled) return;
        const nextElevator = result.conditions.elevator;
        if (typeof nextElevator === "boolean") {
          setElevator(nextElevator);
          const url = new URL(window.location.href);
          url.searchParams.set("elevator", String(nextElevator));
          window.history.replaceState(
            null,
            "",
            `${url.pathname}${url.search}${url.hash}`,
          );
        }
        setSearchIntent(result.intent);
        if (result.intent !== "destination") return;
        const selection = classroomSearch(
          selectedQuery,
          result.places,
          selectedCategory || undefined,
        );
        setResults(selection.candidates);
        setClassroomSelection(selection);
        setClassroomBuilding(selection.selectedBuilding || null);
        setSearchNote(
          selectedCategory === "classroom"
            ? "건물을 선택한 뒤 호실을 입력해 주세요."
            : "검색 결과",
        );
        setSearchRevision((value) => value + 1);
      } catch (error) {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "검색 결과를 불러오지 못했어요.",
          );
      }
    });
    return () => {
      cancelled = true;
    };
    // URL의 elevator 값만 바꿀 때는 의도 분류 요청을 다시 보내지 않음
  }, [view, selectedQuery, selectedCategory]);
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
      if (e instanceof Error && "status" in e && e.status === 401)
        setInsight(null);
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
  function search(value = query, category?: string) {
    go("search", { q: value, category: category || "" });
  }
  async function choose(p: Place) {
    setDestination(p);
    setStart(DEFAULT_START);
    setRoute(null);
    go("prepare", { destination: p.id, start: DEFAULT_START });
  }
  async function updateRoute(nextStart = start, nextElevator = elevator) {
    setStart(nextStart);
    setElevator(nextElevator);
    setRoute(null);
    go("prepare", { start: nextStart, elevator: String(nextElevator) });
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
      go("photo", { recovering: "true" });
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
        { recovering: String(recovering) },
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
      await updateRoute(id);
    }
  }
  async function sendRecognitionFeedback() {
  if (!candidate) return;

  await run(async () => {
    await api("recognition-feedback", {
      predictedWaypointId: candidate.waypointId,
      confidence: candidate.confidence,
      direction: candidate.direction,
    });
  });
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
    go("places", { building: name });
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
          <BuildingIcon />
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
            <MapPin size={18} strokeWidth={1.65} />
            <span>{w.name}</span>
            <ChevronRightIcon size={18} />
          </button>
        ))}
    </div>
  );
  return {
    query,
    setQuery,
    results,
    setResults,
    searchNote,
    setSearchNote,
    searchIntent,
    classroomSelection,
    setClassroomSelection,
    classroomBuilding,
    setClassroomBuilding,
    searchRevision,
    setSearchRevision,
    destination,
    setDestination,
    start,
    setStart,
    elevator,
    setElevator,
    route,
    setRoute,
    session,
    setSession,
    building,
    setBuilding,
    floor,
    setFloor,
    busy,
    setBusy,
    error,
    setError,
    ready,
    setReady,
    vision,
    setVision,
    preview,
    setPreview,
    recognition,
    setRecognition,
    candidate,
    setCandidate,
    recovering,
    setRecovering,
    confused,
    setConfused,
    feedbackPoint,
    setFeedbackPoint,
    reason,
    setReason,
    comment,
    setComment,
    sent,
    setSent,
    insight,
    setInsight,
    go,
    saveSession,
    run,
    search,
    choose,
    updateRoute,
    begin,
    advance,
    lost,
    upload,
    confirmLocation,
    sendRecognitionFeedback,
    sendFeedback,
    browseBuilding,
    back,
    step,
    nextStep,
    guideViews,
    hasSession,
    buildingPlaces,
    floors,
    shownFloors,
    displayDestination,
    destinationCard,
    manualPicker,
  };
}

const CampusContext = createContext<ReturnType<typeof useCampusState> | null>(
  null,
);
export function CampusProvider({ children }: { children: React.ReactNode }) {
  const value = useCampusState();
  return (
    <CampusContext.Provider value={value}>{children}</CampusContext.Provider>
  );
}
export function useCampus() {
  const value = useContext(CampusContext);
  if (!value) throw new Error("CampusProvider 필요");
  return value;
}
