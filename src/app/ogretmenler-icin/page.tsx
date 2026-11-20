import Link from "next/link"
import { CalendarClock, Check, Radio, ShieldAlert, Video, Wallet } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { CtaBand, PageHero, Section } from "@/components/marketing"
import { POLICY_LADDER_TR } from "@/lib/policy-ladder"

export const metadata = { title: "Eğitmenler için", description: "AYA'da eğitmen ol: kendi saatlerinde ders ver, atölye aç, canlı yayın yap. Başvuru süreci, kazanç ve kurallar." }

export default function ForTeachersPage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero eyebrow="Eğitmenler için" title="Bilgini paylaş," accent="stüdyon cebinde olsun." lead="Kendi saatlerinde birebir ders ver, küçük grup atölyeleri aç ve 1080p'ye kadar canlı yayın yap. Öğrenci bulma, ödeme ve kayıt işleri bizde." tone="teal">
          <div className="flex flex-wrap gap-3"><Link href="/become-teacher" className="btn-cta">Eğitmen olarak başvur</Link><Link href="/nasil-calisir" className="inline-flex items-center px-5 py-3 text-sm font-semibold text-white/90 underline underline-offset-4">Platform nasıl çalışır?</Link></div>
        </PageHero>
        <Section eyebrow="Neler sunuyoruz" title="Eğitmenlere özel araçlar">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              [CalendarClock, "Esnek program", "Müsait saatlerini sen belirlersin; öğrenciler kendi saat dilimlerinde görür."],
              [Radio, "Canlı yayın stüdyosu", "1080p60'a kadar yayın, kalite ön ayarları, sohbet yönetimi, ekran paylaşımı."],
              [Video, "Ders kaydı", "Tek tuşla ders kaydı; kayıt yalnızca öğretmen ve öğrenciye açık, 30 gün saklanır."],
              [Wallet, "Şeffaf kazanç", "Varsayılan komisyon %15; deneme derslerinden komisyon alınmaz. Kazancını panelden izler, ödeme talebi oluşturursun."],
              [Check, "Atölyeler", "Canlı ya da kayıtlı atölye aç, kontenjan ve fiyatı sen belirle."],
              [ShieldAlert, "Korumalı ortam", "Taciz ve kötüye kullanım otomatik engellenir; tek tıkla bildirim ve canlı destek."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Radio
              return <div key={t as string} className="rounded-2xl bg-paper border border-rule p-7 card-lift"><I className="text-clay-500 mb-4" size={28} /><h3 className="font-display text-2xl mb-2">{t as string}</h3><p className="text-sage-600 leading-relaxed">{d as string}</p></div>
            })}
          </div>
        </Section>
        <section className="surface-mint border-y border-rule">
          <Section eyebrow="Süreç" title="Başvurudan ilk derse">
            <ol className="grid md:grid-cols-4 gap-6">
              {[["Başvur", "Formu doldur, sertifikanı yükle."], ["İnceleme", "Ekibimiz başvurunu ve sertifikanı inceler."], ["Deneme yayını", "Yöneticilerle kısa bir canlı yayın yaparsın."], ["Yayındasın", "Onaylanınca profilin listelenir, ders ve yayın verebilirsin."]].map(([t, d], i) => (
                <li key={t} className="rounded-2xl bg-paper border border-rule p-6"><span className="font-display text-5xl text-clay-300 leading-none">{i + 1}</span><h3 className="font-display text-2xl mt-3 mb-1">{t}</h3><p className="text-sage-600">{d}</p></li>
              ))}
            </ol>
          </Section>
        </section>
        <Section eyebrow="Bilmen gereken kural" title="Öğrenciler platformda kalır" className="max-w-5xl">
          <p className="text-sage-700 text-lg leading-relaxed">İletişim ve ödeme yalnızca AYA üzerinden yapılır. Profil metninde, atölye ve video açıklamalarında, yayın başlığında, mesajlarda ve sohbette <strong>sosyal medya hesabı, telefon/WhatsApp, e-posta, harici bağlantı, "kendi kursuma gel" ya da dışarıdan ödeme</strong> gibi yönlendirmeler otomatik engellenir ve kayda geçer. Yaptırım kademelidir:</p>
          <ol className="mt-6 grid md:grid-cols-3 gap-5">
            {POLICY_LADDER_TR.map((l) => <li key={l.strike} className="rounded-2xl border border-rule bg-paper p-6"><span className="font-display text-5xl text-clay-500 leading-none">{l.strike}</span><p className="font-semibold mt-3">{l.action}</p><p className="text-sm text-sage-600 mt-1">{l.detail}</p></li>)}
          </ol>
          <p className="text-sm text-sage-500 mt-4">Aynı mesajı kısa sürede yeniden denemek yeni ihlal sayılmaz; yanlış alarm olduğunu düşünürsen canlı desteğe yaz, yönetim ihlali inceleyip affedebilir.</p>
        </Section>
        <CtaBand title="Öğrencilerin seni bekliyor." text="Başvuru ücretsiz; onay süreci kısadır." href="/become-teacher" label="Eğitmen olarak başvur" secondary={{ href: "/sss", label: "Sık sorulan sorular" }} />
      </main>
      <Footer />
    </>
  )
}
