"use client";
import { Building2, ChevronRight } from "lucide-react";
import { places, sources } from "@/lib/catalog";
import { CampusMap } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
export default function Screen() {
  const { session, browseBuilding } = useCampus();
  return (
    <>
      {
        <section className="content stack">
          {
            <>
              <h1>어느 건물을 찾으세요?</h1>
              <p>건물을 선택하면 주요 장소를 확인할 수 있어요.</p>
            </>
          }
          <CampusMap
            route={undefined}
            current={session?.currentStep}
            onBuilding={browseBuilding}
          />
          {
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
          }
          <a
            className="text-button centered"
            href={sources.map}
            target="_blank"
            rel="noreferrer"
          >
            서경대학교 공식 캠퍼스맵 ↗
          </a>
        </section>
      }
    </>
  );
}
