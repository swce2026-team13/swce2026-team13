"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  BackIcon,
  BuildingIcon,
  CameraIcon,
  CloseIcon,
  MapIcon,
  SearchLensIcon,
} from "@/components/ui/icons";
import { CampassLogo } from "@/components/ui/campass-logo";
import { startLabel } from "@/shared/utils/route-start";
import { ClassroomPicker } from "@/features/search/classroom-picker";
import { PlaceIcon } from "@/features/search/floor-places";
import { FacilityStatus, useNow } from "@/features/search/facility-status";
import { withCopula } from "@/shared/utils/hangul";
import { useCampus } from "@/features/navigation/campus-provider";
import { ElevatorShortcut } from "@/features/search/elevator-shortcut";
import { ElevatorSectionCard } from "@/features/navigation/elevator-section-card";
import { CampusOverviewMap } from "@/features/navigation/campus-overview-map";
import { elevatorSection, shortcutAreaOf } from "@/shared/utils/elevator-shortcut";
import { chatStorageKey, isConfirmation } from "@/shared/utils/conversation-context";
import { campusBuildings } from "@/shared/utils/campus3d/types";
import { routeSummary } from "@/shared/utils/route-summary";
import { api } from "@/shared/utils/api";
import type { Route } from "@/shared/utils/routing";
import type { Place } from "@/shared/utils/catalog";

// 지난 말풍선. 마지막 질문의 답은 화면 상태로 그리고, 그 전 대화는 글로만 남김
type Entry = { role: "user" | "bot"; text: string };

// 출발을 묻는 빠른 답. 출발 지점은 글이 아니라 선택값으로 바로 넘김
const startChoices = [{ id: "gate", label: "학교 정문" }];

function floorRange(place: Place) {
  const building = campusBuildings().find((b) => b.id === place.id || b.name === place.building);
  if (place.category !== "building" || !building?.floors.length) return `${place.building} ${place.floor}`.trim();
  return `${building.floors[0].label} ~ ${building.floors.at(-1)!.label}`;
}

function readLog(): { entries: Entry[]; local: string; draft: string } {
  try {
    const value = JSON.parse(sessionStorage.getItem(chatStorageKey) ?? "null");
    if (value && Array.isArray(value.entries))
      return {
        entries: value.entries.filter((e: Entry) => (e.role === "user" || e.role === "bot") && typeof e.text === "string"),
        local: typeof value.local === "string" ? value.local : "",
        draft: typeof value.draft === "string" ? value.draft : "",
      };
  } catch {}
  return { entries: [], local: "", draft: "" };
}

