"use client";

import { Compass } from "lucide-react";

export default function Splash() {
  return (
    <main className="splash-screen">
      <div className="splash-center">
        <div className="splash-logo">
          <Compass />
        </div>

        <h1 className="splash-title">
          CAM<span>PASS</span>
        </h1>

        <div className="splash-loading">
          <span />
        </div>
      </div>

      <p className="splash-footer">© 2026 서경대학교 · CAMPASS</p>
    </main>
  );
}
