"use client";
import {
  ArrowRight,
  Building2,
  Map,
  MessageSquareText,
  Search,
} from "lucide-react";
import { places } from "@/shared/utils/catalog";
import { Notice } from "@/components/ui";
import { ClassroomPicker } from "@/features/search/classroom-picker";
import { useCampus } from "@/features/navigation/campus-provider";
export default function Screen() {
  const {
    query,
    setQuery,
    results,
    setResults,
    searchNote,
    searchIntent,
    elevator,
    classroomSelection,
    setClassroomSelection,
    classroomBuilding,
    setClassroomBuilding,
    searchRevision,
    busy,
    go,
    search,
    choose,
  } = useCampus();
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
      {searchIntent !== "destination" && <p>{searchNote}</p>}
      {searchIntent !== "destination" ? (
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
            <MessageSquareText size={15} />
            <span>CAMPASS</span>
          </div>

          <div className="card ai-answer-card">
            <span className="ai-answer-type">목적지 찾기로 이해했어요</span>

            {results.length === 0 ? (
              <>
                <h3>일치하는 장소를 찾지 못했어요</h3>
                <p className="muted">
                  건물명, 강의실, 행사 이름을 조금 더 자세히 말해 주세요.
                </p>
              </>
            ) : (
              <>
                <h3>
                  {results.length === 1
                    ? `${results[0].name}이에요`
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

          {results.map((p) => (
            <div className="card ai-place-card" key={p.id}>
              <div className="row">
                <span className="icon-box">
                  <Building2 size={22} />
                </span>

                <div>
                  <strong>{p.name}</strong>
                  <p className="muted small">
                    {p.building} {p.floor}
                  </p>
                </div>
              </div>

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
            onClick={() => go("map")}
          >
            <Map size={19} />
            캠퍼스 지도에서 직접 고르기
          </button>
        </div>
      )}
    </section>
  );
}
