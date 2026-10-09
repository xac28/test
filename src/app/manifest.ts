import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AYA — Yoga ve meditasyonda canlı dersler",
    short_name: "AYA",
    description: "Sertifikalı eğitmenlerle birebir dersler, canlı yayınlar ve atölyeler.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f7fd",
    theme_color: "#f2f7fd",
    lang: "tr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  }
}
