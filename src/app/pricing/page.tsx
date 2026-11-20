"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { PayForm } from "@/components/iyzico-pay-form"
import { ArrowRight, Check, Crown, Lock, ShieldCheck, Sparkles, X } from "lucide-react"
import { PLAN_FEATURES, PLAN_LABEL, formatTL, type BillingInterval, type PaidPlan, type PlanId } from "@/lib/subscriptions"

interface Info {
  available: boolean
  prices: Record<PaidPlan, Record<BillingInterval, number>>
  membership: { plan: PlanId; subscription: { status: string } | null } | null
}

const PLANS: { id: PlanId; eyebrow: string; blurb: string; icon?: typeof Crown }[] = [
  { id: "FREE", eyebrow: "Explore", blurb: "Ders başına öde, platformu tanı." },
  { id: "PREMIUM", eyebrow: "Premium", blurb: "Her ay farklı eğitmenlerin özel yayınlarına katıl.", icon: Sparkles },
  { id: "UNLIMITED", eyebrow: "Unlimited", blurb: "Bütün özel yayınlar, istediğin kadar.", icon: Crown },
]

export default function PricingPage() {
  const router = useRouter()
  const [interval, setInterval] = useState<BillingInterval>("MONTHLY")
  const [info, setInfo] = useState<Info | null>(null)
  const [chosen, setChosen] = useState<PaidPlan | null>(null)

  useEffect(() => {
    fetch("/api/subscriptions", { cache: "no-store" }).then((r) => r.json()).then(setInfo).catch(() => {})
  }, [])

  const member = info?.membership && info.membership.plan !== "FREE"
  const choose = (plan: PlanId) => {
    if (plan === "FREE") return
    if (info && !info.membership) return router.push(`/login?callbackUrl=${encodeURIComponent("/pricing")}`)
    if (member) return router.push("/dashboard/uyelik")
    setChosen(plan)
  }

  const yearlySaving = (p: PaidPlan) => (info ? info.prices[p].MONTHLY * 12 - info.prices[p].YEARLY : 0)

  return (
    <>
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-rule">
          <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-clay-200/40 blur-3xl motion-safe:animate-[drift_18s_ease-in-out_infinite_alternate]" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-12">
            <p className="eyebrow mb-4">Üyelik</p>
            <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.0] max-w-4xl">
              Pratiğine uygun <em className="italic text-clay-500">planı seç.</em>
            </h1>
            <p className="mt-6 text-lg text-sage-600 max-w-2xl">
              Eğitmenlerin öğrencilerine özel ($) canlı yayınlarına üyelikle katıl, birebir derslerde indirim kazan. İstediğin zaman iptal edebilirsin; ödediğin dönem sonuna kadar sürer.
            </p>
            <div className="inline-flex items-center gap-1 mt-8 p-1 border border-rule rounded-full bg-paper" role="group" aria-label="Ödeme dönemi">
              {(["MONTHLY", "YEARLY"] as const).map((v) => (
                <button
                  key={v}
                  data-testid={`interval-${v}`}
                  onClick={() => setInterval(v)}
                  aria-pressed={interval === v}
                  className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-300 ${interval === v ? "bg-ink text-cream shadow-sm" : "text-sage-600 hover:text-ink"}`}
                >
                  {v === "MONTHLY" ? "Aylık" : "Yıllık"}
                  {v === "YEARLY" && <span className={`ml-2 text-[11px] font-bold ${interval === v ? "text-clay-300" : "text-clay-500"}`}>2+ ay hediye</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => {
              const featured = plan.id === "PREMIUM"
              const price = plan.id === "FREE" || !info ? null : info.prices[plan.id][interval]
              const current = info?.membership?.plan === plan.id
              const Icon = plan.icon
              return (
                <article
                  key={plan.id}
                  data-testid={`plan-${plan.id}`}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className={`group relative flex flex-col rounded-2xl border p-8 lg:p-10 transition-all duration-300 motion-safe:animate-[rise_.6s_cubic-bezier(.2,.7,.2,1)_both] hover:-translate-y-1 hover:shadow-xl ${featured ? "bg-ink text-cream border-ink shadow-lg" : "bg-paper border-rule"}`}
                >
                  {featured && <span className="absolute -top-3 left-8 bg-clay-500 text-white text-[11px] font-bold tracking-[0.14em] uppercase px-3 py-1 rounded-full">En çok tercih edilen</span>}
                  <div className="flex items-center justify-between mb-6">
                    <p className={`eyebrow ${featured ? "!text-cream/60" : ""}`}>{plan.eyebrow}</p>
                    {Icon && <Icon size={20} className={featured ? "text-clay-300" : "text-amber-500"} />}
                  </div>
                  <h2 className="font-display text-4xl">{PLAN_LABEL[plan.id]}</h2>
                  <p className={`mt-2 text-sm ${featured ? "text-cream/70" : "text-sage-600"}`}>{plan.blurb}</p>
                  <p className="mt-8 mb-1 min-h-[3.5rem]">
                    {plan.id === "FREE" ? (
                      <span className="font-display text-5xl">Ücretsiz</span>
                    ) : price === null ? (
                      <span className="inline-block h-12 w-40 rounded bg-current opacity-10 animate-pulse" />
                    ) : (
                      <>
                        <span className="font-display text-5xl" data-testid={`price-${plan.id}`}>{formatTL(price)}</span>
                        <span className={`text-sm ml-1 ${featured ? "text-cream/60" : "text-sage-500"}`}>{interval === "MONTHLY" ? "/ay" : "/yıl"}</span>
                      </>
                    )}
                  </p>
                  <p className={`text-xs mb-8 h-4 ${featured ? "text-clay-300" : "text-clay-600"}`}>
                    {plan.id !== "FREE" && interval === "YEARLY" && info ? `Aylığa göre ${formatTL(yearlySaving(plan.id))} tasarruf` : ""}
                  </p>
                  <ul className="space-y-3 mb-10 flex-1">
                    {PLAN_FEATURES[plan.id].map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check size={16} className={`mt-0.5 shrink-0 ${featured ? "text-clay-300" : "text-clay-500"}`} />
                        <span className={featured ? "text-cream/85" : "text-sage-700"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.id === "FREE" ? (
                    <span className={`w-full py-3.5 text-sm font-semibold text-center rounded-full border ${featured ? "border-cream/30" : "border-rule text-sage-500"}`}>
                      {info?.membership && !member ? "Mevcut planın" : "Herkese açık"}
                    </span>
                  ) : (
                    <button
                      data-testid={`choose-${plan.id}`}
                      onClick={() => choose(plan.id)}
                      disabled={!info || (!info.available && !member)}
                      className={`w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 rounded-full transition-all duration-200 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                        featured ? "bg-clay-500 hover:bg-clay-400 text-white" : "bg-ink text-cream hover:bg-sage-800"
                      }`}
                    >
                      {current ? "Üyeliğini yönet" : member ? "Üyeliğim" : info && !info.available ? "Yakında" : `${PLAN_LABEL[plan.id]}'a geç`}
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </button>
                  )}
                </article>
              )
            })}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-2 text-sage-500 text-sm">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Ödemeler iyzico güvencesiyle, 3D Secure ile alınır.</span>
            <span className="inline-flex items-center gap-2"><Lock size={16} /> Kart bilgilerin AYA sunucularına hiç ulaşmaz.</span>
            <span>Abonelik olmadan da ders başına ödeyerek devam edebilirsin.</span>
          </div>
        </section>
      </main>
      <Footer />
      {chosen && info && <CheckoutSheet plan={chosen} interval={interval} priceKurus={info.prices[chosen][interval]} onClose={() => setChosen(null)} />}
    </>
  )
}

