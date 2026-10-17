"use client";
import { ArrowRight, Building2, ChevronRight, Search } from "lucide-react";
import { places } from "@/lib/catalog";
import { Notice, Tag } from "@/components/ui";
import { ClassroomPicker } from "@/components/classroom-picker";
import { useCampus } from "@/components/campus-provider";
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
    search,
    choose,
  } = useCampus();
  return (
    <>
      {
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
          <p>{searchNote}</p>
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
      }
    </>
  );
}
