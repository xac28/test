import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Check, Dumbbell, Gauge, Timer } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { CtaBand, FaqList, Intensity } from "@/components/marketing"
import { PoseCard } from "@/components/poses/pose-library"
import { STYLES, STYLE_BY_SLUG, TONE_CLASS } from "@/lib/yoga-styles"
import { poseImage } from "@/lib/yoga-poses"

export function generateStaticParams() {
  return STYLES.map((s) => ({ slug: s.slug }))
}
export function generateMetadata({ params }: { params: { slug: string } }) {
  const s = STYLE_BY_SLUG[params.slug]
  return s ? { title: `${s.name} yoga`, description: s.tagline } : {}
}

export default function StylePage({ params }: { params: { slug: string } }) {
  const s = STYLE_BY_SLUG[params.slug]
  if (!s) notFound()
  const others = STYLES.filter((x) => x.slug !== s.slug)
  return (
    <>
      <Navbar />
      <main>
        <section className={`relative overflow-hidden border-b border-rule bg-gradient-to-br ${TONE_CLASS[s.tone]}`}>
          <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-8 pb-14 lg:pb-20">
            <Link href="/yoga-stilleri" className="inline-flex items-center gap-1.5 text-sm text-sage-600 hover:text-ink min-h-[44px]"><ArrowLeft size={16} /> Tüm stiller</Link>
            <div className="grid lg:grid-cols-12 gap-10 items-center mt-4">
              <div className="lg:col-span-7">
                <p className="eyebrow mb-4">Yoga stili</p>
                <h1 className="font-display font-light text-6xl md:text-8xl leading-[0.98]" data-testid="style-title">{s.name}</h1>
                <p className="mt-6 text-xl text-sage-700 max-w-xl leading-relaxed">{s.tagline}</p>
                <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
                  <div><dt className="eyebrow mb-1.5 flex items-center gap-1.5"><Gauge size={13} /> Yoğunluk</dt><dd><Intensity value={s.intensity} /></dd></div>
                  <div><dt className="eyebrow mb-1.5 flex items-center gap-1.5"><Dumbbell size={13} /> Seviye</dt><dd className="font-medium">{s.level}</dd></div>
                  <div><dt className="eyebrow mb-1.5 flex items-center gap-1.5"><Timer size={13} /> Süre</dt><dd className="font-medium">{s.duration}</dd></div>
                </dl>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={`/atolyeler?category=${encodeURIComponent(s.category)}`} className="btn-cta">{s.name} atölyeleri</Link>
                  <Link href="/teachers" className="btn-ghost">Eğitmen bul</Link>
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl border border-white/60 bg-white/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={poseImage(s.cover)} alt={`${s.name} yoga`} className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <p className="text-xl text-sage-700 leading-relaxed">{s.intro}</p>
            <h2 className="font-display text-3xl mt-12 mb-4">Kimler için?</h2>
            <ul className="space-y-3">{s.forYou.map((x) => <li key={x} className="flex gap-3"><Check size={18} className="text-teal-500 mt-1 shrink-0" /> <span className="text-sage-700">{x}</span></li>)}</ul>
            <h2 className="font-display text-3xl mt-12 mb-4">Derste neler olur?</h2>
            <ul className="space-y-3">{s.expect.map((x) => <li key={x} className="flex gap-3"><Check size={18} className="text-clay-500 mt-1 shrink-0" /> <span className="text-sage-700">{x}</span></li>)}</ul>
            <h2 className="font-display text-3xl mt-12 mb-4">Faydaları</h2>
            <div className="grid sm:grid-cols-2 gap-3">{s.benefits.map((b) => <div key={b} className="p-4 rounded-xl bg-paper border border-rule text-sage-700">{b}</div>)}</div>
          </div>
          <aside className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl bg-paper border border-rule p-7">
              <h2 className="font-display text-2xl mb-4">Örnek bir ders</h2>
              <ol className="space-y-4 border-l-2 border-clay-200 pl-5">
                {s.session.map((x) => <li key={x.time} className="relative"><span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-clay-400" /><p className="text-xs font-semibold text-clay-600 tracking-wide">{x.time}</p><p className="text-sage-700">{x.part}</p></li>)}
              </ol>
            </div>
            <div className="rounded-2xl surface-mint p-7">
              <h2 className="font-display text-2xl mb-3">Neler gerekli?</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-sage-700">{s.gear.map((g) => <li key={g}>{g}</li>)}</ul>
            </div>
          </aside>
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-16">
          <h2 className="font-display text-4xl mb-8">Bu stilde sık yapılan pozlar</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">{s.poses.map((p) => <PoseCard key={p} slug={p} />)}</div>
        </section>

        <section className="max-w-4xl mx-auto px-6 lg:px-12 pb-16">
          <h2 className="font-display text-4xl mb-6">Sık sorulanlar</h2>
          <FaqList items={s.faq.map((f) => ({ q: f.q, a: f.a }))} />
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-4">
          <h2 className="font-display text-3xl mb-5">Diğer stiller</h2>
          <div className="flex flex-wrap gap-3">{others.map((o) => <Link key={o.slug} href={`/yoga-stilleri/${o.slug}`} className="px-5 py-2.5 rounded-full border border-rule bg-paper text-sm font-medium hover:border-ink">{o.name}</Link>)}</div>
        </section>
        <CtaBand title={`${s.name} için eğitmenini bul.`} text="Uzmanlık alanına göre filtreleyip profillerini incele; ilk deneme dersi yarı fiyat." href="/teachers" label="Eğitmenlere bak" secondary={{ href: "/login?mode=register", label: "Ücretsiz üye ol" }} />
      </main>
      <Footer />
    </>
  )
}
