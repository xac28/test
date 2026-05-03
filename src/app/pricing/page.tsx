"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Check, Zap, Crown, Sparkles, ArrowRight } from "lucide-react"

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
      <section className="min-h-screen bg-gradient-to-b from-cream via-sage-50 to-cream py-20">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16 animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-sage-100 text-sage-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles size={16} />
              Pratiğinizi Yükseltin
            </div>
            <h1 className="text-4xl md:text-6xl font-display text-ink mb-4">
              Size Uygun <span className="italic text-sage-600">Planı</span> Seçin
            </h1>
            <p className="text-ink/60 max-w-2xl mx-auto text-lg">
              Her seviye için bir plan. Tek ders satın alın veya abonelik ile tasarruf edin.
            </p>

            {/* Annual Toggle */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-sm font-medium ${!annual ? "text-sage-800" : "text-sage-400"}`}>Aylık</span>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative w-14 h-7 rounded-full transition-colors ${annual ? "bg-sage-600" : "bg-sage-300"}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${annual ? "translate-x-8" : "translate-x-1"}`} />
              </button>
              <span className={`text-sm font-medium ${annual ? "text-sage-800" : "text-sage-400"}`}>
                Yıllık <span className="text-green-600 font-bold">(-20%)</span>
              </span>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 stagger-children">
            {plans.map((plan) => {
              const displayPrice = plan.price === 0 ? 0 : annual ? Math.round(plan.price * 0.8 * 100) / 100 : plan.price

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-3xl p-8 border-2 transition-all duration-300 card-hover ${
                    plan.popular
                      ? "border-amber-300 shadow-xl shadow-amber-100/50 scale-[1.02]"
                      : `${plan.borderColor} shadow-sm`
                  }`}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-lg">
                      ⭐ EN POPÜLER
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-2xl mb-6 shadow-lg`}>
                    {plan.icon}
                  </div>

                  {/* Name & Price */}
                  <h3 className="text-2xl font-display text-ink mb-1">{plan.name}</h3>
                  <p className="text-sage-500 text-sm mb-6">{plan.nameEn}</p>

                  <div className="flex items-baseline gap-1 mb-8">
                    {displayPrice === 0 ? (
                      <span className="text-4xl font-bold text-sage-800">Ücretsiz</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-sage-800">${displayPrice}</span>
                        <span className="text-sage-500 text-sm">{plan.period}</span>
                      </>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${plan.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Check size={12} className="text-white" />
                        </div>
                        <span className="text-sage-700">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={plan.id === "FREE"}
                    className={`w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition btn-press ${
                      plan.popular
                        ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200/50 hover:shadow-xl"
                        : plan.id === "UNLIMITED"
                        ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200/50 hover:shadow-xl"
                        : "bg-sage-100 text-sage-600 hover:bg-sage-200"
                    } disabled:opacity-60 disabled:cursor-default`}
                  >
                    {plan.cta}
                    {plan.id !== "FREE" && <ArrowRight size={16} />}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Bottom note */}
          <div className="text-center mt-12 text-sage-500 text-sm">
            <p>Tüm planlar iptal edilebilir. Abonelik olmadan ders başına ödeme ile de devam edebilirsiniz.</p>
            <p className="mt-1">Ödeme güvenliğiniz Stripe ve Iyzico 3D Secure ile korunmaktadır. 🔒</p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}
