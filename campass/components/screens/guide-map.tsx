"use client";
import { sources } from "@/lib/catalog";
import { CampusMap, Notice, Progress, Tag } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
export default function Screen() {
  const { session, go, step, nextStep, hasSession } = useCampus();
  return (
    <>
      {!hasSession && (
        <section className="content stack">
          <Notice>진행 중인 안내가 없어요. 목적지를 선택해 주세요.</Notice>
          <button className="button primary" onClick={() => go("home")}>
            목적지 찾기
          </button>
        </section>
      )}
      {session && (
        <section className="content stack">
          {
            <Progress
              current={session!.currentStep + 1}
              total={session!.route.steps.length}
            />
          }
          <CampusMap
            route={session!.route}
            current={session?.currentStep}
            onBuilding={undefined}
          />
          {
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
      )}
    </>
  );
}
