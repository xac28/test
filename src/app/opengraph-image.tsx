import { ImageResponse } from "next/og"

export const alt = "AYA — Yoga ve meditasyonda canlı dersler"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The picture shown when a link to the site is shared (social networks, messengers).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 90, background: "linear-gradient(135deg,#fce6dc 0%,#fbf6ee 45%,#d6ece9 100%)", color: "#17433f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#17433f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 26, height: 26, background: "#f2bb3a", transform: "rotate(45deg)", borderRadius: 6 }} /></div>
          <div style={{ fontSize: 44, letterSpacing: 10 }}>AYA</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 84, lineHeight: 1.05, display: "flex", flexDirection: "column" }}>
          <span>Nefes, beden ve zihin için</span>
          <span style={{ color: "#e2684a", fontStyle: "italic" }}>canlı bir okul.</span>
        </div>
        <div style={{ marginTop: 36, fontSize: 32, color: "#4d6764", display: "flex" }}>Birebir dersler · Canlı yayınlar · Atölyeler · 3B poz kütüphanesi</div>
      </div>
    ),
    size,
  )
}
