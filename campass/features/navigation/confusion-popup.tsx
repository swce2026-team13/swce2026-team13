"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp, Lightbulb, TriangleAlert } from "lucide-react";
import { ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import { findTip, reasonText } from "@/shared/utils/confusion-reasons";

export type ConfusionPoint = {
  id: string;
  name: string;
  passages: number;
  confusions: number;
  rate: number;
  topReason?: string | null;
};

// 경로 상세 시트의 「⚠ 헤매기 쉬운 구간 · {장소} ›」 한 줄 띠. 누르면 같은 화면 위에 팝업
export function ConfusionStrip({ points, demo }: { points: ConfusionPoint[]; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const strip = useRef<HTMLButtonElement>(null);
  if (!points.length) return null;
  const first = points[0];
  return (
    <>
      <button
        ref={strip}
        type="button"
        className="confusion-strip"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <TriangleAlert size={16} aria-hidden="true" />
        <span>
          헤매기 쉬운 구간 · {first.name}
          {points.length > 1 && ` 외 ${points.length - 1}곳`}
        </span>
        <ChevronRightIcon size={16} />
      </button>
      {open && (
        <ConfusionDialog
          points={points}
          demo={demo}
          onClose={() => {
            setOpen(false);
            // 닫히면 띠로 포커스를 돌려줌
            strip.current?.focus();
          }}
        />
      )}
    </>
  );
}

function ConfusionDialog({
  points,
  demo,
  onClose,
}: {
  points: ConfusionPoint[];
  demo: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    // 열리면 팝업 카드로 포커스
    element.focus();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confusion-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // 카드 바깥(어두운 막)을 누르면 닫힘
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="confusion-dialog-card">
        <button type="button" className="confusion-dialog-close" aria-label="닫기" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
        <h2 id={titleId} className="confusion-dialog-title">
          <TriangleAlert size={23} aria-hidden="true" />
          헤매기 쉬운 구간
        </h2>
        {points.map((point) => (
          <section key={point.id} className="confusion-dialog-point">
            <strong className="confusion-dialog-place">{point.name}</strong>
            <p className="confusion-dialog-count">
              {point.passages}명 중 {point.confusions}명이 여기서 위치를 다시 확인했어요
            </p>
            <dl className="confusion-dialog-box">
              <div>
                <dt><CircleHelp size={16} aria-hidden="true" /> 왜 헤매나요</dt>
                <dd>{reasonText(point.topReason)}</dd>
              </div>
              <div>
                <dt><Lightbulb size={16} aria-hidden="true" /> 이렇게 찾으세요</dt>
                <dd>{findTip(point.id)}</dd>
              </div>
            </dl>
          </section>
        ))}
        {demo && <p className="confusion-dialog-demo">시연용 예시 기록이 포함돼 있어요</p>}
      </div>
    </dialog>
  );
}
