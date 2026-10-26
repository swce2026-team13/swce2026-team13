"use client";

import { useEffect, useState } from "react";
import Home from "@/features/search/home";
import Splash from "@/features/search/splash";

export default function Page() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false);
    }, 800);

    return () => window.clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <Splash />;
  }

  return <Home />;
}
