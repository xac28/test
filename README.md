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
| Yönetim paneli | Türkçe; başvurular, **ödeme talepleri onayı**, içerikler, canlı odalar, kullanıcılar, güvenlik |
| Mobil | Kayıt kutusu + kabul ekranı, fotoğraf/video yükleme (avatar, eğitmen videoları) |

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

- Kayıtlar `storage/recordings/` altında (özel klasör, statik sunulmaz). `POST /api/cron/cleanup-recordings` (CRON_SECRET ile) süresi dolanları siler — günde bir çağırın.
- Yüklenen dosyalar `public/uploads/` altına yazılır ve `next start` altında da `/uploads/*` rotasıyla sunulur.
- Tasarım belirteçleri `tailwind.config.js` içindedir (`sage` = sıcak taş/mürekkep nötrleri, `clay` = terrakota vurgu, `cream` = kâğıt).
