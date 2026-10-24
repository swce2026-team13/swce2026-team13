import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";
import { Suspense } from "react";
import { CampusProvider } from "@/components/campus-provider";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = {
  title: "캠퍼스 길찾기 · 서경대학교",
  description:
    "처음 방문해도, 사진을 따라 차근차근. 서경대학교 캠퍼스 길찾기 시연 서비스.",
};
// 하단 버튼이 env(safe-area-inset-bottom)으로 안전 영역을 피하려면 cover가 필요함
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#edf4ff",
};
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Suspense fallback={<p role="status">불러오는 중…</p>}>
          <CampusProvider>
            <AppShell>{children}</AppShell>
            {modal}
          </CampusProvider>
        </Suspense>
      </body>
    </html>
  );
}
