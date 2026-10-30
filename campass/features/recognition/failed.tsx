"use client";
import { CameraIcon, CheckIcon } from "@/components/ui/icons";
import { Notice, Photo, Tag, Upload } from "@/components/ui";
import { useCampus } from "@/features/navigation/campus-provider";
export default function Screen() {
  const { busy, preview, recognition, upload, manualPicker, recovering, go } =
    useCampus();
  return (
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
          <CameraIcon size={18} />
          위치를 찾지 못했어요
        </b>
        <p>
          {recognition?.message || "다시 촬영하거나 위치를 직접 선택해 주세요."}
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
              <CheckIcon size={17} />
            </span>
            <div>
              <b>{title}</b>
              <small>{desc}</small>
            </div>
          </div>
        ))}
      </div>
      <Upload onFile={upload} busy={busy} label="다시 찍기" />
      {/* 처음 출발이면 지도에서, 길을 잃었을 때는 위치 목록에서 선택 */}
      {recovering ? (
        manualPicker
      ) : (
        <>
          <p className="fine-print">
            사진 없이도 괜찮아요. 정문, 정류장, 주차장 중에서 직접 고르면 바로
            출발할 수 있어요.
          </p>
          <button
            type="button"
            className="text-button centered"
            onClick={() => go("prepare", { pick: "start" })}
          >
            출발 위치 직접 고르기
          </button>
        </>
      )}
    </section>
  );
}
