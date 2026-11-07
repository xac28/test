import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Heart, Lock, Sparkles, Users } from "lucide-react"
import { CtaBand, PageHero, Section } from "@/components/marketing"

export const metadata = { title: "Hakkımızda", description: "AYA'nın hikâyesi, değerleri ve çalışma biçimi." }

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero eyebrow="Hakkımızda" title="Yoga herkesin" accent="ulaşabildiği bir yerde." lead="AYA; iyi eğitmenlerle merak eden insanları, evlerinin sakinliğinde buluşturmak için kuruldu: güvenli, sade ve gerçekten insani." />
        <Section eyebrow="Neye inanıyoruz" title="Dört ilkemiz">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              [Heart, "Şefkat", "Beden ve zihin zorlamayla değil, sabırla gelişir. Her dersin kolaylaştırılmış bir yolu vardır."],
              [Users, "Gerçek insanlar", "Onaylı, sertifikalı eğitmenler; küçük gruplar; yapay zekânın değil insanın yönlendirmesi."],
              [Lock, "Güven", "Ödeme ve iletişim platform içinde; kötüye kullanım otomatik engellenir, her şey bildirilebilir."],
              [Sparkles, "Sadelik", "Karmaşık menüler yok: bir eğitmen bul, bir saat seç, pratiğe başla."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Heart
              return <div key={t as string} className="rounded-2xl bg-paper border border-rule p-7 card-lift"><I className="text-clay-500 mb-4" size={28} /><h3 className="font-display text-2xl mb-2">{t as string}</h3><p className="text-sage-600 leading-relaxed">{d as string}</p></div>
            })}
          </div>
        </Section>
        <section className="surface-peach border-y border-rule">
          <Section eyebrow="Nasıl çalışıyoruz" title="Kaliteyi ve güveni nasıl koruyoruz?">
            <div className="grid lg:grid-cols-2 gap-10 text-sage-700 leading-relaxed">
              <div className="space-y-4">
                <p>Platforma katılmak isteyen her eğitmen başvuru formunu doldurur ve sertifikasını yükler. Ekibimiz başvuruyu inceler; ardından eğitmen, yöneticilerle bir <strong>deneme yayını</strong> yapar. Bu aşama geçilmeden eğitmen listelenmez ve öğrenci alamaz.</p>
                <p>Topluluk alanlarında küfür, hakaret, reklam ve iletişim bilgisi paylaşımı yayınlanmadan engellenir. Yanlış yapıldığını düşündüğün her içeriği tek tıkla bildirebilirsin; yöneticilerimiz inceler ve sonucu sana bildirir.</p>
              </div>
              <div className="space-y-4">
                <p>Eğitmenlerin öğrencileri platform dışına (sosyal medya, telefon, kendi kursu) yönlendirmesi yasaktır. Bu girişimler otomatik engellenir, yönetim paneline kaydedilir ve <strong>kademeli yaptırıma</strong> bağlanır: uyarı, 10 gün uzaklaştırma, kalıcı ban.</p>
                <p>Bir sorunun olursa Rehber'e sor ya da canlı destek ekibine yaz; gerçek bir insan yanıtlar.</p>
              </div>
            </div>
          </Section>
        </section>
        <CtaBand title="Pratiğe bizimle başla." text="Üyelik ücretsiz; ilk deneme dersi yarı fiyat." href="/login?mode=register" label="Ücretsiz üye ol" secondary={{ href: "/ogretmenler-icin", label: "Eğitmen olmak istiyorum" }} />
      </main>
      <Footer />
    </>
  )
}
