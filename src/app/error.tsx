"use client"

import { useEffect } from "react"
import Link from "next/link"

// Shown when a page fails while rendering; the rest of the app (navbar etc.) keeps working because this sits inside the layout.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ROUTE_ERROR]", error)
  }, [error])
  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center" data-testid="route-error">
      <p className="eyebrow mb-4">Bir sorun oluştu</p>
      <h1 className="font-display text-4xl md:text-5xl leading-tight">Bu sayfa şu an <em className="italic text-clay-600">açılamadı.</em></h1>
      <p className="mt-4 text-sage-600">Kısa bir süre sonra yeniden deneyebilirsin. Sorun sürerse canlı destekten bize yaz.</p>
      {error.digest && <p className="mt-2 text-xs text-sage-400">Hata kodu: {error.digest}</p>}
      <div className="mt-8 flex justify-center gap-3">
        <button onClick={reset} className="btn-cta">Yeniden dene</button>
        <Link href="/" className="btn-ghost">Ana sayfa</Link>
      </div>
    </main>
  )
}
