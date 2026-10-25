"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { BuildingIcon, ChevronRightIcon } from "./icons";
import { places, type Place } from "@/lib/catalog";
import { waypoints, type Route } from "@/lib/routing";
import { samePlace } from "@/lib/route-start";
import type { Session, Store } from "@/lib/store";
import type {
  Candidate,
  Recognition,
  Intent,
  IntentResult,
} from "@/lib/providers";
import { Tag } from "@/components/ui";
import { createIntentRequest } from "@/lib/intent-request";
import {
  clearConversation,
  conversationLifetimeMs,
  mergeConversation,
  rememberedTurnPlaces,
  restoreConversation,
  saveConversation,
  selectConversationPlace,
  type ConversationContext,
} from "@/lib/conversation-context";
import { classroomSearch } from "@/lib/classrooms";
import { createContext, useContext } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { navigationHref, viewForPath, type View } from "@/lib/navigation";
export type Insight = ReturnType<Store["insights"]>;
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
      { status: response.status, code: value.error?.code as string | undefined },
    );
  return value;
}
// 복구 목록에서 빼는 중간 지점
const recoveryHidden = [
  "main_bus_stop_passage",
  "main_corridor",
  "main_elevator_front",
  "to_hallim",
  "hallim_to_elevator",
  "hallim_elevator_front",
  "hallim_6f_elevator",
  "hallim_6f_corridor",
  "parking-entry",
  "elevator",
];

