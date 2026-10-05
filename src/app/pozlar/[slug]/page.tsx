import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, Check, Clock, Wind } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { CtaBand } from "@/components/marketing"
import { Pose3D } from "@/components/poses/pose-3d"
import { PoseCard } from "@/components/poses/pose-library"
import { POSES, POSE_BY_SLUG } from "@/lib/yoga-poses"
import { STYLE_BY_SLUG } from "@/lib/yoga-styles"

export function generateStaticParams() {
  return POSES.map((p) => ({ slug: p.slug }))
}
export function generateMetadata({ params }: { params: { slug: string } }) {
  const p = POSE_BY_SLUG[params.slug]
  return p ? { title: `${p.name} (${p.sanskrit})`, description: p.summary } : {}
}

export default function PosePage({ params }: { params: { slug: string } }) {
  const p = POSE_BY_SLUG[params.slug]
  if (!p) notFound()
  const idx = POSES.findIndex((x) => x.slug === p.slug)
  const prev = POSES[(idx - 1 + POSES.length) % POSES.length]
  const next = POSES[(idx + 1) % POSES.length]
  const related = POSES.filter((x) => x.slug !== p.slug && (x.category === p.category || x.styles.some((s) => p.styles.includes(s)))).slice(0, 4)

  return (
    <>
      <Navbar />
      <main>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-8">
          <Link href="/pozlar" className="inline-flex items-center gap-1.5 text-sm text-sage-600 hover:text-ink min-h-[44px]"><ArrowLeft size={16} /> Tüm pozlar</Link>
        </div>
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-16 grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-24"><Pose3D slug={p.slug} name={p.name} /></div>
          <div className="lg:col-span-7">
            <p className="eyebrow mb-3">{p.category} · {p.level}</p>
            <h1 className="font-display font-light text-5xl md:text-6xl leading-[1.02]">{p.name}</h1>
            <p className="mt-2 text-xl italic text-clay-500 font-display">{p.sanskrit} · {p.english}</p>
            <p className="mt-6 text-lg text-sage-700 leading-relaxed">{p.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 text-teal-700 font-medium"><Clock size={15} /> {p.hold}</span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-clay-50 text-clay-700 font-medium"><Wind size={15} /> {p.breath.split(";")[0]}</span>
            </div>

            <h2 className="font-display text-3xl mt-12 mb-4">Faydaları</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {p.benefits.map((b) => <li key={b} className="flex gap-3 p-4 rounded-xl bg-paper border border-rule"><Check size={18} className="text-teal-500 mt-0.5 shrink-0" /> <span className="text-sage-700">{b}</span></li>)}
            </ul>

            <h2 className="font-display text-3xl mt-12 mb-5">Nasıl yapılır?</h2>
            <ol className="space-y-4" data-testid="pose-steps">
              {p.steps.map((s, i) => (
                <li key={i} className="flex gap-4"><span className="font-display text-4xl leading-none text-clay-400 w-9 shrink-0">{i + 1}</span><p className="text-sage-700 leading-relaxed pt-1">{s}</p></li>
              ))}
            </ol>

            <div className="mt-12 grid sm:grid-cols-2 gap-5">
              <div className="rounded-2xl p-6 surface-mint"><h3 className="font-display text-2xl mb-2">Daha kolay</h3><p className="text-sage-700">{p.easier}</p></div>
              <div className="rounded-2xl p-6 surface-peach"><h3 className="font-display text-2xl mb-2">Daha zor</h3><p className="text-sage-700">{p.harder}</p></div>
            </div>

            <div className="mt-8 rounded-2xl border border-saffron-300 bg-saffron-100/60 p-6" data-testid="pose-cautions">
              <h3 className="font-display text-2xl mb-3 flex items-center gap-2"><AlertTriangle size={20} className="text-saffron-600" /> Dikkat</h3>
              <ul className="space-y-2 text-sage-700 list-disc pl-5">{p.avoid.map((a) => <li key={a}>{a}</li>)}</ul>
              <p className="text-xs text-sage-500 mt-4">Bu bilgi genel amaçlıdır, tıbbi tavsiye yerine geçmez; sağlık sorunun varsa önce doktoruna danış.</p>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div><p className="eyebrow mb-2">Odak noktaları</p><p className="text-sage-700">{p.focus.join(" · ")}</p></div>
              <div><p className="eyebrow mb-2">Şunlarla dengele</p><p className="flex gap-3">{p.counter.map((c) => <Link key={c} href={`/pozlar/${c}`} className="tap-area underline underline-offset-4 hover:text-clay-600">{POSE_BY_SLUG[c].name}</Link>)}</p></div>
              <div><p className="eyebrow mb-2">Stiller</p><p className="flex gap-3 flex-wrap">{p.styles.map((s) => STYLE_BY_SLUG[s] && <Link key={s} href={`/yoga-stilleri/${s}`} className="tap-area underline underline-offset-4 hover:text-clay-600">{STYLE_BY_SLUG[s].name}</Link>)}</p></div>
            </div>
          </div>
        </section>

        {related.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-6">
            <h2 className="font-display text-4xl mb-8">Bunları da dene</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">{related.map((r) => <PoseCard key={r.slug} slug={r.slug} />)}</div>
          </section>
        )}
        <nav aria-label="Önceki ve sonraki poz" className="max-w-7xl mx-auto px-6 lg:px-12 py-10 flex justify-between gap-4 text-sm font-semibold">
          <Link href={`/pozlar/${prev.slug}`} className="tap-area underline underline-offset-4 hover:text-clay-600">← {prev.name}</Link>
          <Link href={`/pozlar/${next.slug}`} className="tap-area underline underline-offset-4 hover:text-clay-600">{next.name} →</Link>
        </nav>
        <CtaBand title={`${p.name}'i bir eğitmenle çalış.`} text="Canlı geri bildirim hizalamanı hızla geliştirir. İlk deneme dersi yarı fiyat." href="/teachers" label="Eğitmen bul" secondary={{ href: "/login?mode=register", label: "Ücretsiz üye ol" }} />
      </main>
      <Footer />
    </>
  )
}
