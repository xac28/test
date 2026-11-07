import Link from "next/link"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { DAILY_STRIKES_FOR_LONG_MUTE, HOURLY_STRIKES_FOR_MUTE, LONG_MUTE_MIN, SHORT_MUTE_MIN } from "@/lib/moderation"
import { POLICY_LADDER_TR } from "@/lib/policy-ladder"
import { COMMENT_MAX, MAX_POSTS_PER_HOUR, POST_MAX } from "@/lib/community"

export const metadata = { title: "Topluluk kuralları" }

const RULES = [
  { t: "Saygı her şeyden önce", d: "Küfür, hakaret, aşağılama, nefret söylemi ve tehdit yok. Farklı seviyeler, bedenler ve inançlar burada eşit karşılanır." },
  { t: "Kendi fotoğrafını paylaş", d: "Pratiğinden, stüdyonuzdan ya da doğadan kendi çektiğin kareleri paylaş. Başkasının fotoğrafını izinsiz yükleme; müstehcen ya da şiddet içeren görseller yasaktır." },
  { t: "Reklam ve iletişim bilgisi yok", d: "Bağlantı, e-posta, telefon, IBAN ve mesajlaşma hesabı paylaşımı engellenir. İletişim ve ödemeler güvenliğin için AYA üzerinden yapılır." },
  { t: "Spam yapma", d: `Aynı yorumu tekrarlama, büyük harfle bağırma, emoji yağmuru yapma. Saatte en fazla ${MAX_POSTS_PER_HOUR} fotoğraf, açıklama ${POST_MAX}, yorum ${COMMENT_MAX} karakterle sınırlıdır.` },
  { t: "Gördüğünü bildir", d: "Kurallara aykırı bir fotoğraf ya da yorum görürsen bayrak simgesiyle bildir. Yöneticiler inceler; bildiren kişinin kimliği gizli kalır." },
]

export default function RulesPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="eyebrow mb-4">Topluluk</p>
        <h1 className="font-display font-light text-5xl leading-[1.05] mb-4">Birlikte nasıl <em className="italic text-clay-500">davranırız?</em></h1>
        <p className="text-sage-600 mb-10">AYA topluluğu sakin, güvenli ve nazik kalsın diye birkaç basit kural koyduk.</p>

        <ol className="space-y-6">
          {RULES.map((r, i) => (
            <li key={r.t} className="flex gap-5">
              <span className="font-display text-4xl text-clay-500 leading-none w-8 shrink-0">{i + 1}</span>
              <div>
                <h2 className="font-display text-2xl mb-1">{r.t}</h2>
                <p className="text-sage-700 leading-relaxed">{r.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-14 border-t border-rule pt-10" aria-labelledby="how">
          <h2 id="how" className="font-display text-3xl mb-4">Otomatik denetim nasıl çalışır?</h2>
          <ul className="space-y-3 text-sage-700 leading-relaxed list-disc pl-5">
            <li>Her yorum, açıklama ve mesaj yayınlanmadan önce küfür, hakaret, iletişim bilgisi ve spam için taranır. Kurala aykırı bir ifade yayınlanmaz; yazım oyunları (boşluk, rakam, harf tekrarı) da yakalanır.</li>
            <li>Kısa sürede tekrarlayan ihlaller geçici susturmaya yol açar: bir saatte {HOURLY_STRIKES_FOR_MUTE} ihlalde {SHORT_MUTE_MIN} dakika, bir günde {DAILY_STRIKES_FOR_LONG_MUTE} ihlalde {Math.round(LONG_MUTE_MIN / 60)} saat. Çok tekrarlayanlara yöneticiler resmi uyarı verir.</li>
            <li>Fotoğrafları bir yazılım güvenilir biçimde değerlendiremez; bu yüzden yeni üyelerin ilk fotoğrafları yönetici onayından geçer. İki onaylı paylaşımdan sonra fotoğrafların anında yayınlanır.</li>
            <li>Kaldırılan içeriklerin sahibine nedeniyle birlikte bildirim gider. Yanlış bir karar olduğunu düşünüyorsan <Link href="/dashboard/reports" className="underline">bildirimlerim</Link> sayfasından bize yaz.</li>
          </ul>
        </section>

        <section className="mt-14 border-t border-rule pt-10" aria-labelledby="teachers-rules" data-testid="teacher-rules">
          <h2 id="teachers-rules" className="font-display text-3xl mb-3">Eğitmenler için: platform dışına yönlendirme yasak</h2>
          <p className="text-sage-700 leading-relaxed mb-5">AYA'da öğrencilerle iletişim ve ödeme yalnızca platform üzerinden yapılır. Profilde, atölye ve video açıklamalarında, yayın başlığında, mesajlarda ya da sohbette <strong>sosyal medya hesabı, WhatsApp/telefon, e-posta, harici bağlantı, "kendi kursuma gel", "dışarıdan ödeme"</strong> gibi yönlendirmeler otomatik engellenir, yönetim paneline kaydedilir ve kademeli yaptırıma bağlanır:</p>
          <ol className="space-y-3">
            {POLICY_LADDER_TR.map((l) => (
              <li key={l.strike} className="flex gap-4 items-start"><span className="font-display text-4xl text-clay-500 w-8 leading-none">{l.strike}</span><div><p className="font-semibold">{l.action}</p><p className="text-sm text-sage-600">{l.detail}</p></div></li>
            ))}
          </ol>
          <p className="text-sm text-sage-500 mt-4">Aynı mesajı kısa süre içinde yeniden denemek yeni ihlal sayılmaz. Yanlış alarm olduğunu düşünüyorsan Canlı Destek'e yaz; yönetim ihlali inceleyip affedebilir.</p>
        </section>

        <div className="mt-12"><Link href="/community" className="inline-flex items-center px-6 py-3 bg-ink text-cream rounded-md text-sm font-medium hover:bg-sage-800 transition-colors">Topluluğa dön</Link></div>
      </main>
      <Footer />
    </>
  )
}