function useCampusState() {
  const router = useRouter();
  const view = viewForPath(usePathname());
  const params = useSearchParams();
  const selectedDestination = params.get("destination") || places[0].id;
  const selectedStart = params.get("start") || "";
  const selectedElevator = params.get("elevator") !== "false";
  const selectedBuilding = params.get("building") || "혜인관";
  const selectedQuery = params.get("q") || "";
  const selectedTurn = params.get("turn") || "";
  const selectedCategory = params.get("category") || "";
  // 고른 경로 후보 id. 주소에만 두고 바꿔도 경로를 다시 받지 않음
  const selectedOption = params.get("option") || "";
  const recoveringParam = params.get("recovering");
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Place[]>([]),
    [searchNote, setSearchNote] = useState("");
  const intentRequest = useRef(createIntentRequest((query) => api<IntentResult>("intent", { query })));
  const [searchStartRequested, setSearchStartRequested] = useState(false);
  const [searchIntent, setSearchIntent] = useState<Intent>("destination");
  const [conversationReady, setConversationReady] = useState(false);
  const [conversation, setConversation] = useState<ConversationContext | null>(null);
  const conversationRef = useRef<ConversationContext | null>(null);
  const conversationPlaces = useRef(new Map<string, Place>());
  const [classroomSelection, setClassroomSelection] = useState<ReturnType<
    typeof classroomSearch
  > | null>(null);
  const [classroomBuilding, setClassroomBuilding] = useState<Place | null>(
    null,
  );
  const [searchRevision, setSearchRevision] = useState(0);
  const [destination, setDestination] = useState<Place>(places[0]),
    [start, setStart] = useState(""),
    [elevator, setElevator] = useState(true),
    [route, setRoute] = useState<Route | null>(null);
  const [registeredPlaces, setRegisteredPlaces] = useState<Place[]>(places);
  const [routeConditions, setRouteConditions] = useState("");
  const routeRevision = useRef(0);
  const conditions = JSON.stringify([start, destination.id, elevator]);
  const currentRoute = routeConditions === conditions &&
    start === selectedStart && destination.id === selectedDestination &&
    elevator === selectedElevator ? route : null;
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
  function rememberConversation(next: ConversationContext | null) {
    conversationRef.current = next;
    setConversation(next);
    try { saveConversation(sessionStorage, next); } catch { /* 저장 공간을 사용할 수 없어도 검색은 계속해요. */ }
  }
  function resetConversation() {
    conversationPlaces.current.clear();
    conversationRef.current = null;
    setConversation(null);
    try { clearConversation(sessionStorage); } catch { /* 저장 공간을 사용할 수 없어도 초기화해요. */ }
  }
  function selectClarification(field: "building" | "floor", value: string) {
    const current = conversationRef.current;
    if (!current?.pending) return;
    const candidates = current.candidateIds.map((id) => conversationPlaces.current.get(id));
    if (value && !candidates.some((place) => place?.[field] === value)) return;
    rememberConversation({ ...current,
      ...(value ? { clarification: { field, value } } : { clarification: undefined }),
      expiresAt: Date.now() + conversationLifetimeMs,
    });
  }
  function continueConversation(question: string, result: IntentResult) {
    let current = conversationRef.current;
    if (!current && session) {
      const place = destination.id === session.destination ? destination :
        registeredPlaces.find((item) => item.id === session.destination);
      if (place) {
        conversationPlaces.current.set(place.id, place);
        current = selectConversationPlace(null, place, undefined, elevator);
      }
    }
    for (const place of result.places) conversationPlaces.current.set(place.id, place);
    const merged = mergeConversation(question, result, current,
      (id) => conversationPlaces.current.get(id));
    rememberConversation(merged.context);
    return merged.result;
  }
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
    const revision = ++routeRevision.current;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setRoute(null);
      setError("");
      // 호실은 화면 장소 목록에 없어서 서버에서 찾아옴
      const destination =
        places.find((place) => place.id === selectedDestination) ||
        (await api<{ place: Place }>(
          `places/${encodeURIComponent(selectedDestination)}`,
        ).then(
          (value) => value.place,
          () => undefined,
        )) ||
        places[0];
      if (cancelled || revision !== routeRevision.current) return;
      setDestination(destination);
      setStart(selectedStart);
      setElevator(selectedElevator);
      setBuilding(selectedBuilding);
      setRecovering(view === "recovery" || recoveringParam === "true");
      if (view === "prepare") {
        if (!selectedStart) return;
        if (samePlace(selectedStart, destination.id)) {
          setError("출발지와 도착지가 같아요. 다른 장소를 선택해 주세요.");
          return;
        }
        try {
          const route = await api<Route>("routes", {
            start: selectedStart,
            destination: destination.id,
            elevator: selectedElevator,
          });
          if (!cancelled && revision === routeRevision.current) {
            setRoute(route);
            setRouteConditions(JSON.stringify([selectedStart, destination.id, selectedElevator]));
          }
        } catch (error) {
          if (cancelled || revision !== routeRevision.current) return;
          // 엘리베이터로만 못 가는 곳은 '엘리베이터를 끄면 계단 길을 볼 수 있어요' 안내가 그대로 나감
          setError(
            error instanceof Error ? error.message : "경로를 불러오지 못했어요.",
          );
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    view,
    recoveringParam,
    selectedDestination,
    selectedStart,
    selectedElevator,
    selectedBuilding,
  ]);
  useEffect(() => {
    let cancelled = false;
    restoreConversation(sessionStorage, async (id) => {
      try {
        const value = await api<{ place: Place }>(`places/${encodeURIComponent(id)}`);
        return value.place;
      } catch {
        return waypoints.some((waypoint) => waypoint.id === id) ? true : undefined;
      }
    }).then((restored) => {
      if (cancelled) return;
      if (restored) {
        conversationRef.current = restored.context;
        setConversation(restored.context);
        for (const place of restored.places) conversationPlaces.current.set(place.id, place);
      }
    }).catch(() => {
      if (!cancelled) resetConversation();
    }).finally(() => {
      if (!cancelled) setConversationReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!conversation) return;
    const timer = setTimeout(resetConversation, Math.max(0, conversation.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [conversation]);
  useEffect(() => {
    if (view !== "search") return;
    if (!conversationReady) return;
    const request = intentRequest.current;
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setQuery(selectedQuery);
      setResults([]);
      setSearchIntent("destination");
      setSearchStartRequested(false);
      setClassroomSelection(null);
      setClassroomBuilding(null);
      setSearchNote("검색 결과");
      if (!selectedQuery && !selectedCategory) return;
      const saved = conversationRef.current;
      if (!selectedCategory && saved) {
        const places = rememberedTurnPlaces(saved, selectedTurn,
          (id) => conversationPlaces.current.get(id));
        if (places.length) {
          setResults(places);
          setSearchIntent("destination");
          setSearchStartRequested(Boolean(saved.startPlaceId));
          if (saved.startPlaceId) setStart(saved.startPlaceId);
          if (saved.elevator !== undefined) setElevator(saved.elevator);
          setSearchRevision((value) => value + 1);
          return;
        }
      }
      try {
        let hadPendingCandidates = false;
        let result: Pick<IntentResult, "intent" | "conditions" | "places" | "startPlaceId" | "startRequested"> | null;
        if (selectedCategory) {
          result = {
            ...(await api<{ places: Place[] }>(
              `places?category=${encodeURIComponent(selectedCategory)}`,
            )),
            intent: "destination",
            conditions: {},
          };
        } else {
          const classified = await intentRequest.current.run(selectedQuery);
          if (cancelled || !classified) return;
          for (const place of classified.places) conversationPlaces.current.set(place.id, place);
          hadPendingCandidates = Boolean(conversationRef.current?.pending);
          const merged = mergeConversation(selectedQuery, classified, conversationRef.current,
            (id) => conversationPlaces.current.get(id), Date.now(), selectedTurn);
          rememberConversation(merged.context);
          result = merged.result;
        }
        if (cancelled || !result) return;
        const nextElevator = result.conditions.elevator;
        setSearchStartRequested(Boolean(result.startRequested));
        if (typeof nextElevator === "boolean" || result.startRequested) {
          const url = new URL(window.location.href);
          if (typeof nextElevator === "boolean") {
            setElevator(nextElevator);
            url.searchParams.set("elevator", String(nextElevator));
          }
          if (result.startRequested) {
            setStart(result.startPlaceId ?? "");
            url.searchParams.set("start", result.startPlaceId ?? "");
          }
          window.history.replaceState(
            null,
            "",
            `${url.pathname}${url.search}${url.hash}`,
          );
        }
        setSearchIntent(result.intent);
        if (result.intent !== "destination") return;
        if (!selectedCategory && (hadPendingCandidates || result.startRequested ||
            !result.places.some((p) => p.category === "classroom") ||
            /\d{3,4}|시청각|H\d+/i.test(selectedQuery))) {
          setResults(result.places);
          setClassroomSelection(null);
          setClassroomBuilding(null);
          setSearchRevision((value) => value + 1);
          return;
        }
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
      request.cancel();
    };
    // URL의 elevator 값만 바꿀 때는 의도 분류 요청을 다시 보내지 않음
  }, [view, selectedQuery, selectedTurn, selectedCategory, conversationReady]);
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
    api<{ places: Place[] }>("places")
      .then((data) => {
        if (!cancelled) setRegisteredPlaces(data.places);
      })
      .catch(() => {
        if (!cancelled) setError("출발지 목록을 불러오지 못했어요. 새로고침해 주세요.");
      });
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
    const fresh = view === "home" || (view === "search" && !value.trim());
    if (fresh) {
      resetConversation();
      setStart("");
      setElevator(true);
      setRoute(null);
    }
    else if (view === "search" && conversationRef.current?.clarification)
      rememberConversation({ ...conversationRef.current, clarification: undefined });
    go("search", { q: value, category: category || "",
      ...(value.trim() && !category ? { turn: crypto.randomUUID() } : {}),
      ...(fresh ? { start: "", elevator: "true" } : {}) });
  }
  async function choose(p: Place) {
    conversationPlaces.current.set(p.id, p);
    rememberConversation(selectConversationPlace(conversationRef.current, p, start, elevator));
    routeRevision.current++;
    setDestination(p);
    setRoute(null);
    go("prepare", { destination: p.id });
  }
  // 고른 길 id가 새 후보 목록에 있으면 그대로, 없으면 첫 후보
  const routeOption =
    currentRoute?.options.find((o) => o.id === selectedOption) ?? currentRoute?.options[0];
  function chooseOption(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("option", id);
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  async function updateRoute(nextStart = start, nextElevator = elevator) {
    if (view === "prepare" && nextStart === start && nextElevator === elevator) return;
    routeRevision.current++;
    setStart(nextStart);
    setElevator(nextElevator);
    setRoute(null);
    go("prepare", {
      start: nextStart,
      elevator: String(nextElevator),
      // 엘리베이터만 바꾸면 고른 길 id를 넘겨, 새 후보에 같은 길이 있을 때만 이어서 고름
      ...(routeOption && nextStart === start ? { option: routeOption.id } : {}),
    });
  }
  async function begin() {
    if (!start || !currentRoute || !ready || samePlace(start, destination.id)) return;
    await run(async () => {
      const s = await api<Session>("sessions", {
        start,
        destination: destination.id,
        elevator,
        ...(routeOption ? { option: routeOption.id } : {}),
      });
      saveSession(s);
      resetConversation();
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
  async function previous() {
  if (!session) return;

  await run(async () => {
    const s = await api<Session>(
      `sessions/${session.id}/previous`,
      {
        version: session.version,
      },
    );

    saveSession(s);
    go("guide");
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
  function back() {
    if (view === "guide-map") go("guide");
    else if (["photo", "recognition", "failed", "recovery"].includes(view))
      go(recovering ? "guide" : "prepare");
    else if (view === "places") go("map");
    // 편의시설 정보(A4a)에서는 목록으로
    else if (view === "find" && params.get("place")) router.back();
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
        // 길을 잃고 다시 고를 때는 연결통로 · 복도 · 엘리베이터 앞 같은 중간 지점을 빼고
        // 건물 · 층으로 알아볼 수 있는 지점만 보여 줌
        .filter((w) => !recovering || !recoveryHidden.includes(w.id))
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
    searchStartRequested,
    conversation,
    resetConversation,
    selectClarification,
    continueConversation,
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
    route: currentRoute,
    registeredPlaces,
    setRoute,
    routeOption,
    chooseOption,
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
    previous,
    lost,
    upload,
    confirmLocation,
    sendRecognitionFeedback,
    sendFeedback,
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
