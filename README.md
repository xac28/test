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
| **Bildirim (rapor) sistemi** | Canlı yayın, sohbet mesajı, eğitmen profili, atölye ve ders için "Bildir" penceresi (kategori + açıklama). Bildirilen kişi **sunucuda** hedefe göre belirlenir; kendini bildirme, 24 saatlik tekrar, saatlik 5 / günlük 15 sınırı engellenir. Aynı kişiyi son 14 günde **3 farklı kullanıcı** bildirirse tüm açık raporlar **Acil** olur. Bildirenler `/dashboard/reports` sayfasında yalnızca genel durumu görür (iç notlar asla gösterilmez); uyarılar panelde "Okudum" onayıyla gösterilir |
| **Yönetim paneli** | Türkçe, `/admin?tab=…` (URL ile senkron, kenar çubuğunda bekleyen iş sayıları): **Genel Bakış** (bekleyen işler, 14 günlük grafik, sistem sağlığı) · **Raporlar** (öncelik sırası, filtre/arama, toplu işlem, kanıt, iç not, uyar / yasakla / eğitmen onayını kaldır / yayını kapat / atölyeyi kaldır, geçmiş) · **Kullanıcılar** (sunucu tarafı arama, ayrıntı çekmecesi, uyarı, nedenli yasak, IP geçmişi) · Güvenlik (IP engelleri) · Denetim kayıtları · Başvurular · Deneme odaları · Atölyeler · İçerikler · Canlı oturumlar · Rezervasyonlar · Ders kayıtları (yalnızca üst bilgi, silme) · Ödeme talepleri · Finans. Tüm kritik işlemler gerekçe ister ve denetim kaydına yazılır; listeler CSV olarak indirilebilir |
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
```

## Notlar

- Otomatik IP engeli yerel/özel ağ adreslerine (127.x, 10.x, 192.168.x, 172.16–31.x, IPv6 yerel) uygulanmaz; bir proxy arkasında herkesi kilitlemesin diye. Yönetici kendi IP'sini engelleyemez.
- Yönetici API'leri ortak `requireAdmin` ile korunur (oturum çerezi ya da mobil Bearer): giriş yoksa 401, yönetici değilse 403.
- Kayıtlar `storage/recordings/` altında (özel klasör, statik sunulmaz). `POST /api/cron/cleanup-recordings` (CRON_SECRET ile) süresi dolanları siler — günde bir çağırın.
- Yüklenen dosyalar `public/uploads/` altına yazılır ve `next start` altında da `/uploads/*` rotasıyla sunulur.
- Tasarım belirteçleri `tailwind.config.js` içindedir (`sage` = sıcak taş/mürekkep nötrleri, `clay` = terrakota vurgu, `cream` = kâğıt).
