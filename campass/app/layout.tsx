import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";
import { Suspense } from "react";
import { CampusProvider } from "@/components/campus-provider";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = {
  title: "CAMPASS · 서경대학교 캠퍼스 길찾기",
  description:
    "지도와 사진 인식으로 서경대학교 캠퍼스에서 목적지까지 안내하는 CAMPASS 길찾기 서비스",
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
