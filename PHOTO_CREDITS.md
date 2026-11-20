# Fotoğraf kaynakları

Sitedeki fotoğraflar gerçek çekimlerdir; hiçbiri yapay zekâ ile üretilmedi. Hepsi ticari kullanıma izin veren ücretsiz lisanslarla alındı:

- **Unsplash Lisansı** (https://unsplash.com/license): ücretsiz, ticari kullanım serbest, atıf zorunlu değil. Fotoğrafları olduğu gibi tek başına satmak ya da benzer bir fotoğraf servisi kurmak yasak.
- **Pexels Lisansı** (https://www.pexels.com/license/): ücretsiz, ticari kullanım serbest, atıf zorunlu değil. Fotoğrafları olduğu gibi satmak, kişiyi kötü gösterecek şekilde kullanmak ya da ürün onayı veriyormuş gibi göstermek yasak.

Atıf zorunlu olmasa da fotoğrafçılara teşekkür olarak burada listelenir.

## Poz kütüphanesi (`public/poses/*.webp`, 900×1125)

Margaret Young, Unsplash (https://unsplash.com/@wildsoulmagsyogi), aynı stüdyoda tek seri:

| Dosya | Unsplash fotoğrafı |
| --- | --- |
| agac | photo-1767611136075-8008827aed2e |
| asagi-bakan-kopek | photo-1767611118479-3f3a8704c8ba |
| cocuk | photo-1767611118672-d3887038786c |
| dag-durusu | photo-1767611127093-8ed12ce7789d |
| deve | photo-1767611127960-6bc501f3439e |
| kayik | photo-1767611118787-cc70e92f9291 |
| kolay-oturus | photo-1767611133656-80a871fff5d4 |
| kopru | photo-1767611086180-6b1176976371 |
| malasana | photo-1767611118992-b300c4fb4bee |
| one-egilme | photo-1767611104887-2db75e031490 |
| savasana | photo-1767611104976-86ce57776dc3 |
| savasci-2 | photo-1767611131739-a009e323f62f |
| ucgen | photo-1767611132085-167725b113ae |

Pexels (bu dört poz Unsplash serisinde yoktu):

| Dosya | Pexels fotoğrafı |
| --- | --- |
| savasci-1 | https://www.pexels.com/photo/11775738/ |
| sandalye | https://www.pexels.com/photo/3823075/ |
| ayakta-yukari-uzanis | https://www.pexels.com/photo/6739050/ |
| sfenks | https://www.pexels.com/photo/6697176/ |

## Sayfa fotoğrafları (`public/photos/*.jpg`)

| Dosya | Unsplash fotoğrafı |
| --- | --- |
| hero | photo-1544367567-0f2fcb009e0b |
| meditation | photo-1506126613408-eca07ce68773 |
| studio | photo-1545205597-3d9d02c29597 |
| join | photo-1599901860904-17e6ed7083a0 |
| breath | photo-1767611038549-7cdfeb77bdd8 (Margaret Young) |

## Kapak yedekleri (`public/photos/covers/*.jpg`, 1200×800)

Kendi görseli olmayan atölye, yazı ve podcast kartlarında konuya göre (nefes, meditasyon, yin…) gösterilir (`topicPhoto`, `src/lib/photos.ts`). Hepsi Margaret Young serisinin yatay kareleri: akis (aşağı bakan köpek), cocuk, dag, kayik, kopru, savasana, savasci — dosya kimlikleri yukarıdaki poz tablosundakilerle aynıdır.

Bir fotoğrafı değiştirmek için aynı adla (ve aynı en/boy oranıyla) dosyanın üzerine yazın ve `src/lib/photos.ts` içindeki `PHOTO_VERSION` değerini bir artırın: tarayıcılar eski kopyayı göstermek yerine yenisini indirir.
