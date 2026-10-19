import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CAMPASS",
    short_name: "CAMPASS",
    description: "서경대학교 캠퍼스 길찾기 서비스",
    start_url: "/",
    display: "standalone",
    background_color: "#edf4ff",
    theme_color: "#edf4ff",
    icons: [
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}