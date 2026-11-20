"use client"

import { useEffect, useState } from "react"
import { Sparkles, X } from "lucide-react"

interface ActiveCampaign { active: true; id: string; name: string; discountPct: number; scope: "STUDENTS" | "TEACHERS" | "ALL"; bannerMessage: string | null }

const DISMISS_KEY = (id: string) => `aya-campaign-dismissed-${id}`

/** The currently-running campaign (if any), announced in a thin strip above the nav — dismissible per browser, per campaign. */
export function CampaignBanner() {
  const [c, setC] = useState<ActiveCampaign | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch("/api/campaigns/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.active) return
        setC(d)
        try { setDismissed(sessionStorage.getItem(DISMISS_KEY(d.id)) === "1") } catch { /* private mode */ }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!c || dismissed) return null
  const dismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY(c.id), "1") } catch { /* private mode */ }
  }

  return (
    <div data-testid="campaign-banner" className="flex items-center justify-center gap-2.5 bg-ink px-4 py-2 text-center text-xs font-medium text-cream sm:text-sm">
      <Sparkles size={14} className="shrink-0 text-saffron-300" />
      <span className="truncate">{c.bannerMessage || `${c.name}: derslerde %${c.discountPct} indirim!`}</span>
      <button type="button" onClick={dismiss} aria-label="Kapat" data-testid="campaign-banner-dismiss" className="ml-1 shrink-0 rounded-full p-0.5 text-cream/70 hover:text-cream">
        <X size={14} />
      </button>
    </div>
  )
}
