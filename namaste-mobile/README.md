# AYA Mobil (Expo)

iOS ve Android için React Native + Expo uygulaması. Web sitesiyle aynı sunucuyu ve aynı API'yi kullanır.

## Çalıştırma

```bash
cd namaste-mobile
npm install
EXPO_PUBLIC_API_BASE=https://aya.ornek.com npx expo start     # sunucunun adresi; verilmezse constants.ts'deki varsayılan kullanılır
npx tsc --noEmit                                                # tür denetimi
```

## Neler var
- E-posta/şifre ile kayıt ve giriş (sözleşme kutusu zorunlu), **şifremi unuttum** (e-postayla sıfırlama bağlantısı)
- **Pratik**: yaklaşan/tamamlanan dersler, canlı derse katılma
- **Pozlar**: 17 pozun listesi (arama, kategori süzgeci), poz ayrıntısı (nasıl yapılır, faydalar, dikkat, kolay/zor seçenek, dengeleyen pozlar) ve **yoga stilleri** (kimler için, örnek ders, SSS). Veri `GET /api/poses`, `/api/styles` uç noktalarından gelir. 3B model web'de açılır ("3B modeli web'de döndür").
- **Eğitmenler**: liste ve ders ayırma
- **Topluluk**: üyelerin fotoğraf/video akışı, beğeni (iyimser güncelleme), sonsuz kaydırma, yenilemek için aşağı çek
- **AYA Rehber**: web'deki rehberle aynı motor (`/api/ai/recommend`); yönlendirdiği sayfalar tarayıcıda açılır
- **Profil**: bilgiler, fotoğraf yükleme, eğitmenler için ders videoları, **e-posta doğrulama hatırlatması**, **verilerimi indir/paylaş**, **hesabımı sil**
- Canlı ders odası (LiveKit) ve "sorun bildir" penceresi
- Tüm arayüz Türkçe; renkler web ile aynı (`constants.ts`)

## Henüz yok / bilinmesi gerekenler
- Mesajlaşma sekmesi şimdilik bilgi ekranı (mesajlar web sitesinden).
- Bu ortamda yalnızca tür denetimi ve Android paketleme (`expo export`) doğrulandı; gerçek cihazda veya emülatörde çalıştırılmadı.
- Push bildirimi jetonu sunucuya `POST /api/notifications/push-token` ile kaydedilir; bildirimler en iyi çabayla gönderilir.
