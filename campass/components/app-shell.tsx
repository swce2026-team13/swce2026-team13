"use client";
import { BackIcon, CloseIcon, MapIcon } from "./ui/icons";
import { useCampus } from "../features/navigation/campus-provider";
import { screenTitle, viewForPath } from "@/shared/utils/navigation";
import { usePathname, useSearchParams } from "next/navigation";
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const recovering = useSearchParams().get("recovering") === "true";
  const view = viewForPath(pathname);
  const { busy, error, setError, go, back, displayDestination, routeLoading } =
    useCampus();
  return (
    <div className={`phone ${view === "photo" ? "photo-shell" : ""}`}>
      {view !== "home" && (
        <header
          className={`app-header ${view === "photo" ? "photo-app-header" : ""}`}
        >
          <button className="icon-button" aria-label="뒤로 가기" onClick={back}>
            <BackIcon size={21} />
          </button>
          <strong>{screenTitle(view, displayDestination, recovering)}</strong>
          {view === "guide" ? (
            <button
              className="icon-button"
              aria-label="안내 중 지도 보기"
              onClick={() => go("guide-map")}
            >
              <MapIcon size={21} />
            </button>
          ) : (
            <button
              className="icon-button"
              aria-label="홈으로"
              onClick={() => go("home")}
            >
              <CloseIcon size={21} />
            </button>
          )}
        </header>
      )}
      {error && !routeLoading && (
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
      <main id="main-content" key={pathname}>
        {children}
      </main>
    </div>
  );
}
