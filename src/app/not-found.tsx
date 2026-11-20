import Link from "next/link"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { POSES, poseImage } from "@/lib/yoga-poses"

export const metadata = { title: "Sayfa bulunamadı", robots: { index: false } }

const LINKS = [
  ["/yoga-stilleri", "Yoga stilleri", "Hangi yoga sana uygun?"],
  ["/pozlar", "Poz kütüphanesi", "3B olarak her pozu öğren"],
  ["/teachers", "Eğitmenler", "Birebir ders için eğitmenini seç"],
  ["/atolyeler", "Atölyeler", "Canlı ve kayıtlı atölyeler"],
  ["/sss", "Sık sorulanlar", "Merak ettiklerin"],
]

export default function NotFound() {
  // a different pose each time the page is built; the figure is lost, too, which is the joke
  const pose = POSES[new Date().getDate() % POSES.length]
  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center" data-testid="not-found">
        <div>
          <p className="eyebrow mb-4">404</p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05]">Bu sayfayı <em className="italic text-clay-600">bulamadık.</em></h1>
          <p className="mt-5 text-lg text-sage-600 max-w-md">Adres değişmiş ya da hiç var olmamış olabilir. Derin bir nefes al; aşağıdakilerden biriyle devam edebilirsin.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="btn-cta">Ana sayfaya dön</Link>
            <Link href="/pozlar" className="btn-ghost">Pozlara bak</Link>
          </div>
          <ul className="mt-10 divide-y divide-rule border-y border-rule">
            {LINKS.map(([href, label, hint]) => (
              <li key={href}>
                <Link href={href} className="flex items-baseline justify-between gap-4 py-3 hover:text-clay-600 min-h-[44px]">
                  <span className="font-display text-xl">{label}</span>
                  <span className="text-sm text-sage-500">{hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-clay-100 to-teal-100 border border-rule aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poseImage(pose.slug)} alt="" className="w-full h-full object-cover" />
        </div>
      </main>
      <Footer />
    </>
  )
}
