import { describe, expect, it } from "vitest"
import { checkArticle, draftNewsletter, keywords, plainText, sentences, summarize, titleIdeas, wordCount } from "@/lib/writing"

const ARTICLE = `## Yin yoga nedir?

Yin yoga, duruşların üç ila beş dakika boyunca tutulduğu yavaş ve derin bir esneme pratiğidir. Kasları değil, bağ dokusunu ve eklemleri hedefler. Bu yüzden yin yoga, günün yorgunluğunu atmak isteyenler için çok uygundur.

> Yavaşlamak da bir hareket biçimidir.

Dr. Ayşe Kaya'ya göre düzenli yin yoga uykuyu iyileştirir. Pratiğe başlamadan önce ısınmak gerekmez, ama bedenini dinlemek şarttır. Ağrı hissedersen duruştan çık.

### Nasıl başlanır?

- Haftada iki kez 20 dakika ayır
- Sessiz bir oda seç
- Nefesini yavaşlat

Nefes yin yogada en önemli araçtır; her duruşta nefesi izlemek zihni de sakinleştirir. Detaylar için https://aya.example/yin adresine bak. Sakin bir akşam pratiği uykuya geçişi kolaylaştırır.`

describe("text helpers", () => {
  it("keeps the prose and drops markup, links and quotes' markers", () => {
    const t = plainText(ARTICLE)
    expect(t).not.toMatch(/##|>|https?:|\*\*|^- /m)
    expect(t).toContain("Yin yoga, duruşların")
    expect(t).not.toContain("Nasıl başlanır?") // headings are not prose
    expect(plainText("**kalın** ve [bağlantı](https://x.com) _eğik_")).toBe("kalın ve bağlantı eğik")
  })

  it("splits sentences without breaking on abbreviations or decimals", () => {
    const s = sentences("Dr. Ayşe Kaya anlattı. Puan 4.5 oldu! Peki sonra ne oldu? Hiçbir şey.")
    expect(s[0]).toBe("Dr. Ayşe Kaya anlattı.")
    expect(s).toContain("Puan 4.5 oldu!")
    expect(s.length).toBe(4)
    expect(sentences("")).toEqual([])
  })

  it("counts words and finds the main words in their commonest spelling", () => {
    expect(wordCount("  bir iki   üç ")).toBe(3)
    expect(wordCount("")).toBe(0)
    const k = keywords(plainText(ARTICLE), 8)
    expect(k.slice(0, 3).map((x) => x.word)).toEqual(expect.arrayContaining(["yoga", "yin"]))
    expect(k.length).toBeGreaterThanOrEqual(5)
    expect(keywords("", 5)).toEqual([])
  })
})

describe("summary", () => {
  it("picks the sentences that carry the text, in order, within the limit", () => {
    const s = summarize(ARTICLE, { max: 200 })
    expect(s.length).toBeLessThanOrEqual(200)
    expect(s.length).toBeGreaterThan(60)
    expect(s.startsWith("Yin yoga, duruşların")).toBe(true) // the opening sentence leads
    expect(s).not.toMatch(/##|>|https?:/)
    expect(summarize(ARTICLE, { max: 200 })).toBe(s) // same text, same summary
  })

  it("trims a single long sentence at a word boundary", () => {
    const long = `${"Yoga ".repeat(80)}nefes alma pratiği çok uzun bir cümledir.`
    const s = summarize(long, { max: 120 })
    expect(s.length).toBeLessThanOrEqual(120)
    expect(s.endsWith("…")).toBe(true)
    expect(s).not.toMatch(/\s…$/)
  })

  it("handles short and empty input", () => {
    expect(summarize("", { max: 100 })).toBe("")
    expect(summarize("Kısa bir cümle ama yine de anlamlı.", { max: 100, min: 5 })).toBe("Kısa bir cümle ama yine de anlamlı.")
  })
})

describe("title ideas", () => {
  it("offers headings and key-word titles, never the current title, always within limits", () => {
    const ideas = titleIdeas(ARTICLE, "Yin yoga nedir?")
    expect(ideas.length).toBeGreaterThanOrEqual(3)
    expect(ideas.length).toBeLessThanOrEqual(5)
    expect(ideas).not.toContain("Yin yoga nedir?")
    expect(new Set(ideas.map((i) => i.toLowerCase())).size).toBe(ideas.length)
    for (const i of ideas) { expect(i.length).toBeGreaterThanOrEqual(4); expect(i.length).toBeLessThanOrEqual(200) }
    expect(ideas.join(" ").toLowerCase()).toContain("yoga")
    expect(titleIdeas("", "")).toEqual([])
  })
})

describe("article checklist", () => {
  it("scores a good draft high and tells what to fix in a weak one", () => {
    const long = Array.from({ length: 6 }, (_, i) => `## Bölüm ${i + 1}\n\n${"Yoga yapmak bedeni ve zihni dinlendirir. Düzenli nefes çalışması uykuyu da iyileştirir. ".repeat(10)}`).join("\n\n")
    const good = checkArticle({ title: "Yoga ve nefes ile daha iyi uyku rehberi", excerpt: "Düzenli yoga ve nefes çalışmasının uykuya etkisini, yeni başlayanlar için adım adım ve sakin bir dille anlatan kısa bir rehber yazısı.", body: long, coverUrl: "/uploads/x.jpg" })
    expect(good.score).toBeGreaterThanOrEqual(85)
    expect(good.words).toBeGreaterThan(300)
    expect(good.readingMinutes).toBeGreaterThanOrEqual(1)
    const weak = checkArticle({ title: "Yoga", excerpt: "kısa", body: "Kısa bir not. ".repeat(10), coverUrl: null })
    expect(weak.score).toBeLessThan(50)
    const failed = weak.checks.filter((c) => !c.ok).map((c) => c.id)
    expect(failed).toEqual(expect.arrayContaining(["title-length", "excerpt-length", "length", "cover"]))
    expect(weak.checks.every((c) => c.hint.length > 5)).toBe(true)
  })

  it("flags overlong sentences and paragraphs", () => {
    const body = `${"çok ".repeat(60)}uzun bir cümle. `.repeat(3)
    const r = checkArticle({ title: "Uzun cümleler üzerine bir yazı denemesi", excerpt: "x".repeat(150), body })
    expect(r.checks.find((c) => c.id === "sentences")!.ok).toBe(false)
    expect(r.checks.find((c) => c.id === "paragraphs")!.ok).toBe(false)
  })
})

describe("newsletter draft", () => {
  const items = {
    articles: [{ title: "Yin yoga nedir?", excerpt: "Yavaş ve derin bir esneme pratiği.", url: "https://aya.example/icerikler/yin" }],
    episodes: [{ title: "Nefes üzerine", guest: "Ayşe Kaya", url: "https://aya.example/podcast/nefes" }],
    products: [{ name: "Kaymaz mat", price: "₺599,00", url: "https://aya.example/shop/urun/mat" }],
    workshops: [{ title: "Hafta sonu yin", when: "12 Ekim", url: "https://aya.example/atolyeler/yin" }],
  }
  it("writes a greeting, one block per kind, every link, and a subject that names the lead", () => {
    const d = draftNewsletter(items, { site: "https://aya.example" })
    expect(d.count).toBe(4)
    expect(d.subject).toContain("Yin yoga nedir?")
    expect(d.subject).toContain("3 yeni içerik")
    expect(d.body.startsWith("Merhaba,")).toBe(true)
    for (const url of ["icerikler/yin", "podcast/nefes", "shop/urun/mat", "atolyeler/yin"]) expect(d.body).toContain(url)
    expect(d.body).toContain("konuk: Ayşe Kaya")
    expect(d.body).toContain("₺599,00")
    expect(d.body.trim().endsWith("AYA ekibi")).toBe(true)
  })
  it("copes with one item and with none", () => {
    expect(draftNewsletter({ products: items.products }, { site: "" }).subject).toBe("AYA: Kaymaz mat")
    const none = draftNewsletter({}, { site: "" })
    expect(none.count).toBe(0)
    expect(none.subject.length).toBeGreaterThan(3)
  })
})
