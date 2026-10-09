import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";
export const metadata: Metadata = {
  title: "캠퍼스 길찾기 · 서경대학교",
  description:
    "처음 방문해도, 사진을 따라 차근차근. 서경대학교 캠퍼스 길찾기 시연 서비스.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
