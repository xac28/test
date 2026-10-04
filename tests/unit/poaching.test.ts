import { describe, it, expect } from "vitest"
import { scanPoaching } from "../../src/lib/poaching"

const teacherBad = [
  "Instagram: ayse.yoga", "bana instagramdan ulaş", "w h a t s a p p numaram", "wp 0532 123 45 67", "@ayse_yoga takip et", "kendi kursuma gel",
  "benimle iletişime geç", "Telegram grubuma katıl", "dm atın", "ödemeyi havale ile yaparız", "platform dışında ders veririm", "1nstagram", "i.n.s.t.a", "t.me/ayse",
  "ayse@gmail.com", "contact me on whatsapp", "komisyon vermeden daha ucuza ders veririm", "ig: ayse.yoga", "IBAN TR12 3456 7890 1234 5678 9012 34", "stüdyoma gelin",
  "özelden yaz", "youtube kanalımı izle", "TikTok'ta bul", "papara ile öde", "my own course starts monday", "outside the platform",
]
const teacherOk = [
  "Sabah vinyasa akışı ve nefes çalışması", "10 yıllık deneyimli hatha eğitmeniyim", "Yoga yaparken nefesine dikkat et", "Merhaba, ders saatimizi onaylıyorum",
  "Bu poz için x ekseninde dönüş", "Instruktör olarak 5 yıldır çalışıyorum", "Pazartesi 19:00'da buluşalım", "Eğitim programım 8 haftalık bir akıştır",
  "Derslerimde hareket ve nefes bir arada", "Başlangıç seviyesi için nazik bir akış", "Sertifikalı Yin yoga eğitmeniyim",
]

describe("teacher texts", () => {
  for (const t of teacherBad) it(`blocks: ${t}`, () => expect(scanPoaching(t, { teacher: true }).clean).toBe(false))
  for (const t of teacherOk) it(`allows: ${t}`, () => expect(scanPoaching(t, { teacher: true }).clean).toBe(true))
  it("tells what it found", () => {
    const r = scanPoaching("Instagram: ayse.yoga, WhatsApp 0532 123 45 67, kendi kursuma gel", { teacher: true })
    expect(r.kinds).toEqual(expect.arrayContaining(["SOCIAL", "MESSENGER", "PHONE", "OFFPLATFORM"]))
    expect(r.matches.length).toBeGreaterThan(2)
  })
})

describe("everybody else", () => {
  it("only contact data and handles count, not 'my course' phrases", () => {
    expect(scanPoaching("kendi kursuma gel").clean).toBe(true)
    expect(scanPoaching("instagram: ayse.yoga").clean).toBe(false)
    expect(scanPoaching("@ayse_yoga").clean).toBe(false)
    expect(scanPoaching("ayse@gmail.com").clean).toBe(false)
    expect(scanPoaching("Bu poz çok güzel ig").clean).toBe(true)
  })
})
