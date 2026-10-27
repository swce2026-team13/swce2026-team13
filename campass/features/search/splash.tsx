"use client";

import { useEffect, useRef } from "react";
import { Compass } from "lucide-react";

// 막대가 다 찬 모습을 잠깐 보여 준 뒤 넘어감
const HOLD_MS = 150;
// 애니메이션 종료 신호가 오지 않을 때를 대비한 상한
const FALLBACK_MS = 2000;

export default function Splash({ onDone }: { onDone: () => void }) {
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = bar.current!;
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onDone, HOLD_MS);
    };
    // 움직임 줄이기 설정으로 애니메이션이 꺼졌거나 이미 끝났으면 종료 신호가 오지 않으므로 바로 넘어감
    if (!element.getAnimations().some((a) => a.playState === "running")) {
      finish();
    } else {
      element.addEventListener("animationend", finish);
      timer = window.setTimeout(onDone, FALLBACK_MS);
    }
    return () => {
      element.removeEventListener("animationend", finish);
      window.clearTimeout(timer);
    };
  }, [onDone]);

  return (
    <main className="splash-screen">
      <div className="splash-center">
        <div className="splash-logo">
          <Compass strokeWidth={1.65} />
        </div>

        <h1 className="splash-title">
          CAM<span>PASS</span>
        </h1>

        <div className="splash-loading">
          <span ref={bar} />
        </div>
      </div>

      <p className="splash-footer">
        © 2026 서경대학교 · CAMPASS
      </p>
    </main>
  );
}
