"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Check, ArrowRight } from "lucide-react"

const plans = [
  {
    id: "FREE",
    name: "Keşfet",
    nameEn: "Explore",
    price: 0,
    period: "Ücretsiz",
    icon: "🌱",
    color: "from-sage-400 to-sage-500",
    borderColor: "border-sage-200",
    features: [
      "Ders başına ödeme (Pay-per-class)",
      "Öğretmen profillerini görüntüleme",
      "AI Yoga asistanı (5 soru/gün)",
      "Geçmiş ders videolarını izleme",
      "Temel rozetler ve puanlar",
    ],
    cta: "Mevcut Plan",
    popular: false,
  },
  {
    id: "PREMIUM",
    name: "Premium",
    nameEn: "Premium",
    price: 49.99,
    period: "/ay",
    icon: "⚡",
    color: "from-amber-400 to-orange-500",
    borderColor: "border-amber-300",
    features: [
      "Aylık 8 canlı ders hakkı",
      "Ders başına %20 indirim",
      "Sınırsız geçmiş video erişimi",
      "Sınırsız AI Yoga asistanı",
      "Özel premium rozetler",
      "Öncelikli öğretmen eşleştirme",
      "7/24 e-posta desteği",
    ],
    cta: "Premium'a Geç",
    popular: true,
  },
  {
    id: "UNLIMITED",
    name: "Sınırsız",
    nameEn: "Unlimited",
    price: 99.99,
    period: "/ay",
    icon: "👑",
    color: "from-violet-500 to-purple-600",
    borderColor: "border-violet-300",
    features: [
      "Sınırsız canlı ders",
      "Tüm öğretmenlere erişim",
      "Sınırsız geçmiş video erişimi",
      "Sınırsız AI Yoga asistanı",
      "VIP rozetler ve sıralama",
      "1-1 Özel program tasarımı",
      "Öncelikli teknik destek",
      "Yeni öğretmenlere erken erişim",
    ],
    cta: "Sınırsız'a Geç",
    popular: false,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [annual, setAnnual] = useState(false)

  const handleSelectPlan = async (planId: string) => {
    if (planId === "FREE") return
    // For now, redirect to checkout. In production, this creates a Stripe Subscription session.
    alert(`${planId} planı yakında aktif olacak! Şimdilik ders başına ödeme ile devam edebilirsiniz.`)
    router.push("/teachers")
  }

  return (
    <>
      <Navbar />
      <main>
        <section className="border-b border-rule">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-12">
            <p className="eyebrow mb-4">Paketler</p>
            <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.0] max-w-4xl">
              Size uygun <em className="italic text-clay-500">planı seçin.</em>
            </h1>
            <p className="mt-6 text-lg text-sage-600 max-w-2xl">
              Tek ders satın alın ya da abonelikle tasarruf edin. Tüm planlar istediğiniz zaman iptal edilebilir.
            </p>
            <div className="flex items-center gap-4 mt-8" role="group" aria-label="Faturalama dönemi">
              {([[false, "Aylık"], [true, "Yıllık (−%20)"]] as const).map(([val, label]) => (
                <button
                  key={label}
                  onClick={() => setAnnual(val)}
                  aria-pressed={annual === val}
                  className={`px-5 py-2 text-sm font-medium border rounded-md transition-colors ${annual === val ? "bg-ink text-cream border-ink" : "border-rule hover:border-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
          <div className="grid md:grid-cols-3 border border-ink divide-y md:divide-y-0 md:divide-x divide-ink bg-paper">
            {plans.map((plan) => {
              const displayPrice = plan.price === 0 ? 0 : annual ? Math.round(plan.price * 0.8 * 100) / 100 : plan.price
              return (
                <div key={plan.id} data-testid={`plan-${plan.id}`} className={`p-8 lg:p-10 flex flex-col ${plan.popular ? "bg-ink text-cream" : ""}`}>
                  <div className="flex items-center justify-between mb-8">
                    <p className={`eyebrow ${plan.popular ? "!text-cream/60" : ""}`}>{plan.nameEn}</p>
                    {plan.popular && <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-clay-300">En çok tercih edilen</span>}
                  </div>
                  <h2 className="font-display text-4xl mb-4">{plan.name}</h2>
                  <p className="mb-8">
                    {displayPrice === 0 ? (
                      <span className="font-display text-5xl">Ücretsiz</span>
                    ) : (
                      <>
                        <span className="font-display text-5xl">${displayPrice}</span>
                        <span className={`text-sm ml-1 ${plan.popular ? "text-cream/60" : "text-sage-500"}`}>{plan.period}</span>
                      </>
                    )}
                  </p>
                  <ul className="space-y-3 mb-10 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check size={16} className={`mt-0.5 shrink-0 ${plan.popular ? "text-clay-300" : "text-clay-500"}`} />
                        <span className={plan.popular ? "text-cream/85" : "text-sage-700"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={plan.id === "FREE"}
                    className={`w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 rounded-md transition-colors disabled:cursor-default ${
                      plan.popular ? "bg-clay-500 hover:bg-clay-400 text-white" : plan.id === "FREE" ? "border border-rule text-sage-500" : "bg-ink text-cream hover:bg-sage-800"
                    }`}
                  >
                    {plan.cta}
                    {plan.id !== "FREE" && <ArrowRight size={16} />}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-10 text-sage-500 text-sm space-y-1">
            <p>Abonelik olmadan ders başına ödeme ile de devam edebilirsiniz.</p>
            <p>Ödemeler Stripe ve Iyzico 3D Secure ile korunur.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
