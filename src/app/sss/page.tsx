import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import Link from "next/link"
import { CtaBand, FaqList, PageHero } from "@/components/marketing"

export const metadata = { title: "Sık sorulan sorular", description: "AYA hakkında merak edilenler: üyelik, ödeme, deneme dersi, ders kayıtları, güvenlik ve eğitmenlik." }

const GROUPS: { title: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    title: "Başlarken",
    items: [
      { q: "AYA nedir?", a: "AYA; sertifikalı eğitmenlerle birebir dersler, herkese açık canlı yayınlar ve küçük gruplarla atölyeler sunan bir online yoga ve meditasyon okuludur." },
      { q: "Üyelik ücretli mi?", a: "Hayır, üyelik ücretsizdir. Ders, atölye ya da paket almak istediğinde ödeme yaparsın; bazı atölyeler ücretsizdir." },
      { q: "Hiç yoga yapmadım, başlayabilir miyim?", a: <>Elbette. Önce <Link href="/yoga-stilleri/hatha" className="underline">Hatha</Link> ya da <Link href="/yoga-stilleri/yin" className="underline">Yin</Link> gibi sakin stillere göz at; <Link href="/pozlar" className="underline">poz kütüphanesinden</Link> temel duruşları öğren ve bir eğitmenle deneme dersi al.</> },
      { q: "Neye ihtiyacım var?", a: "İnternete bağlı bir cihaz (tercihen kameralı), bir yoga matı ve birkaç metrekare boş alan. Kurulum gerekmez; tarayıcıdan katılırsın." },
    ],
  },
  {
    title: "Dersler ve ödeme",
    items: [
      { q: "Deneme dersi nasıl işliyor?", a: "Her eğitmenle ilk deneme dersin yarı fiyattır. Deneme derslerinden platform komisyon almaz." },
      { q: "Ders saatleri hangi saat dilimine göre?", a: "Rezervasyon sayfasında saatler senin saat diliminde gösterilir; eğitmen farklı bir ülkede olsa bile karışıklık yaşamazsın." },
      { q: "Ödemeyi nasıl yaparım?", a: "Ödemeler platform üzerinden, güvenli ödeme sağlayıcılarıyla yapılır. Eğitmenler seninle ödeme konusunu platform dışında konuşamaz; böyle bir istek gelirse bize bildir." },
      { q: "Ders kaydını alabilir miyim?", a: "Eğitmen dersi kaydederse kayıt yalnızca o dersin eğitmeni ve öğrencisi tarafından indirilebilir ve 30 gün sonra otomatik silinir." },
      { q: "Rezervasyon iptali nasıl yapılır?", a: <>İptal ve iade koşulları <Link href="/terms" className="underline">kullanım sözleşmesinde</Link> yazılıdır. Bir sorun yaşadıysan Canlı Destek'e yazabilirsin.</> },
    ],
  },
  {
    title: "Canlı yayınlar ve atölyeler",
    items: [
      { q: "Canlı yayınları kim izleyebilir?", a: "Üye olan herkes. Yayında 1080p'ye kadar kalite arasından seçim yapabilir ve canlı sohbete katılabilirsin." },
      { q: "Atölyeye nasıl katılırım?", a: "Atölye sayfasından yer ayırırsın. Ücretli atölyede ödeme eğitmen tarafından onaylandığında katılımın kesinleşir; canlı atölye yayınları yalnızca onaylı katılımcılara açıktır." },
    ],
  },
  {
    title: "Güvenlik ve topluluk",
    items: [
      { q: "Eğitmenler nasıl seçiliyor?", a: "Her eğitmen başvuru ve sertifika incelemesinden geçer, ardından yöneticilerle bir deneme yayını yapar. Onaylanmadan listelenmez ve öğrenci alamaz." },
      { q: "Bir içeriği ya da kişiyi nasıl bildiririm?", a: "Canlı yayında, sohbet mesajında, atölye, eğitmen profili, fotoğraf ve yorumlarda “Bildir” düğmesi vardır. Yöneticiler inceler; bildirdiğin kişi kimliğini görmez." },
      { q: "Toplulukta küfür ya da reklam yapılırsa ne olur?", a: <>İçerik yayınlanmadan engellenir, tekrarı geçici susturmaya yol açar. Ayrıntılar için <Link href="/community/rules" className="underline">topluluk kurallarına</Link> bak.</> },
      { q: "Verilerim güvende mi?", a: <>Kişisel verilerin yalnızca hizmeti sunmak için kullanılır. Ayrıntılar <Link href="/privacy" className="underline">gizlilik politikasında</Link>.</> },
    ],
  },
  {
    title: "Eğitmenler için",
    items: [
      { q: "AYA'da nasıl eğitmen olurum?", a: <><Link href="/become-teacher" className="underline">Başvuru formunu</Link> doldur, sertifikanı yükle. Ekibimiz inceler, ardından kısa bir deneme yayını yaparsın; onaylanınca ders ve yayın vermeye başlarsın. Ayrıntılar <Link href="/ogretmenler-icin" className="underline">eğitmenler sayfasında</Link>.</> },
      { q: "Öğrencilerime sosyal medya ya da WhatsApp numaramı verebilir miyim?", a: "Hayır. Platform dışına yönlendirme yasaktır; otomatik engellenir ve kayıt altına alınır. İlk ihlalde uyarı, ikincisinde 10 gün uzaklaştırma, üçüncüsünde kalıcı ban uygulanır." },
    ],
  },
]

export default function FaqPage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero eyebrow="Sık sorulan sorular" title="Merak" accent="ettiklerin." lead="Cevabı burada yoksa sağ alttaki Rehber'e sor ya da Canlı Destek'e yaz." tone="mint" />
        <section className="max-w-4xl mx-auto px-6 lg:px-12 py-16 space-y-14">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h2 className="eyebrow mb-3 !text-clay-600">{g.title}</h2>
              <FaqList items={g.items} />
            </div>
          ))}
        </section>
        <CtaBand title="Hâlâ sorun mu var?" text="AYA Rehber hemen yanıtlar; gerekirse canlı destek ekibine bağlanır." href="/dashboard/support" label="Canlı destek" secondary={{ href: "/nasil-calisir", label: "Nasıl çalışır?" }} />
      </main>
      <Footer />
    </>
  )
}
