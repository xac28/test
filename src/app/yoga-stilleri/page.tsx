import Link from "next/link"
import { ArrowRight } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { CtaBand, Intensity, PageHero } from "@/components/marketing"
import { STYLES, TONE_CLASS } from "@/lib/yoga-styles"
import { poseImage } from "@/lib/yoga-poses"

export const metadata = { title: "Yoga stilleri", description: "Hatha, Vinyasa, Yin, Ashtanga, Restoratif ve Meditasyon: hangi stil sana göre? Yoğunluk, tempo ve seviye karşılaştırması." }

export default function StylesPage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero eyebrow="Yoga stilleri" title="Sana hangi" accent="yoga uygun?" lead="Her stilin temposu, yoğunluğu ve amacı farklıdır. Hedefine ve gününe göre seç; emin değilsen Hatha ya da Yin ile başla." tone="mint" />
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8" data-testid="style-grid">
            {STYLES.map((s) => (
              <Link key={s.slug} href={`/yoga-stilleri/${s.slug}`} data-testid="style-card" className="group rounded-3xl overflow-hidden bg-paper border border-rule card-lift flex flex-col">
                <div className={`aspect-[16/11] bg-gradient-to-br ${TONE_CLASS[s.tone]} overflow-hidden relative`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={poseImage(s.cover)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-7 flex-1 flex flex-col">
                  <h2 className="font-display text-4xl">{s.name}</h2>
                  <p className="text-sage-600 mt-2 leading-relaxed flex-1">{s.tagline}</p>
                  <dl className="mt-5 grid grid-cols-2 gap-y-2 text-sm">
                    <dt className="text-sage-500">Yoğunluk</dt><dd><Intensity value={s.intensity} /></dd>
                    <dt className="text-sage-500">Seviye</dt><dd className="text-sage-800">{s.level}</dd>
                    <dt className="text-sage-500">Süre</dt><dd className="text-sage-800">{s.duration}</dd>
                  </dl>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-clay-600 group-hover:gap-3 transition-all">Ayrıntılar <ArrowRight size={15} /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <CtaBand title="Stilini seçtin mi? Eğitmenini de seç." text="Her eğitmenin uzmanlık alanı profilinde yazar. İlk deneme dersi yarı fiyat." href="/teachers" label="Eğitmenlere bak" secondary={{ href: "/pozlar", label: "Pozları incele" }} />
      </main>
      <Footer />
    </>
  )
}
