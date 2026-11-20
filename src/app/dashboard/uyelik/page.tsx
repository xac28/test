"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, CreditCard, Crown, Radio, Sparkles } from "lucide-react"
import { INTERVAL_LABEL, PLAN_FEATURES, PLAN_LABEL, formatTL, type BillingInterval, type PaidPlan, type PlanId } from "@/lib/subscriptions"

interface Membership {
  plan: PlanId
  periodEnd: string | null
  subscription: { id: string; plan: PaidPlan; interval: BillingInterval; status: string; priceKurus: number; currentPeriodEnd: string | null; canceledAt: string | null } | null
  passes: { used: number; limit: number | null; month: string } | null
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "—")

const BANNER: Record<string, { tone: string; text: string }> = {
  ok: { tone: "bg-emerald-50 border-emerald-200 text-emerald-800", text: "Ödemen alındı, üyeliğin aktif. Hoş geldin! 🙏" },
  red: { tone: "bg-red-50 border-red-200 text-red-800", text: "Ödeme onaylanmadı, kartından para çekilmedi. Bilgileri kontrol edip tekrar deneyebilirsin." },
  hata: { tone: "bg-red-50 border-red-200 text-red-800", text: "Ödeme sonucu doğrulanamadı. Kartından çekim yapıldıysa birkaç dakika içinde üyeliğin açılır; açılmazsa Canlı Destek'e yaz." },
}

export default function MembershipPage() {
  const params = useSearchParams()
  const [m, setM] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const result = params.get("odeme")

  const load = useCallback(async () => {
    const r = await fetch("/api/subscriptions", { cache: "no-store" }).then((x) => x.json()).catch(() => null)
    setM(r?.membership ?? null)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const cancel = async () => {
    setBusy(true)
    setError("")
    const r = await fetch("/api/subscriptions", { method: "DELETE" })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    setConfirming(false)
    if (!r.ok) return setError(d.error || "İptal edilemedi.")
    load()
  }

  const paid = m && m.plan !== "FREE"
  const sub = m?.subscription
  const canceled = sub?.status === "CANCELED"

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-3xl md:text-[2.5rem] leading-[1.1] text-ink flex items-center gap-3"><CreditCard size={30} /> Üyeliğim</h1>
        <p className="text-sage-600 mt-2">Planını, yenileme tarihini ve bu ayki özel yayın haklarını buradan takip edebilirsin.</p>
      </header>

      {result && BANNER[result] && <div role="status" data-testid="membership-result" className={`border rounded-xl px-4 py-3 text-sm ${BANNER[result].tone}`}>{BANNER[result].text}</div>}

      {loading ? (
        <div className="h-48 rounded-2xl bg-sage-50 animate-pulse" />
      ) : (
        <section data-testid="membership-card" className={`relative overflow-hidden rounded-2xl border p-6 md:p-8 ${paid ? "bg-ink text-cream border-ink" : "bg-paper border-rule"}`}>
          {paid && <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-clay-500/25 blur-3xl" />}
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={`eyebrow ${paid ? "!text-cream/60" : ""}`}>Şu anki plan</p>
              <h2 className="font-display text-4xl mt-1 flex items-center gap-3" data-testid="membership-plan">
                {m?.plan === "UNLIMITED" ? <Crown className="text-amber-300" size={30} /> : m?.plan === "PREMIUM" ? <Sparkles className="text-clay-300" size={28} /> : null}
                {PLAN_LABEL[m?.plan ?? "FREE"]}
              </h2>
              {paid && sub && (
                <p className="text-sm text-cream/70 mt-2">
                  {INTERVAL_LABEL[sub.interval]} · {formatTL(sub.priceKurus)} ·{" "}
                  {canceled ? <>iptal edildi, <strong className="text-cream">{date(m!.periodEnd)}</strong> tarihine kadar geçerli</> : <>sonraki yenileme <strong className="text-cream">{date(m!.periodEnd)}</strong></>}
                </p>
              )}
            </div>
            {!paid && (
              <Link href="/pricing" data-testid="see-plans" className="inline-flex items-center gap-2 bg-clay-500 hover:bg-clay-400 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
                Planları gör
              </Link>
            )}
          </div>

          {paid && m?.passes && (
            <div className="relative mt-8">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-cream/80"><Radio size={15} /> Özel ($) canlı yayın hakkı · bu ay</span>
                <span data-testid="membership-passes" className="font-semibold">{m.passes.limit === null ? `${m.passes.used} katılım · sınırsız` : `${m.passes.used} / ${m.passes.limit}`}</span>
              </div>
              {m.passes.limit !== null && (
                <div className="mt-2 h-2 rounded-full bg-cream/15 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-clay-400 to-amber-300 transition-[width] duration-700" style={{ width: `${Math.min(100, (m.passes.used / m.passes.limit) * 100)}%` }} />
                </div>
              )}
            </div>
          )}

          <ul className={`relative mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm ${paid ? "text-cream/85" : "text-sage-700"}`}>
            {PLAN_FEATURES[m?.plan ?? "FREE"].map((f) => (
              <li key={f} className="flex items-start gap-2"><Check size={15} className={`mt-0.5 shrink-0 ${paid ? "text-clay-300" : "text-clay-500"}`} />{f}</li>
            ))}
          </ul>
        </section>
      )}

      {paid && sub?.status === "ACTIVE" && (
        <section className="border border-rule rounded-xl p-5 bg-paper">
          <h3 className="font-semibold text-ink">Aboneliği iptal et</h3>
          <p className="text-sm text-sage-600 mt-1">İptal edersen kartından bir daha çekim yapılmaz; ödediğin dönem bitene kadar ({date(m!.periodEnd)}) tüm hakların sürer.</p>
          {error && <p className="text-sm text-red-700 mt-3" role="alert">{error}</p>}
          {confirming ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={cancel} disabled={busy} data-testid="confirm-cancel-membership" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-60">{busy ? "İptal ediliyor…" : "Evet, iptal et"}</button>
              <button onClick={() => setConfirming(false)} className="border border-rule px-5 py-2 rounded-full text-sm">Vazgeç</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} data-testid="cancel-membership" className="mt-4 border border-red-300 text-red-700 hover:bg-red-50 px-5 py-2 rounded-full text-sm font-semibold">Aboneliği iptal et</button>
          )}
        </section>
      )}

      {paid && canceled && (
        <p className="text-sm text-sage-600">Yeniden abone olmak istersen dönem bittikten sonra <Link href="/pricing" className="underline">planlar</Link> sayfasından tekrar seçebilirsin.</p>
      )}
    </div>
  )
}
