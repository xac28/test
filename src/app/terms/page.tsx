"use client"

import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import LanguagePicker from "@/components/LanguagePicker"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function TermsPage() {
  const [accepted, setAccepted] = useState(false)
  const router = useRouter()

  const handleAccept = () => {
    setAccepted(true)
    setTimeout(() => {
      // Go back to the previous page (like checkout or register) after 1 second
      router.back()
    }, 1000)
  }

  return (
    <>
      <LanguagePicker />
      <Navbar />
      <main className="min-h-screen bg-cream py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="font-display text-3xl md:text-5xl text-sage-900 mb-4 tracking-tight">Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi</h1>
          <p className="text-sage-500 mb-10 font-medium">Yürürlük Tarihi: {new Date().toLocaleDateString()}</p>
          
          <div className="prose prose-sage max-w-none text-sage-800 space-y-8 bg-white p-8 md:p-14 rounded-[2rem] border border-sage-200 shadow-sm leading-relaxed text-sm md:text-base">
            
            <div className="bg-sage-50 p-6 rounded-2xl border border-sage-200 mb-8">
              <p className="font-semibold text-sage-900 m-0">ÖNEMLİ UYARI (TIBBİ SORUMLULUK REDDİ)</p>
              <p className="mt-2 text-sage-700 m-0">
                Bu platformda sunulan Yoga, Yüz Yogası, Meditasyon ve benzeri pratikler genel zindelik amaçlıdır. Hiçbir içerik tıbbi teşhis, tedavi veya doktor tavsiyesi yerine geçmez. Mevcut bir sağlık sorununuz veya fiziksel rahatsızlığınız varsa, derslere katılmadan önce mutlaka uzman bir hekime danışmanız yasal sorumluluğunuzdadır.
              </p>
            </div>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 1 – TARAFLAR VE KAPSAM</h2>
              <p>
                İşbu Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi ("Sözleşme"); www.namaste.com ("Platform") üzerinden elektronik ortamda hizmet satın alan "Öğrenci" (Alıcı) ile Platform üzerinden bu hizmeti sunan "Öğretmen" (Hizmet Sağlayıcı) ve bu iki tarafı bir araya getiren "Namaste Teknolojileri" ("Aracı Hizmet Sağlayıcı" veya "Platform Sahibi") arasındaki ticari ve hukuki kuralları, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince düzenlemektedir.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 2 – PLATFORMUN HUKUKİ STATÜSÜ VE SINIRLARI</h2>
              <ol className="list-decimal pl-5 space-y-3">
                <li><strong>Aracı Hizmet Sağlayıcı:</strong> Namaste, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun uyarınca yalnızca bir "Aracı Hizmet Sağlayıcı" (Pazaryeri) ve 5651 sayılı Kanun uyarınca "Yer Sağlayıcı"dır. Platform, Öğrenci ile Öğretmen arasında kurulan hizmet sözleşmesinin tarafı değildir.</li>
                <li><strong>Bağımsız Yüklenici:</strong> Öğretmenler, Platform'un çalışanı, işçisi, acentesi veya temsilcisi değildir. Öğretmenler, kendi inisiyatifleri ile serbest meslek erbabı veya şirket statüsünde hizmet veren <strong>bağımsız yüklenicilerdir</strong>.</li>
                <li><strong>İçerik Sorumluluğu:</strong> Namaste, Öğretmenlerin verdiği dersin kalitesini, içeriğinin bilimsel veya tıbbi doğruluğunu garanti etmez. Platform üzerinden sağlanan tavsiyelerden doğabilecek fiziksel, ruhsal zararlardan veya veri kayıplarından Namaste hiçbir surette sorumlu tutulamaz.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 3 – ÖĞRENCİNİN HAK VE YÜKÜMLÜLÜKLERİ</h2>
              <ol className="list-decimal pl-5 space-y-3">
                <li><strong>Reşit Olma:</strong> Platforma üye olmak ve hizmet satın almak için 18 yaşını doldurmuş olmak zorunludur. 18 yaşından küçüklerin katılımı ancak yasal veli/vasisinin yazılı izni ve gözetimi altında mümkündür.</li>
                <li><strong>Fiziksel Yeterlilik:</strong> Öğrenci, derslere katılmak için fiziksel ve ruhsal açıdan sağlıklı olduğunu beyan eder. Hareketler sırasında yaşanacak sakatlık, incinme veya sağlık komplikasyonlarında tüm yasal sorumluluk Öğrenci'nin kendisine aittir.</li>
                <li><strong>Davranış Kuralları:</strong> Canlı derslerde genel ahlaka, adaba ve yasalara aykırı davranışlarda bulunmak, hakaret etmek veya dersi manipüle etmek kesinlikle yasaktır. Platform, bu tür eylemlerde Öğrenci'nin hesabını derhal kapatma ve hukuki işlem başlatma hakkını saklı tutar.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 4 – ÖĞRETMENİN HAK VE YÜKÜMLÜLÜKLERİ</h2>
              <ol className="list-decimal pl-5 space-y-3">
                <li><strong>Sertifikasyon Beyanı:</strong> Öğretmen, sisteme yüklediği diploma, sertifika ve özgeçmiş bilgilerinin tamamen gerçek olduğunu taahhüt eder. Sahte evrak tespitinde, Platform maddi-manevi tazminat davası açma ve hesabı silme hakkına sahiptir.</li>
                <li><strong>Tıbbi Yönlendirme Yasağı:</strong> Öğretmen, ders sırasında hiçbir şekilde teşhis koyamaz, reçete yazamaz, tıbbi tedavi vaadinde bulunamaz.</li>
                <li><strong>Vergi Sorumluluğu:</strong> Platform, Öğretmen adına stopaj veya gelir vergisi beyanında bulunmaz. Öğretmen, elde ettiği gelir (Hakediş) üzerinden bulunduğu ülkenin mali mevzuatına göre vergi ödemekle bizzat mükelleftir.</li>
                <li><strong>Platformu Aradan Çıkarma:</strong> Öğretmen, Platform üzerinden tanıştığı bir Öğrenci'ye harici mecralardan (IBAN, nakit vb.) ödeme teklif ederek ders vermeyi (circumvention) teklif edemez. Tespiti halinde hesabı, içerideki hakedişi bloke edilerek feshedilir.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 5 – ÖDEME, KOMİSYON VE HAKEDİŞ ALTYAPISI</h2>
              <ol className="list-decimal pl-5 space-y-3">
                <li><strong>Ödeme Yöntemleri:</strong> Platform, uluslararası ödemeler için Stripe, Türkiye içi ödemeler için Iyzico, PayTR veya BDDK onaylı lisanslı ödeme kuruluşlarını kullanır.</li>
                <li><strong>Komisyon Kesintisi:</strong> Öğrencinin ödediği brüt hizmet bedelinden, Platform teknik altyapı, sunucu, video yayın maliyetleri ve pazarlama bedeli olarak belirlenen oranda (Standart %15) "Pazaryeri Hizmet Bedeli" keser.</li>
                <li><strong>Hakediş Aktarımı:</strong> Kalan meblağ (Öğretmen Hakedişi), yasal güvenlik ve charge-back (ters ibraz) inceleme sürelerinin dolmasını müteakip Öğretmenin sisteme kaydettiği banka veya Stripe Connect hesabına elektronik olarak aktarılır.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 6 – CAYMA HAKKI, İPTAL VE İADE (MESAFELİ SÖZLEŞMELER KANUNU)</h2>
              <ol className="list-decimal pl-5 space-y-3">
                <li><strong>Cayma Hakkı İstisnası:</strong> Mesafeli Sözleşmeler Yönetmeliği Md. 15/1-g ("Belirli bir tarihte veya dönemde yapılması gereken, konaklama, eşya taşıma, araba kiralama, yiyecek-içecek tedariki ve eğlence veya dinlenme amacıyla yapılan sözleşmeler") ve Md. 15/1-h ("Elektronik ortamda anında ifa edilen hizmetler") uyarınca, canlı veya dijital ders içeriklerinde normal 14 günlük yasal cayma hakkı kuralı geçerli değildir. Ancak Platform, Müşteri Memnuniyeti kapsamında aşağıdaki iptal politikasını uygular:</li>
                <li><strong>24 Saat Kuralı:</strong> Öğrenci, satın aldığı canlı derse en az <strong>24 saat kala</strong> rezervasyonu iptal ederse %100 kesintisiz iade hakkına sahiptir.</li>
                <li><strong>Geç İptaller ve No-Show:</strong> Derse 24 saatten az zaman kala yapılan iptallerde veya Öğrenci'nin derse katılmaması durumunda <strong>ücret iadesi yapılmaz</strong>, hizmet ifa edilmiş sayılır ve hakediş öğretmene geçer.</li>
                <li><strong>Öğretmen İptali:</strong> Öğretmenin derse katılmaması, geç kalması veya teknik bir arıza yaşaması durumunda Öğrenci koşulsuz olarak tam iade alır veya ders telafi edilir.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 7 – GİZLİLİK (KVKK) VE FİKRİ MÜLKİYET HAKLARI</h2>
              <ol className="list-decimal pl-5 space-y-3">
                <li><strong>Kamera ve Mikrofon Verileri:</strong> Dersler WebRTC tabanlı şifrelenmiş LiveKit altyapısı üzerinden anlık (real-time) olarak aktarılır. Platform, yasal veya adli bir karar olmadıkça özel ders oturumlarını kaydetmez ve sunucularında depolamaz.</li>
                <li><strong>Kayıt Yasağı:</strong> Öğretmen veya Öğrenci, diğer tarafın açık ve yazılı rızası olmadan ders ekranını harici yazılımlarla kaydedemez, ses kaydı alamaz, yayınlayamaz ve üçüncü kişilerle paylaşamaz. Bu kuralın ihlali 5237 sayılı Türk Ceza Kanunu (Özel Hayatın Gizliliğini İhlal) kapsamında suç teşkil eder ve Platform tarafı hemen ihraç eder.</li>
                <li><strong>Telif Hakları:</strong> Platformda bulunan tüm yazılım, tasarım, marka, logo ve teknik altyapının fikri mülkiyet hakları Namaste Teknolojilerine aittir. İzinsiz kopyalanamaz, tersine mühendislik (reverse engineering) yapılamaz.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 8 – MÜCBİR SEBEPLER VE SİSTEM KESİNTİLERİ</h2>
              <p>
                Deprem, yangın, sel gibi doğal afetler ile genel internet altyapısındaki bölgesel çökmeler, siber saldırılar, elektrik kesintileri "Mücbir Sebep" kabul edilir. Mücbir sebeplerden veya servis sağlayıcılardan (örn: AWS, LiveKit, Stripe) kaynaklanan kesintiler nedeniyle yapılamayan derslerden Platform tazminatla yükümlü tutulamaz, ancak dersin telafisi sağlanır.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-sage-900 mb-3 border-b border-sage-100 pb-2">MADDE 9 – UYUŞMAZLIKLARIN ÇÖZÜMÜ VE YETKİLİ MAHKEME</h2>
              <p>
                İşbu sözleşmenin uygulanmasından veya yorumlanmasından doğacak her türlü uyuşmazlıkta Türkiye Cumhuriyeti Yasaları esas alınacaktır. Çözülemeyen ihtilaflarda <strong>İstanbul Merkez (Çağlayan) Mahkemeleri ve İcra Daireleri</strong> kesin yetkilidir. Öğrenci (Tüketici sıfatını haiz ise), parasal sınırlar dâhilinde yerleşim yerindeki Tüketici Hakem Heyetlerine başvurma hakkına sahiptir.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t-2 border-sage-200 bg-sage-50 p-6 rounded-xl text-center">
              <p className="text-sm font-bold text-sage-900 uppercase tracking-wider mb-2">
                Elektronik Onay Beyanı
              </p>
              <p className="text-sm text-sage-700 mb-6">
                Platforma üye olan, öğretmenlik başvurusu yapan veya satın alma işleminde bulunan her kullanıcı, bu sözleşmenin tüm maddelerini okumuş, anlamış ve hür iradesiyle dijital olarak <strong>kabul ve taahhüt etmiş</strong> sayılır.
              </p>
              
              <button
                onClick={handleAccept}
                disabled={accepted}
                className={`px-8 py-4 rounded-full font-bold transition-all transform active:scale-95 flex items-center justify-center mx-auto gap-2 ${
                  accepted 
                    ? "bg-green-600 text-white shadow-inner" 
                    : "bg-sage-800 text-white hover:bg-sage-900 shadow-lg hover:shadow-xl"
                }`}
              >
                {accepted ? (
                  <>
                    <span className="text-xl">✓</span> Onaylandı
                  </>
                ) : (
                  "Okudum, Anladım, Onaylıyorum"
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