function CheckoutSheet({ plan, interval, priceKurus, onClose }: { plan: PaidPlan; interval: BillingInterval; priceKurus: number; onClose: () => void }) {
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [address, setAddress] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const r = await fetch("/api/subscriptions/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, interval, phone, city, address }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (r.status === 403 && d.code === "TERMS_REQUIRED") return (window.location.href = "/accept-terms?next=/pricing")
    if (!r.ok) return setError(d.error || "Ödeme başlatılamadı.")
    setHtml(d.html)
  }

  const field = "w-full rounded-xl border border-rule bg-white px-4 py-3 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="sub-title">
      <button aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-ink/50 backdrop-blur-sm motion-safe:animate-[fade_.2s_ease-out]" />
      <div data-testid="subscription-sheet" className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl motion-safe:animate-[rise_.35s_cubic-bezier(.2,.7,.2,1)_both]">
        <button onClick={onClose} aria-label="Kapat" className="absolute right-4 top-4 rounded-full p-2 text-sage-500 hover:bg-sage-100 hover:text-ink"><X size={18} /></button>
        <p className="eyebrow">{interval === "MONTHLY" ? "Aylık abonelik" : "Yıllık abonelik"}</p>
        <h2 id="sub-title" className="font-display text-3xl mt-1">{PLAN_LABEL[plan]} · {formatTL(priceKurus)}<span className="text-base text-sage-500">{interval === "MONTHLY" ? "/ay" : "/yıl"}</span></h2>
        <p className="text-sm text-sage-600 mt-2">Kartından her {interval === "MONTHLY" ? "ay" : "yıl"} otomatik çekilir. İstediğin an Üyeliğim sayfasından iptal edebilirsin.</p>

        {html ? (
          <div className="mt-6"><PayForm html={html} testId="subscription-pay-form" /></div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="subscription-form">
            <label className="block">
              <span className="text-xs font-semibold text-sage-700">Cep telefonu</span>
              <input name="phone" required inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-sage-700">Şehir</span>
              <input name="city" required autoComplete="address-level1" value={city} onChange={(e) => setCity(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-sage-700">Fatura adresi</span>
              <textarea name="address" required rows={2} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} className={`${field} mt-1 resize-none`} />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} data-testid="subscription-continue" className="w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-cream transition hover:bg-sage-800 active:scale-[.98] disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/30 border-t-cream" />}
              {busy ? "Hazırlanıyor…" : "Kart ile ödemeye geç"}
            </button>
            <p className="text-center text-xs text-sage-500 inline-flex w-full items-center justify-center gap-1.5"><Lock size={12} /> Ödeme iyzico'nun güvenli sayfasında yapılır.</p>
            <p className="text-center text-xs text-sage-500">Devam ederek <Link href="/terms" className="underline">Kullanım ve Mesafeli Satış Sözleşmesi</Link>'ni kabul etmiş olursun.</p>
          </form>
        )}
      </div>
    </div>
  )
}
