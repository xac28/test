"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useL } from "@/components/editorial"

const KEY = "aya-cookie-notice"

/**
 * AYA only uses cookies that the site cannot work without (sign-in session, language) and no tracking or advertising ones,
 * so this is an information bar, not a consent wall. It sits above the navigation (in the page flow, never over buttons).
 */
export function CookieNotice() {
  const L = useL()
  const [show, setShow] = useState(false)
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true) } catch { setShow(true) }
  }, [])
  if (!show) return null
  return (
    <div role="region" aria-label={L("Çerez bilgilendirmesi", "Cookie notice")} data-testid="cookie-notice" className="bg-ink text-cream text-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
        <p className="flex-1 min-w-[16rem] leading-snug text-cream/90">
          {L("AYA yalnızca oturum ve dil tercihi gibi zorunlu çerezleri kullanır; reklam veya izleme çerezi yoktur.", "AYA only uses strictly necessary cookies (sign-in session, language); there are no advertising or tracking cookies.")}{" "}
          <Link href="/cerezler" className="tap-area underline underline-offset-4 hover:text-white">{L("Ayrıntılar", "Details")}</Link>
        </p>
        <button
          type="button"
          data-testid="cookie-ok"
          onClick={() => { try { localStorage.setItem(KEY, "1") } catch {} setShow(false) }}
          className="min-h-[44px] px-4 font-semibold underline underline-offset-4 hover:text-white"
        >
          {L("Anladım", "Got it")}
        </button>
      </div>
    </div>
  )
}
