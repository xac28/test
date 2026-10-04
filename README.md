# AYA

Yoga, nefes ve meditasyon için bir okul: sertifikalı eğitmenlerle **birebir dersler**, herkese açık **canlı yayınlar**, küçük gruplarla **atölyeler** ve **içerikler** (yazılar).
Web (Next.js 14) + mobil uygulama (Expo, `namaste-mobile/` klasörü — adı değişmedi) + LiveKit ile canlı video.

## Özellikler

| Alan | Neler var |
| --- | --- |
| Birebir dersler | Eğitmen arama, rezervasyon, ödeme (Stripe / Iyzico), canlı oda |
| **Canlı yayın** | `/live` rehber, `/live/[id]` izleyici (Otomatik / 1080p / 720p / 360p / yalnız ses, tiyatro modu, PiP, istatistikler, sohbet), `/live/studio` stüdyo (1080p60'a kadar 6 kalite ön ayarı, simulcast, cihaz seçimi, yayın sağlığı, sohbet yönetimi, ekran paylaşımı) |
| **Ders kaydı** | Öğretmen "Dersi kaydet"e basar → tarayıcı odayı kaydeder, 5 sn'lik parçalar sunucuya yüklenir → yalnızca o dersin öğretmeni ve öğrencisi indirir → **30 gün** sonra otomatik silinir |
| **Atölyeler** | `/atolyeler` — canlı (kontenjanlı) ve kayıtlı atölyeler; ücretli atölyede yer ayrılır, ödeme eğitmen tarafından onaylanınca katılım kesinleşir; atölye yayınları yalnızca onaylı katılımcılara açıktır |
| **İçerikler** | `/icerikler` — yönetim panelinden yazılan, taslak/yayın akışı olan yazılar |
| Sözleşme | Kayıtta zorunlu kutu (web + mobil API), kabul etmemiş kullanıcılar için "sözleşme kapısı" (`/accept-terms`) |
| **Bildirim (rapor) sistemi** | Canlı yayın, sohbet mesajı, eğitmen profili, atölye, ders, topluluk fotoğrafı ve yorum için "Bildir" penceresi (kategori + açıklama). Bildirilen kişi **sunucuda** hedefe göre belirlenir; kendini bildirme, 24 saatlik tekrar, saatlik 5 / günlük 15 sınırı engellenir. Aynı kişiyi son 14 günde **3 farklı kullanıcı** bildirirse tüm açık raporlar **Acil** olur. Bildirenler `/dashboard/reports` sayfasında yalnızca genel durumu görür (iç notlar asla gösterilmez); uyarılar panelde "Okudum" onayıyla gösterilir |
| **Topluluk** | `/community` — fotoğraf paylaşımı (yalnızca kendi yüklediğin dosya kabul edilir), beğeni (iyimser arayüz, çift dokunuşa dayanıklı), yorum, silme ve bildirme. **Otomatik denetim** (`src/lib/profanity.ts`, aynı kod tarayıcıda canlı uyarı verir, sunucuda son sözü söyler): Türkçe/İngilizce küfür, hakaret, nefret ve tehdit; yazım oyunları (`s.i.k.t.i.r`, `$1kt1r`, `siiiktir`, boşluklu harfler); bağlantı / e-posta / telefon / IBAN / mesajlaşma hesabı; spam biçimi (BAĞIRMA, emoji yığını, tekrar). İhlalli metin **yayınlanmaz ve saklanmaz**, yanıtta kelime tekrar edilmez; olay maskeli özetle kaydedilir. Tekrarında kademeli susturma (saatte 3 ihlal → 15 dk, günde 6 → 24 sa + otomatik resmi uyarı + yöneticilere bildirim). Yorum taşkını/yinelenen yorum sınırı. Yeni üyelerin ilk fotoğrafları **yönetici onayı** bekler (görseli yazılım güvenilir yargılayamaz); 2 onaylı paylaşımdan sonra anında yayınlanır. Kurallar: `/community/rules` |
| **Bildirimler** | Navbar'da zil (okunmamış sayısı, 30 sn'de bir yenilenir) ve `/dashboard/notifications`. Beğeniler tek satırda birleşir ("Ayşe ve 3 kişi daha…"). Beğeni, yorum, fotoğraf onayı/reddi, içerik kaldırma, uyarı, susturma ve rapor sonucu bildirim üretir. Mobil uygulama Expo push belirtecini `POST /api/notifications/push-token` ile kaydeder; push en iyi çabayla gönderilir |
| **AYA Rehber (yardımcı yapay zeka)** | Sağ alttaki pencere. Yerleşik bilgi tabanı + yönlendirme + **yöneticilerin öğrettiği cevaplar** (öğretilenler önce kullanılır). Bilmediği soruyu "öğreneceğim" diyerek kaydeder (kişisel veriler maskelenir); yönetici **Yapay Zeka → Bilinmeyen sorular**'dan cevabı öğretir, soruyu soran üyelere bildirim gider. Her cevabın altında **"Yardımcı oldu mu?"**: 👎 → "Canlı destekle konuş". "canlı destek / yetkili / insanla konuşmak istiyorum" yazmak da sohbeti **canlı desteğe** açar |
| **Canlı destek** | Üye ↔ yönetici görüşmesi (Rehber penceresinde ya da `/dashboard/support`). 4 sn'de bir yoklanır, yanıt gelince zil bildirimi; kullanıcı kapatıp 1-5 puan verir. Yönetici tarafı: kuyruk (yanıt bekleyen / açık / benim / kapalı), hazır yanıtlar, iç not (üye görmez), üstlen, öncelik, ilk yanıt süresi ve memnuniyet istatistiği, CSV, "bu cevabı Rehber'e öğret" |
| **Değerlendirmeler** | Eğitmen profilinde öğrenci yorumları görünür; her yorumda **Bildir** düğmesi. Yazılı yorum topluluk filtresinden geçer. Yönetici **Değerlendirmeler** sekmesinden (ya da rapor çekmecesinden) kaldırır/geri yükler; kaldırılan yorum puan ortalamasından çıkar |
| **Günlükler** | `/admin?tab=audit`: **Sistem olayları** (girişler, başarısız girişler, kayıtlar, yüklemeler, Rehber boşlukları, destek, güvenlik; seviye/tür/dönem/arama, saatlik grafik, canlı izleme, CSV, ayrıntı) ve **Yönetici işlemleri** (Türkçe etiketli, konu ve dönem filtreli, CSV) |
| **Video yükleme** | Eğitmen panelinde "Kayıtlı dersler": dosya yükle (ilerleme çubuğu, ≤500 MB, MP4/WebM/MOV) ya da https bağlantısı; profilde yerinde oynatılır (Range/ileri sarma desteği). Bağlantılar doğrulanır (`javascript:`, başkasının dosyası, http reddedilir) |
| **Yönetim paneli** | Türkçe, `/admin?tab=…` (URL ile senkron, kenar çubuğunda bekleyen iş sayıları): **Genel Bakış** (bekleyen işler, 14 günlük grafik, sistem sağlığı) · **Raporlar** (öncelik sırası, filtre/arama, toplu işlem, kanıt, iç not, uyar / yasakla / eğitmen onayını kaldır / yayını kapat / atölyeyi kaldır / içeriği kaldır, geçmiş) · **Canlı destek** · **Yapay zeka** (bilinmeyen sorular, geri bildirim, öğretilenler) · **Değerlendirmeler** · **Fotoğraflar** (onay kuyruğu, yorumlar, filtre istatistikleri, ek yasaklı kelimeler, filtre deneme kutusu, susturulanlar) · **Kullanıcılar** (sunucu tarafı arama, ayrıntı çekmecesi, uyarı, nedenli yasak, IP geçmişi) · Güvenlik (IP engelleri) · Denetim kayıtları · Başvurular · Deneme odaları · Atölyeler · İçerikler · Canlı oturumlar · Rezervasyonlar · Ders kayıtları (yalnızca üst bilgi, silme) · Ödeme talepleri · Finans. Tüm kritik işlemler gerekçe ister ve denetim kaydına yazılır; listeler CSV olarak indirilebilir |
| Mobil | Kayıt kutusu + kabul ekranı, fotoğraf/video yükleme (avatar, eğitmen videoları), ders odasında "Sorun bildir" |

