"use client";
import { Camera } from "lucide-react";
import { Notice, Upload } from "@/components/ui";
import { useCampus } from "@/features/navigation/campus-provider";
export default function Screen() {
  const { busy, vision, recovering, upload, manualPicker } = useCampus();
  return (
    <section className="content stack">
      <h1>
        {recovering
          ? "주변 모습을 다시 찍어주세요"
          : "사진으로 출발 위치를 찾아요"}
      </h1>
      <p>입구, 통로, 주변 표지판이 함께 보이게 촬영해 주세요.</p>
      <div className="capture-placeholder">
        <Camera size={42} />
        <b>주변을 한 장에 담아주세요</b>
        <small>JPG · PNG · WebP / 최대 5MB</small>
      </div>
      <Upload onFile={upload} busy={busy} />
      {!vision && (
        <Notice tone="amber">
          <b>사진 인식 기능을 준비하고 있어요</b>
          <p>지금은 출발 위치를 직접 선택할 수 있어요.</p>
        </Notice>
      )}
      {manualPicker}
    </section>
  );
}
