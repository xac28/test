import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { PageHero } from "@/components/marketing"

export const metadata = { title: "Çerez politikası", description: "AYA hangi çerezleri ve tarayıcı depolamasını, ne için kullanır." }

const ROWS: [string, string, string, string][] = [
  ["authjs.session-token / __Secure-authjs.session-token", "Zorunlu", "Giriş yaptığını hatırlar (oturum).", "Tarayıcı kapanınca ya da \"Beni hatırla\" ile 30 gün"],
  ["authjs.csrf-token, authjs.callback-url", "Zorunlu", "Giriş formunun güvenliği ve girişten sonra yönlendirme.", "Oturum"],
  ["aya-locale (tarayıcı depolaması)", "Tercih", "Seçtiğin dili (TR/EN) hatırlar.", "Sen silene kadar"],
  ["aya-cookie-notice (tarayıcı depolaması)", "Tercih", "Bu bilgilendirmeyi kapattığını hatırlar.", "Sen silene kadar"],
  ["aya-signup-nudge (oturum depolaması)", "Tercih", "Üyelik davetini kapattığını hatırlar.", "Sekme kapanınca"],
]

export default function CookiePage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero eyebrow="Gizlilik" title="Çerez" accent="politikası." lead="Kısa özet: AYA yalnızca siteyi çalıştırmak için gerekli çerezleri kullanır. Reklam, profilleme ya da üçüncü taraf izleme çerezi yoktur." />
        <section className="max-w-4xl mx-auto px-6 lg:px-12 py-14 space-y-12">
          <div>
            <h2 className="font-display text-3xl mb-4">Kullandıklarımız</h2>
            <div className="overflow-x-auto border border-rule rounded-2xl">
              <table className="w-full text-sm" data-testid="cookie-table">
                <thead className="bg-clay-50 text-left"><tr><th className="p-3">Ad</th><th className="p-3">Tür</th><th className="p-3">Ne için</th><th className="p-3">Süre</th></tr></thead>
                <tbody className="divide-y divide-rule">
                  {ROWS.map(([n, t, w, d]) => (<tr key={n} className="align-top"><td className="p-3 font-mono text-xs">{n}</td><td className="p-3">{t}</td><td className="p-3">{w}</td><td className="p-3">{d}</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3 text-sage-700 leading-relaxed">
            <h2 className="font-display text-3xl text-ink">Üçüncü taraflar</h2>
            <p>Ödeme sayfasında kart bilgileri Stripe ya da Iyzico'nun kendi güvenli alanlarında işlenir; bu hizmetler ödeme sırasında kendi çerezlerini kullanabilir. "Google ile devam et" seçeneğini kullanırsan Google'ın giriş sayfası açılır. Bazı görseller (örneğin örnek eğitmen fotoğrafları) dış sunuculardan yüklenebilir; bu durumda tarayıcın o sunucuya istek gönderir.</p>
            <h2 className="font-display text-3xl text-ink pt-4">Çerezleri yönetmek</h2>
            <p>Çerezleri tarayıcı ayarlarından silebilir ya da engelleyebilirsin; ancak zorunlu çerezleri engellersen giriş yapamazsın. Sorular için canlı destekten bize yazabilirsin.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
