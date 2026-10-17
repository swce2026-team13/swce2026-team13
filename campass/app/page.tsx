"use client";

import { useEffect, useState } from "react";
import Home from "@/components/screens/home";
import Splash from "@/components/screens/splash";

export default function Page() {
  const [showSplash, setShowSplash] = useState<boolean | null>(null);

  useEffect(() => {
  setShowSplash(true);

  const timer = window.setTimeout(() => {
    setShowSplash(false);
  }, 800);

  return () => window.clearTimeout(timer);
}, []);

  if (showSplash === null) {
    return null;
  }

  if (showSplash) {
    return <Splash />;
  }

  return <Home />;
}