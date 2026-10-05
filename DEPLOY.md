# AYA — canlıya alma rehberi

Bu rehber tek bir sunucuda (VDS) Docker ile kurulumu anlatır. Docker kullanmadan kurmak için `README.md` içindeki "Kurulum" bölümüne ve en alttaki "Docker'sız" notuna bakın.

> Bu dosyadaki Docker kurulumunu (Dockerfile, docker-compose) geliştirme ortamında **derleyip çalıştıramadım** (orada Docker sunucusu yoktu); yapılandırma dosyalarının sözdizimi ve yedek betiği doğrulandı. İlk kurulumda adımları sırayla izleyin ve `docker compose logs -f web` ile bakın.

## 1. Gerekenler
- 2 vCPU / 4 GB RAM (canlı yayın yoğunsa daha fazla), Ubuntu 22.04+, Docker 24+ ve Docker Compose.
- İki alan adı kaydı, bu makineye: `aya.ornek.com` (site) ve `live.aya.ornek.com` (LiveKit).
- Açık portlar: 80, 443 (site), 7881/tcp ve 50000–50100/udp (canlı yayın medyası).
- E-posta gönderimi için bir SMTP hesabı (Gmail uygulama şifresi olabilir): şifre sıfırlama ve e-posta doğrulama buna bağlı.

## 2. Ayarlar
```bash
cp .env.example .env
```
`.env` içinde en azından şunları doldurun (başlangıçta `[AYA] configuration warning` günlüğü eksikleri listeler):

| Değişken | Ne yapmalı |
| --- | --- |
| `AUTH_SECRET`, `CRON_SECRET` | `openssl rand -base64 32` ile üretin |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL` | `https://aya.ornek.com` |
| `ADMIN_EMAIL` | Bu adresle kayıt olan hesap yönetici olur |
| `DB_ROOT_PASSWORD`, `DB_PASSWORD` | Güçlü parolalar |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_PUBLIC_URL` | Kendi anahtar çiftiniz; `LIVEKIT_PUBLIC_URL=wss://live.aya.ornek.com` |
| `SMTP_USER`, `SMTP_PASS` | E-posta gönderimi |
| `STRIPE_*`, `IYZICO_*`, `GOOGLE_CLIENT_*` | Kullandığınız ödeme / giriş sağlayıcıları |
| `ENABLE_HSTS=true` | HTTPS çalıştıktan sonra |

## 3. Başlatma
```bash
docker compose up -d --build
docker compose logs -f web      # "[aya] schema ok" ve "configuration ..." satırlarını görün
```
Site `:3000`, LiveKit `:7880` portunda açılır. TLS için `deploy/Caddyfile` içindeki iki alan adını değiştirip Caddy'yi çalıştırın (sertifikayı kendisi alır); LiveKit için `wss://` gerektiği için ikinci blok şarttır.

Kontrol: `curl https://aya.ornek.com/api/health` → `{"status":"ok"}`.

## 4. Zamanlanmış işler (crontab)
```cron
# her gün 03:10 — süresi dolan ders kayıtlarını sil (30 gün)
10 3 * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://aya.ornek.com/api/cron/cleanup-recordings
# her 15 dakika — biten dersleri tamamlandı olarak işaretle
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://aya.ornek.com/api/cron/process-bookings
# her gün 03:30 — yedek
30 3 * * *  cd /opt/aya && BACKUP_DIR=/var/backups/aya ./deploy/backup.sh
```
Yedekleri başka bir makineye de kopyalayın (aynı diskteki yedek diski kaybedince işe yaramaz). Geri yükleme: `./deploy/restore.sh <db dosyası> [dosya arşivi]`; önce `docker compose stop web`.

## 5. Güvenlik başlıkları
- **CSP**: ilk dağıtımda varsayılan `report-only`: hiçbir şey engellenmez, ihlaller yönetim paneli → Günlükler → Sistem olayları'nda "CSP:" ile görünür. Bir hafta temiz kalırsa `.env` içinde `CSP_MODE=enforce` yapıp `docker compose up -d --build` çalıştırın. Ödeme (Stripe/Iyzico) ve Google girişi akışlarını enforce'a geçince mutlaka deneyin.
- **HSTS**: yalnızca HTTPS çalıştıktan sonra `ENABLE_HSTS=true`.

## 6. E-posta doğrulamayı zorunlu kılmak (isteğe bağlı)
Mevcut üyeler varsa önce onları doğrulanmış sayın, sonra anahtarı açın:
```bash
docker compose exec web node scripts/verify-existing-users.js
# .env: REQUIRE_EMAIL_VERIFICATION=true  →  docker compose up -d
```

## 7. Güncelleme
```bash
git pull && docker compose up -d --build
```
Şema değişiklikleri açılışta `prisma db push` ile uygulanır (veri kaybettirecek bir değişiklikse reddeder ve açılmaz; o durumda yedek alıp elle uygulayın). `AUTO_DB_PUSH=false` bunu kapatır.

## 8. Yayına çıkmadan önce son kontrol listesi
- [ ] `docker compose logs web` içinde yapılandırma uyarısı kalmadı
- [ ] Kayıt ol → doğrulama e-postası geldi → bağlantı çalıştı
- [ ] "Şifremi unuttum" e-postası geldi
- [ ] Bir deneme dersi/atölye ödemesi (test anahtarlarıyla) uçtan uca denendi
- [ ] Canlı yayın açıldı, başka bir ağdan izlendi (UDP portları açık)
- [ ] Yedek alındı ve **geri yükleme bir test makinesinde denendi**
- [ ] Kullanım şartları, gizlilik ve çerez metinleri bir hukukçu tarafından gözden geçirildi
- [ ] `/robots.txt`, `/sitemap.xml` doğru alan adını gösteriyor

## Docker'sız kurulum notu
`npm ci && npx prisma generate && npx prisma db push && NEXT_PUBLIC_SITE_URL=https://aya.ornek.com ENABLE_HSTS=true npx next build && npx next start -p 3000`; süreci `systemd` ya da `pm2` ile yönetin, MariaDB ve LiveKit'i ayrıca kurun, ters vekil olarak Caddy/Nginx kullanın.