## Kurulum

```bash
npm install
cp .env.example .env        # değerleri doldurun
npx prisma db push          # MySQL / MariaDB şemasını oluşturur
npm run seed:demo           # (isteğe bağlı) örnek eğitmen, atölye ve yazılar — şifre: Passw0rd!
npm run dev                 # http://localhost:3000
```

Canlı video için bir LiveKit sunucusu gerekir (`livekit-server --dev` ya da Docker). İstemci `livekit-client` 2.18 olduğundan **LiveKit sunucusu ≥ 1.9** olmalıdır (depodaki `livekit-server.exe` 1.11'dir).

## Testler

```bash
npm test                 # birim testleri (vitest)
npm run test:api         # API entegrasyon testleri — çalışan sunucu + veritabanı gerekir
npm run test:e2e         # tarayıcı testleri (Playwright) — sunucu + LiveKit gerekir
npm run typecheck        # tsc
AYA_RECORD_DIR=tour-output/videos npx playwright test tests/e2e/tour.spec.ts   # sitenin tamamını gezen, video kaydeden tur testi (ekran görüntüleri tour-output/ altına)
```

## Notlar

- Otomatik IP engeli yerel/özel ağ adreslerine (127.x, 10.x, 192.168.x, 172.16–31.x, IPv6 yerel) uygulanmaz; bir proxy arkasında herkesi kilitlemesin diye. Yönetici kendi IP'sini engelleyemez.
- Yönetici API'leri ortak `requireAdmin` ile korunur (oturum çerezi ya da mobil Bearer): giriş yoksa 401, yönetici değilse 403.
- Görseller: `public/photos/{hero,studio,meditation,join,breath}.jpg` önce kullanılır, yoksa stok fotoğraf, o da yüklenmezse renkli zemin. Mevcut dosyalar `node scripts/render-photos/render.js` ile three.js'ten üretilmiş özgün illüstrasyonlardır; kendi fotoğraflarını aynı adlarla üzerine kopyalayabilirsin.
- AYA Rehber (`/api/ai/recommend`): model/ağ gerektirmez. `src/lib/ai-guide.ts` niyet ve yönlendirme, `src/lib/ai-knowledge.ts` sohbet + yoga/nefes/meditasyon/platform bilgi tabanıdır (yeni cevap eklemek için bir `E(...)` satırı yeter; testler `tests/unit/ai-*.test.ts`).
- Kayıtlar `storage/recordings/` altında (özel klasör, statik sunulmaz). `POST /api/cron/cleanup-recordings` (CRON_SECRET ile) süresi dolanları siler — günde bir çağırın.
- Yüklenen dosyalar `public/uploads/` altına yazılır ve `next start` altında da `/uploads/*` rotasıyla sunulur.
- Tasarım belirteçleri `tailwind.config.js` içindedir (`sage` = sıcak taş/mürekkep nötrleri, `clay` = terrakota vurgu, `cream` = kâğıt).