export default function Screen() {
  const now = useNow();
  const params = useSearchParams();
  const {
    query,
    results,
    searchNote,
    searchIntent,
    searchStartRequested,
    conversation,
    resetConversation,
    continueConversation,
    selectClarification,
    start,
    setStart,
    registeredPlaces,
    elevator,
    classroomSelection,
    setClassroomSelection,
    classroomBuilding,
    setClassroomBuilding,
    setResults,
    searchRevision,
    searchLoading,
    busy,
    go,
    back,
    search,
    choose,
  } = useCampus();
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  // 서버를 거치지 않고 고른 답(예: 출발 '학교 정문'). 지금 차례의 내 말풍선으로 보여 줌
  const [local, setLocal] = useState("");
  const [restored, setRestored] = useState(false);
  const [filter, setFilter] = useState<{ revision: number; value: string } | null>(null);
  const [showSection, setShowSection] = useState(false);
  const [route, setRoute] = useState<{ key: string; value: Route | null; failed?: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const turn = params.get("turn") || "";

  // 새로고침해도 같은 대화(turn)면 지난 말풍선을 이어서 보여 줌
  useEffect(() => {
    // Activity 복원 때 저장 effect가 이전 화면의 말풍선을 쓰기 전에 읽어요.
    const saved = readLog();
    Promise.resolve().then(() => {
      if (turn || params.get("q")) {
        setEntries(saved.entries);
        setLocal(saved.local);
        setDraft(saved.draft);
      } else {
        // 질문 없이 새로 열면 이전 대화를 이어받지 않고 새로 시작
        sessionStorage.removeItem(chatStorageKey);
        resetConversation();
      }
      setRestored(true);
    });
    // 처음 열 때 한 번만 읽음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(chatStorageKey, JSON.stringify({ entries, local, draft }));
    } catch {}
  }, [entries, local, draft, restored]);

  const userText = local || query.trim();
  const buildings = [...new Set(results.map((place) => place.building).filter(Boolean))];
  const field = buildings.length > 1 ? "building" : "floor";
  const groups = [...new Set(results.map((place) => place[field]).filter(Boolean))];
  const clarify = !classroomSelection && results.length > 1 && groups.length > 1;
  const saved = conversation?.pending && conversation.clarification?.field === field &&
    conversation.candidateIds.every((id) => results.some((place) => place.id === id))
    ? conversation.clarification.value : "";
  const selected = clarify ? filter?.revision === searchRevision ? filter.value : saved : "";
  const visibleResults = selected ? results.filter((place) => place[field] === selected) : results;

  // 지금 차례가 어디까지 왔는지
  const place = searchIntent === "destination" && results.length === 1 ? results[0] : undefined;
  const confirmed = Boolean(place) && (isConfirmation(userText) || Boolean(local) || searchStartRequested);
  const hasStart = Boolean(start) && (confirmed || searchStartRequested || Boolean(conversation?.startPlaceId));
  const step = searchLoading ? "loading"
    : !userText ? "ask"
      : searchIntent === "next" ? "next"
        : searchIntent === "condition" ? "condition"
          : !results.length ? "empty"
            : !place ? "choose"
              : !confirmed && !hasStart ? "confirm"
                : !hasStart ? "start" : "route";
  const elevatorAsked = elevator && conversation?.elevator === true;
  const section = step === "route" && place
    ? elevatorSection(start.split("|")[0], shortcutAreaOf(place)) : undefined;
  const routeKey = place && hasStart ? JSON.stringify([start, place.id, elevator]) : "";

  useEffect(() => {
    if (step !== "route" || !place || !routeKey || route?.key === routeKey) return;
    let cancelled = false;
    api<Route>("routes", { start, destination: place.id, elevator })
      .then((value) => { if (!cancelled) setRoute({ key: routeKey, value }); })
      .catch((error: Error) => {
        if (!cancelled) setRoute({ key: routeKey, value: null, failed: error.message || "경로를 찾지 못했어요." });
      });
    return () => { cancelled = true; };
  }, [step, routeKey, route?.key, start, place, elevator]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length, step, searchLoading, results.length]);

  const startName = startLabel(start, registeredPlaces);
  // 지금 답을 지난 말풍선으로 남길 때 쓰는 글
  const replyText =
    step === "next" ? "먼저 목적지를 알려 주세요."
      : step === "condition" ? elevator ? "엘리베이터 길로 안내할게요. 어디로 가시나요?" : "계단 길로 안내할게요. 어디로 가시나요?"
        : step === "empty" ? "일치하는 장소를 찾지 못했어요."
          : step === "choose" ? "목적지가 여러 곳이에요. 어디를 찾으시나요?"
            : step === "confirm" ? `${withCopula(place!.name)} 맞나요?`
              : step === "start" ? `${place!.name}까지 안내할게요. 어디에서 출발하세요?`
                : step === "route" ? route?.key === routeKey && route.failed
                  ? `${startName} → ${place!.name} 경로는 안내할 수 없어요.`
                  : `${startName} → ${place!.name} 경로를 찾았어요.` : "";

  function archive() {
    if (!userText) return [] as Entry[];
    return [{ role: "user" as const, text: userText }, ...(replyText ? [{ role: "bot" as const, text: replyText }] : [])];
  }
  function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setEntries((list) => [...list, ...archive()]);
    setLocal("");
    setDraft("");
    setShowSection(false);
    setFilter(null);
    search(value);
  }
  function chooseStart(id: string, label: string) {
    setEntries((list) => [...list, ...archive()]);
    setLocal(label);
    setStart(id);
    const url = new URL(window.location.href);
    url.searchParams.set("start", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    continueConversation(label, {
      intent: "destination", conditions: {}, places: [], startPlaceId: id, startRequested: true,
      mode: "keyword", message: "",
    });
  }
  function restart() {
    setEntries([]);
    setLocal("");
    sessionStorage.removeItem(chatStorageKey);
    resetConversation();
    search("");
  }

  const summary = route?.key === routeKey && route.value?.options[0] ? routeSummary(route.value.options[0]) : null;

  return (
    <section className="chat-screen">
      <header className="chat-header">
        <button className="icon-button" aria-label="뒤로 가기" onClick={back}>
          <BackIcon size={21} />
        </button>
        <strong>
          <CampassLogo size={22} ariaHidden />
          CAMPASS에게 묻기
        </strong>
        <button className="icon-button" aria-label="홈으로" onClick={() => go("home")}>
          <CloseIcon size={21} />
        </button>
      </header>

      <div className="chat-log" aria-live="polite">
        {(entries.length > 0 || conversation) && (
          <button type="button" className="chat-restart" onClick={restart}>새 길찾기 시작</button>
        )}
        {!entries.length && !userText && (
          <Bot first>
            <p className="chat-bubble bot">어디로 가시나요? 건물 · 강의실 · 시설 이름이나 「정문에서 혜인관까지」처럼 물어보세요.</p>
            <div className="chat-pills">
              {["엘리베이터로 갈래요", "혜인관 301호 어디예요?", "본관 ↔ 혜인관"].map((text) => (
                <button key={text} type="button" onClick={() => send(text)}>{text}</button>
              ))}
            </div>
          </Bot>
        )}
        {entries.map((entry, i) => entry.role === "user"
          ? <p key={i} className="chat-bubble user">{entry.text}</p>
          : <Bot key={i} first><p className="chat-bubble bot">{entry.text}</p></Bot>)}

        {userText && <p className="chat-bubble user">{userText}</p>}

        {step === "loading" && (
          <Bot first>
            <span className="chat-bubble bot chat-typing" role="status" aria-label="답을 찾는 중"><i /><i /><i /></span>
          </Bot>
        )}

        {step === "next" && <Bot first><p className="chat-bubble bot">{replyText}</p></Bot>}

        {step === "condition" && (
          <Bot first>
            <p className="chat-bubble bot">{replyText}</p>
            {elevator && (
              <ElevatorShortcut
                busy={busy}
                onStart={(from, to) => go("prepare", { start: from, destination: to, elevator: "true" })}
              />
            )}
          </Bot>
        )}

        {step === "empty" && (
          <Bot first>
            <p className="chat-bubble bot">
              {replyText} {searchNote !== "검색 결과" && searchNote ? searchNote : "건물명, 강의실, 행사 이름을 조금 더 자세히 말해 주세요."}
            </p>
            <div className="chat-pills">
              <button type="button" onClick={() => go("prepare", { pick: "destination", start: "", destination: "", elevator: "false" })}>
                <MapIcon size={16} /> 지도에서 고를게요
              </button>
            </div>
          </Bot>
        )}

        {step === "choose" && (
          <Bot first>
            <p className="chat-bubble bot">{replyText}</p>
            {classroomBuilding && classroomSelection ? (
              <ClassroomPicker
                key={`${searchRevision}-${classroomBuilding.id}`}
                building={classroomBuilding}
                initialRoom={classroomSelection.room}
                busy={busy}
                onChoose={choose}
                onBack={() => {
                  setClassroomBuilding(null);
                  setResults(results.filter((p) => p.category === "building"));
                  setClassroomSelection({
                    ...classroomSelection, floor: "", basement: false, room: undefined,
                    pickerBuildingIds: results.filter((p) => p.category === "building").map((p) => p.id),
                  });
                }}
              />
            ) : (
              <>
                {clarify && (
                  <div className="chat-pills" aria-label={field === "building" ? "건물로 좁히기" : "층으로 좁히기"}>
                    <button className={!selected ? "active" : ""} aria-pressed={!selected}
                      onClick={() => { setFilter(null); selectClarification(field, ""); }}>전체 보기</button>
                    {groups.map((value) => (
                      <button key={value} className={selected === value ? "active" : ""} aria-pressed={selected === value}
                        onClick={() => { setFilter({ revision: searchRevision, value }); selectClarification(field, value); }}>{value}</button>
                    ))}
                  </div>
                )}
                {visibleResults.map((p) => (
                  <div className="chat-card chat-place" key={p.id}>
                    <button type="button" className="row ai-place-open" disabled={p.hours === undefined}
                      onClick={() => go("find", { tab: "facility", place: p.id })}>
                      <span className="icon-box">{p.kind ? <PlaceIcon place={p} size={20} /> : <BuildingIcon size={20} />}</span>
                      <span>
                        <strong>{p.name}</strong>
                        <span className="muted small">{[`${p.building} ${p.floor}`.trim(), p.note].filter(Boolean).join(" · ")}</span>
                        <FacilityStatus place={p} now={now} />
                      </span>
                    </button>
                    <button type="button" className="chat-place-pick" disabled={busy}
                      onClick={() => classroomSelection?.pickerBuildingIds.includes(p.id) ? setClassroomBuilding(p) : send(p.name)}>
                      여기예요
                    </button>
                  </div>
                ))}
              </>
            )}
          </Bot>
        )}

        {step === "confirm" && place && (
          <Bot first>
            <p className="chat-bubble bot">{replyText}</p>
            <div className="chat-card chat-confirm">
              <div className="chat-confirm-place">
                <span className="icon-box">{place.kind ? <PlaceIcon place={place} size={22} /> : <BuildingIcon size={22} />}</span>
                <span>
                  <strong>{place.name}</strong>
                  <span className="muted small">{floorRange(place)}</span>
                </span>
              </div>
              <div className="chat-confirm-actions">
                <button type="button" onClick={() => send("맞아요")}>맞아요</button>
                <button type="button" onClick={() => send("다른 곳이에요")}>다른 곳이에요</button>
              </div>
            </div>
          </Bot>
        )}

        {step === "start" && place && (
          <Bot first>
            <p className="chat-bubble bot">{replyText}</p>
            <div className="chat-pills">
              {startChoices.map((choice) => (
                <button key={choice.id} type="button" onClick={() => chooseStart(choice.id, choice.label)}>{choice.label}</button>
              ))}
              <button type="button" onClick={() => go("photo", { destination: place.id })}>
                <CameraIcon size={16} /> 사진으로 현재 위치
              </button>
              <button type="button" onClick={() => go("prepare", { pick: "start", destination: place.id })}>
                <MapIcon size={16} /> 지도에서 고를게요
              </button>
            </div>
          </Bot>
        )}

        {step === "route" && place && (
          <Bot first>
            {elevatorAsked && !section && (
              <p className="chat-bubble bot">아직 확인된 엘리베이터 지름길이 없어요. 일반 경로로 안내할게요</p>
            )}
            {section && (elevatorAsked || showSection) ? (
              <>
                <p className="chat-bubble bot">{section.start.name}에서 {section.destination.name}까지 계단 없는 엘리베이터 지름길이에요.</p>
                <ElevatorSectionCard
                  section={section}
                  busy={busy}
                  onStart={() => go("prepare", { start: section.start.id, destination: section.destination.id, elevator: "true" })}
                />
              </>
            ) : (
              <>
                <p className="chat-bubble bot">{replyText}</p>
                <div className="chat-card chat-route">
                  <div className="chat-route-map">
                    {summary && route?.value ? (
                      <CampusOverviewMap height={170} routePreview={{ nodes: route.value.options[0].nodes, name: "", color: "#fff3dc" }} />
                    ) : (
                      <span className="muted small" role="status">
                        {route?.key === routeKey && route.failed ? route.failed : "경로를 찾는 중이에요"}
                      </span>
                    )}
                  </div>
                  <strong>{startName} → {place.name}</strong>
                  {summary && (
                    <p className="chat-route-summary">
                      엘리베이터 {summary.elevators} · 계단 {summary.stairs} · 건물 {summary.buildings}곳 통과
                    </p>
                  )}
                  <button type="button" className="button primary" disabled={busy || Boolean(route?.key === routeKey && route.failed)} onClick={() => choose(place)}>
                    안내 시작 <ArrowRightIcon size={18} />
                  </button>
                </div>
                {section && !elevatorAsked && (
                  <div className="chat-pills">
                    <button type="button" onClick={() => setShowSection(true)}>엘리베이터 지름길 보기</button>
                  </div>
                )}
              </>
            )}
          </Bot>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="chat-input-row">
          <span className="chat-input-icon" aria-hidden="true">
            <SearchLensIcon size={22} />
          </span>
          <input
            aria-label="CAMPASS에게 묻기"
            value={draft}
            maxLength={200}
            placeholder="어디든 물어보세요"
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="chat-send" disabled={busy || !draft.trim()} aria-label="보내기">
            <ArrowRightIcon size={18} />
          </button>
        </div>
        <p className="chat-fine-print">질문은 AI(Gemini)로 해석할 수 있어요 · 이름 · 연락처는 적지 마세요</p>
      </form>
    </section>
  );
}

function Bot({ first = false, children }: { first?: boolean; children: React.ReactNode }) {
  return (
    <div className="chat-bot">
      <span className="chat-avatar" aria-hidden="true">
        {first && <CampassLogo size={26} ariaHidden />}
      </span>
      <div className="chat-bot-body">
        {first && <span className="chat-name">CAMPASS</span>}
        {children}
      </div>
    </div>
  );
}
