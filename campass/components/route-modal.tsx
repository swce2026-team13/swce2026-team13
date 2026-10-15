"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCampus } from "./campus-provider";

export function RouteModal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { error, setError, busy } = useCampus();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="route-modal"
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
      <header className="app-header">
        <strong id={titleId}>{title}</strong>
        <button
          className="icon-button"
          aria-label="모달 닫기"
          onClick={() => router.back()}
          autoFocus
        >
          <X size={21} />
        </button>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="오류 닫기" onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {busy && (
        <div className="loading-line" role="status" aria-label="처리 중" />
      )}
      {children}
    </dialog>
  );
}
