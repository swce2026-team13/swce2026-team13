"use client";
import { CheckCircle2 } from "lucide-react";
import { waypoints } from "@/lib/routing";
import { Notice, Photo, Tag } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
export default function Screen() {
  const {
    busy,
    preview,
    recognition,
    candidate,
    setCandidate,
    recovering,
    go,
    confirmLocation,
    manualPicker,
  } = useCampus();
  return (
    <>
      <section className="content stack">
        <h1>
          {recovering ? "지금 위치를 다시 찾았어요" : "사진 속 위치가 맞나요?"}
        </h1>
        <p>
          촬영한 주변 모습과 등록 사진을 비교했어요. 주변을 확인한 뒤 위치를
          선택해 주세요.
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
              <h3>{waypoints.find((w) => w.id === c.waypointId)?.name}</h3>
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
          <Notice>사진을 먼저 업로드하거나 위치를 직접 선택해 주세요.</Notice>
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
        <button className="text-button centered" onClick={() => go("photo")}>
          다시 촬영
        </button>
      </div>
    </>
  );
}
