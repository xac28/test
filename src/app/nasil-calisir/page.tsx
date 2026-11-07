import Link from "next/link"
import { CalendarCheck, Compass, Radio, ShieldCheck, Sparkles, Users, Video } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { CtaBand, PageHero, Section } from "@/components/marketing"

export const metadata = { title: "Nasıl çalışır?", description: "AYA'da birebir ders, atölye ve canlı yayın nasıl işler? Üyelikten ilk derse dört adımda." }

const STEPS = [
  { icon: Compass, t: "Keşfet", d: "Yoga stillerini ve pozları incele, sorularını AYA Rehber'e sor. Hangi eğitmenin sana uygun olduğunu uzmanlık alanı, puan ve fiyata göre görürsün." },
  { icon: Sparkles, t: "Ücretsiz üye ol", d: "E-postayla ya da Google ile bir dakikada kayıt ol. Üyelik ücretsizdir; canlı yayınlara katılır, atölyelere yer ayırır, derslerini tek panelden yönetirsin." },
  { icon: CalendarCheck, t: "Deneme dersi al", d: "Beğendiğin eğitmenin müsait saatlerinden birini seç. İlk deneme dersi yarı fiyat; deneme derslerinden platform komisyon almaz." },
  { icon: Video, t: "Evinden pratik yap", d: "Ders saatinde tek tıkla görüntülü odaya gir. Eğitmen kaydederse dersi 30 gün boyunca indirebilir, istediğin zaman tekrar çalışabilirsin." },
]
const WAYS = [
  { icon: Users, t: "Birebir dersler", d: "Yalnızca sana ayrılmış bir saat. Hedefine ve seviyene göre kişiselleştirilmiş, canlı geri bildirimli ders.", href: "/teachers", cta: "Eğitmenler" },
  { icon: CalendarCheck, t: "Atölyeler", d: "Küçük gruplarla canlı ya da kayıtlı, belirli bir konuya odaklanan çalışmalar. Bir kısmı ücretsiz.", href: "/atolyeler", cta: "Atölyeler" },
  { icon: Radio, t: "Canlı yayınlar", d: "Eğitmenlerin herkese açık yayınları: 1080p'ye kadar kalite, canlı sohbet, kalite seçimi.", href: "/live", cta: "Canlı yayınlar" },
]

export default function HowItWorks() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero eyebrow="Nasıl çalışır?" title="İlk dersine" accent="dört adımda." lead="Kurulum yok, bekleme yok. Bir tarayıcı, bir kamera ve biraz boş alan yeterli." tone="peach" />
        <Section eyebrow="Adım adım" title="Üyelikten ilk derse">
          <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="how-steps">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative rounded-2xl bg-paper border border-rule p-7 card-lift">
                <span className="absolute -top-4 left-6 font-display text-6xl text-clay-200 leading-none select-none">{i + 1}</span>
                <s.icon className="text-clay-500 mt-4 mb-4" size={28} />
                <h3 className="font-display text-2xl mb-2">{s.t}</h3>
                <p className="text-sage-600 leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </Section>
        <section className="surface-mint border-y border-rule">
          <Section eyebrow="Üç farklı yol" title="Sana uyan şekilde çalış">
            <div className="grid md:grid-cols-3 gap-6">
              {WAYS.map((w) => (
                <div key={w.t} className="rounded-2xl bg-paper border border-rule p-8 flex flex-col card-lift">
                  <w.icon className="text-teal-500 mb-4" size={30} />
                  <h3 className="font-display text-3xl mb-2">{w.t}</h3>
                  <p className="text-sage-600 leading-relaxed flex-1">{w.d}</p>
                  <Link href={w.href} className="mt-6 text-sm font-semibold text-clay-600 underline underline-offset-4">{w.cta} →</Link>
                </div>
              ))}
            </div>
          </Section>
        </section>
        <Section eyebrow="Güvenlik" title="Güvenle öğrenmen için">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              ["Onaylı eğitmenler", "Eğitmenler başvuru ve sertifika incelemesinden sonra yöneticilerle deneme yayını yapar; onaylanmadan öğrenci alamaz."],
              ["Denetimli topluluk", "Küfür, hakaret, reklam ve iletişim bilgisi paylaşımı otomatik engellenir; her içerik tek tıkla bildirilebilir."],
              ["Platform içi ödeme ve iletişim", "Eğitmenler öğrencileri platform dışına yönlendiremez; ihlaller kayda geçer ve yaptırıma bağlanır. Sorun yaşarsan canlı destek yanında."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-rule p-7 bg-paper"><ShieldCheck className="text-teal-500 mb-3" size={26} /><h3 className="font-display text-2xl mb-2">{t}</h3><p className="text-sage-600 leading-relaxed">{d}</p></div>
            ))}
          </div>
        </Section>
        <CtaBand title="Hazırsan başlayalım." text="Üyelik ücretsiz; ilk deneme dersi yarı fiyat." href="/login?mode=register" label="Ücretsiz üye ol" secondary={{ href: "/sss", label: "Sık sorulan sorular" }} />
      </main>
      <Footer />
    </>
  )
}
