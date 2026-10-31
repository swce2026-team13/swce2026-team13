"use client";

import { useEffect, useId, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloseIcon } from "./icons";
import { useCampus } from "../../features/navigation/campus-provider";
import { routes } from "@/shared/utils/navigation";

const modalPaths = new Set<string>([routes.help]);

// 팝업을 연 요소의 이름표. 주소가 바뀌면 <main key={pathname}>이 화면을 다시 그려
// 원래 요소가 사라지므로, 닫은 뒤 같은 이름표의 요소를 다시 찾아 포커스를 돌려줌
// 사파리는 버튼을 눌러도 포커스를 주지 않아서, 누른 버튼도 함께 기억함
let openerLabel: string | null = null;
const remember = (event: Event) => {
  const target = (event.target as Element).closest?.("button, a, input, [tabindex]");
  if (target && !target.closest("dialog")) openerLabel = target.getAttribute("aria-label");
};
if (typeof document !== "undefined") {
  document.addEventListener("focusin", remember, true);
  document.addEventListener("pointerdown", remember, true);
}

// 닫은 직후 홈이 다시 그려지며 포커스가 body로 빠질 수 있어, 잠깐 동안 몇 번 확인해 원래 버튼으로 돌려줌
function restoreFocus(previous: HTMLElement | null, label: string | null) {
  const attempt = () => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    if (previous?.isConnected && previous !== document.body) return previous.focus();
    const target = label ? document.querySelector(`[aria-label="${CSS.escape(label)}"]`) : null;
    if (target instanceof HTMLElement) target.focus();
  };
  // 처음 여는 경로는 개발 서버에서 늦게 다시 그려질 수 있어 2초까지 확인
  for (const delay of [0, 100, 250, 500, 1000, 2000]) setTimeout(attempt, delay);
}

export function RouteModal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const visible = modalPaths.has(usePathname());
  const { error, setError, busy } = useCampus();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!visible) return;
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const label = openerLabel;
    const overflow = document.body.style.overflow;
    element.showModal();
    titleRef.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      restoreFocus(previous, label);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    // 모든 팝업이 같은 하단 시트 모양을 씀: 손잡이 · 제목 · 닫기, 내용만 시트 안에서 스크롤
    <dialog
      ref={dialog}
      className="sheet-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        router.back();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          router.back();
      }}
    >
      <span className="sheet-modal-handle" aria-hidden="true" />
      <header className="sheet-modal-header">
        <strong
          ref={titleRef}
          id={titleId}
          className="route-modal-title"
          tabIndex={-1}
        >
          {title}
        </strong>
        <button
          className="sheet-modal-close"
          aria-label="닫기"
          onClick={() => router.back()}
        >
          <CloseIcon size={22} />
        </button>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="오류 닫기" onClick={() => setError("")}>
            <CloseIcon size={17} />
          </button>
        </div>
      )}
      {busy && (
        <div className="loading-line" role="status" aria-label="처리 중" />
      )}
      <div className="sheet-modal-body">{children}</div>
    </dialog>
  );
}
