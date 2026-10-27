"use client";

import { useCallback, useState } from "react";
import Home from "@/features/search/home";
import Splash from "@/features/search/splash";

// 시작 화면은 앱을 처음 열 때 한 번만 표시. 앱 안에서 홈으로 돌아오면 바로 홈
let splashDone = false;

export default function Page() {
  const [showSplash, setShowSplash] = useState(() => !splashDone);
  const finish = useCallback(() => {
    splashDone = true;
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <Splash onDone={finish} />;
  }

  return <Home />;
}
