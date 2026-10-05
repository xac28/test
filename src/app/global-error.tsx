"use client"

// Last resort: the root layout itself failed. Plain markup, no dependencies.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbf6ee", color: "#17433f", display: "grid", placeItems: "center", minHeight: "100vh", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontWeight: 400, fontSize: 36 }}>AYA şu an açılamadı</h1>
          <p style={{ color: "#4d6764" }}>Lütfen birkaç saniye sonra yeniden dene.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 24px", borderRadius: 999, border: 0, background: "#17433f", color: "#fff", fontSize: 16, cursor: "pointer" }}>Yeniden dene</button>
        </div>
      </body>
    </html>
  )
}
