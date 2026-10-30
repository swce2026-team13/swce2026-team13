"use client";

import { useCallback, useState } from "react";
import Home from "@/features/search/home";
import Splash from "@/features/search/splash";

// 시작 화면은 앱을 처음 열었을 때 한 번만 표시
let splashDone = false;

export default function Page() {
  const [showSplash, setShowSplash] = useState(() => !splashDone);
  const [homeVisible, setHomeVisible] = useState(() => splashDone);

  const finish = useCallback(() => {
    splashDone = true;
    setShowSplash(false);

    requestAnimationFrame(() => {
      setHomeVisible(true);
    });
  }, []);

  return (
    <div className="page-transition-root">
      {showSplash && <Splash onDone={finish} />}

      {!showSplash && (
        <div
          className={`home-transition ${
            homeVisible ? "is-visible" : ""
          }`}
        >
          <Home />
        </div>
      )}
    </div>
  );
}