"use client";
import { ArrowLeft, Map, X } from "lucide-react";
import { useCampus } from "../features/navigation/campus-provider";
import { titles, viewForPath } from "@/shared/utils/navigation";
import { usePathname } from "next/navigation";
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const view = viewForPath(pathname);
  const { busy, error, setError, go, back, displayDestination } = useCampus();
  return (
    <div className="phone">
      {view !== "home" && (
        <header className="app-header">
          <button className="icon-button" aria-label="뒤로 가기" onClick={back}>
            <ArrowLeft size={21} />
          </button>
          <strong>
            {view === "guide"
              ? `${displayDestination.building} ${displayDestination.name}`
              : titles[view]}
          </strong>
          {view === "guide" ? (
            <button
              className="icon-button"
              aria-label="안내 중 지도 보기"
              onClick={() => go("guide-map")}
            >
              <Map size={21} />
            </button>
          ) : (
            <button
              className="icon-button"
              aria-label="홈으로"
              onClick={() => go("home")}
            >
              <X size={21} />
            </button>
          )}
        </header>
      )}
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
      <main id="main-content" key={pathname}>
        {children}
      </main>
    </div>
  );
}
