"use client";
import { useState } from "react";
import {
  ArrowRightIcon,
  BuildingIcon,
  MapIcon,
  MessageIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { startLabel } from "@/shared/utils/route-start";
import { places } from "@/shared/utils/catalog";
import { Notice } from "@/components/ui";
import { ClassroomPicker } from "@/features/search/classroom-picker";
import { PlaceIcon } from "@/features/search/floor-places";
import { FacilityStatus, useNow } from "@/features/search/facility-status";
import { withCopula } from "@/shared/utils/hangul";
import { useCampus } from "@/features/navigation/campus-provider";
export default function Screen() {
  const now = useNow();
  const {
    query,
    setQuery,
    results,
    setResults,
    searchNote,
    searchIntent,
    searchStartRequested,
    conversation,
    resetConversation,
    selectClarification,
    start,
    registeredPlaces,
    elevator,
    classroomSelection,
    setClassroomSelection,
    classroomBuilding,
    setClassroomBuilding,
    searchRevision,
    searchLoading,
    busy,
    go,
    search,
    choose,
  } = useCampus();
  const [filter, setFilter] = useState<{ revision: number; value: string } | null>(null);
  const buildings = [...new Set(results.map((place) => place.building).filter(Boolean))];
  const field = buildings.length > 1 ? "building" : "floor";
  const groups = [...new Set(results.map((place) => place[field]).filter(Boolean))];
  const clarify = !classroomSelection && results.length > 1 && groups.length > 1;
  const saved = conversation?.pending && conversation.clarification?.field === field &&
    conversation.candidateIds.every((id) => results.some((place) => place.id === id))
    ? conversation.clarification.value : "";
  const selected = clarify ? filter?.revision === searchRevision ? filter.value : saved : "";
  const visibleResults = selected ? results.filter((place) => place[field] === selected) : results;
  return (
    <section className="content stack">
      <h1>어디를 찾으시나요?</h1>
      <form
        className="search-box glass-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) search();
        }}
      >
        <SearchIcon size={20} />
        <input
          aria-label="검색어 수정"
          value={query}
          placeholder="건물명, 강의실, 행사 검색"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={busy || !query.trim()} aria-label="다시 검색">
          <ArrowRightIcon />
        </button>
      </form>
      {conversation && (
        <button type="button" className="button secondary" onClick={() => {
          resetConversation();
          search("");
        }}>새 길찾기 시작</button>
      )}
      {!searchLoading && searchStartRequested && (
        <Notice>출발: {startLabel(start, registeredPlaces)}{start ? " · 목적지를 골라 경로를 확인해 주세요." : " · 길찾기 화면에서 출발지를 선택해 주세요."}</Notice>
      )}
      {!searchLoading && searchIntent !== "destination" && <p>{searchNote}</p>}
      {searchLoading ? (
        <div className="ai-search-flow">
          <div className="ai-user-message">{query || "목적지를 찾고 있어요"}</div>
          <div className="ai-assistant-label">
            <MessageIcon size={15} />
            <span>CAMPASS</span>
          </div>
          <div className="card ai-answer-card ai-search-loading" role="status" aria-live="polite">
            <span className="ai-answer-type">검색 중</span>
            <h3>목적지를 찾고 있어요</h3>
            <p className="muted">검색 결과를 확인하는 중이에요.</p>
            <span className="ai-search-loading-bar" aria-hidden="true" />
          </div>
        </div>
      ) : searchIntent !== "destination" ? (
        <Notice>
          {searchIntent === "next"
            ? "먼저 목적지를 알려 주세요."
            : elevator
              ? "엘리베이터로 안내할게요. 어디로 가시나요?"
              : "계단으로 안내할게요. 어디로 가시나요?"}
        </Notice>
      ) : classroomBuilding && classroomSelection ? (
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
          <div className="ai-search-flow">
  <div className="ai-user-message">
    {query || "목적지를 찾고 있어요"}
  </div>

  <div className="ai-assistant-label">
    <MessageIcon size={15} />
    <span>CAMPASS</span>
  </div>

  <div className="card ai-answer-card">
    <span className="ai-answer-type">
      목적지 찾기로 이해했어요
    </span>

    {results.length === 0 ? (
      <>
        {/* 길찾기의 '도착 변경'으로 들어오면 검색어가 비어 있음 */}
        <h3>
          {query.trim()
            ? "일치하는 장소를 찾지 못했어요"
            : "새 목적지를 입력해 주세요"}
        </h3>
        <p className="muted">
          {query.trim()
            ? searchNote === "검색 결과"
              ? "건물명, 강의실, 행사 이름을 조금 더 자세히 말해 주세요."
              : searchNote
            : "건물명, 강의실, 행사 이름으로 찾을 수 있어요. 출발지는 그대로 둘게요."}
        </p>
      </>
    ) : (
      <>
        <h3>
    {results.length === 1
      ? withCopula(results[0].name)
      : "목적지가 여러 곳이에요. 어디를 찾으시나요?"}
        </h3>

    <p className="muted">
      {results.length === 1
        ? "찾은 장소가 맞다면 아래 버튼을 눌러 주세요."
        : "원하는 목적지를 하나 골라 주세요."}
    </p>
          </>
      )}
    </div>

  {clarify && (
    <div className="card stack">
      <strong>{field === "building" ? "어느 건물에 있는 곳인가요?" : "몇 층인가요?"}</strong>
      <div className="chips" aria-label={field === "building" ? "건물로 좁히기" : "층으로 좁히기"}>
        <button className={!selected ? "active" : ""} aria-pressed={!selected}
          onClick={() => { setFilter(null); selectClarification(field, ""); }}>전체 보기</button>
        {groups.map((value) => (
          <button key={value} className={selected === value ? "active" : ""}
            aria-pressed={selected === value}
            onClick={() => { setFilter({ revision: searchRevision, value }); selectClarification(field, value); }}>{value}</button>
        ))}
      </div>
    </div>
  )}

  {visibleResults.map((p) => (
    <div className="card ai-place-card" key={p.id}>
      {/* 학교 편의시설은 카드를 누르면 편의시설 정보(A4a)로 */}
      <button
        type="button"
        className="row ai-place-open"
        disabled={p.hours === undefined}
        onClick={() => go("find", { tab: "facility", place: p.id })}
      >
        <span className="icon-box">
          {p.kind ? <PlaceIcon place={p} size={22} /> : <BuildingIcon size={22} />}
        </span>

        <span>
          <strong>{p.name}</strong>
          <span className="muted small">
            {[`${p.building} ${p.floor}`.trim(), p.note].filter(Boolean).join(" · ")}
          </span>
          <FacilityStatus place={p} now={now} />
        </span>
      </button>

      <button
        className="button primary"
        disabled={busy}
        onClick={() =>
          classroomSelection?.pickerBuildingIds.includes(p.id)
            ? setClassroomBuilding(p)
            : choose(p)
        }
      >
        여기로 길찾기
      </button>
    </div>
  ))}

    <button
    type="button"
    className="button secondary"
    onClick={() => go("prepare", { pick: "destination", start: "", destination: "", elevator: "false" })}
  >
    <MapIcon size={19} />
    캠퍼스 지도에서 직접 고르기
  </button>
</div>
      )}
      <p className="fine-print">검색 문장은 뜻을 해석하려고 외부 AI(Gemini)에 보낼 수 있어요. 이름 · 연락처 같은 개인정보는 적지 마세요.</p>
    </section>
  );
}
