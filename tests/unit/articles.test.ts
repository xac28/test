import { describe, it, expect } from "vitest"
import { readingMinutes, parseArticleBody, validateArticleInput, ARTICLE_CATEGORIES, ARTICLE_ADMIN_CATEGORIES, NEWS_CATEGORIES, NON_EDITORIAL_CATEGORIES, PODCAST_CATEGORY } from "@/lib/articles"
import { SHOP_CATEGORIES, SHOP_BY_SLUG } from "@/lib/shop"
import { slugify, uniqueSlug } from "@/lib/slug"

describe("slugify", () => {
  it("transliterates Turkish characters", () => {
    expect(slugify("Sabah Yogası: Güneşe Selam")).toBe("sabah-yogasi-gunese-selam")
    expect(slugify("ÇIĞIR ÖĞRETİ ŞÜKÜR")).toBe("cigir-ogreti-sukur")
    expect(slugify("  --Nefes & Beden!!  ")).toBe("nefes-beden")
  })
  it("never returns an empty slug and caps the length", () => {
    expect(slugify("???")).toBe("icerik")
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(70)
  })
  it("uniqueSlug differs between calls", () => {
    expect(uniqueSlug("Aynı Başlık")).not.toBe(uniqueSlug("Aynı Başlık"))
    expect(uniqueSlug("Aynı Başlık")).toMatch(/^ayni-baslik-[a-z0-9]{1,5}$/)
  })
})

describe("readingMinutes", () => {
  it("rounds ~200 wpm and is at least 1", () => {
    expect(readingMinutes("kısa")).toBe(1)
    expect(readingMinutes("kelime ".repeat(1000))).toBe(5)
  })
})

describe("parseArticleBody", () => {
  it("parses headings, paragraphs, quotes and lists", () => {
    const blocks = parseArticleBody("## Başlık\n\nBirinci satır\nikinci satır\n\n> Alıntı\n\n- bir\n- iki\n\n### Alt\nSon")
    expect(blocks).toEqual([
      { type: "h2", text: "Başlık" },
      { type: "p", text: "Birinci satır ikinci satır" },
      { type: "quote", text: "Alıntı" },
      { type: "ul", items: ["bir", "iki"] },
      { type: "h3", text: "Alt" },
      { type: "p", text: "Son" },
    ])
  })
  it("treats HTML as plain text (it is rendered by React, never injected)", () => {
    expect(parseArticleBody("<script>alert(1)</script>")).toEqual([{ type: "p", text: "<script>alert(1)</script>" }])
  })
  it("handles CRLF and empty input", () => {
    expect(parseArticleBody("a\r\n\r\nb")).toHaveLength(2)
    expect(parseArticleBody("")).toEqual([])
  })
})

describe("validateArticleInput", () => {
  const ok = { title: "Nefesin Sessiz Gücü", excerpt: "Nefes çalışmasının sinir sistemi üzerindeki etkisine kısa bir bakış.", body: "x".repeat(150), category: "Nefes" }
  it("accepts a valid article, defaulting to DRAFT", () => {
    const v = validateArticleInput(ok)
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.data.status).toBe("DRAFT")
    const p = validateArticleInput({ ...ok, status: "PUBLISHED" })
    if (p.ok) expect(p.data.status).toBe("PUBLISHED")
  })
  it("rejects short fields and bad cover urls", () => {
    expect(validateArticleInput({ ...ok, title: "ab" }).ok).toBe(false)
    expect(validateArticleInput({ ...ok, excerpt: "kısa" }).ok).toBe(false)
    expect(validateArticleInput({ ...ok, body: "kısa" }).ok).toBe(false)
    expect(validateArticleInput({ ...ok, category: "" }).ok).toBe(false)
    expect(validateArticleInput({ ...ok, coverUrl: "data:text/html,<script>" }).ok).toBe(false)
    expect(validateArticleInput({ ...ok, coverUrl: "/uploads/x.jpg" }).ok).toBe(true)
  })
})

describe("site sections (menu categories)", () => {
  it("Yazılar menu has the five sketched categories, kept apart from news and podcast", () => {
    expect([...ARTICLE_CATEGORIES]).toEqual(["Sağlık", "Beslenme", "Hareket", "Kişisel Gelişim", "Bakım"])
    expect([...NEWS_CATEGORIES]).toEqual(["Duyurular", "Haberler"])
    expect(NON_EDITORIAL_CATEGORIES).toEqual(["Duyurular", "Haberler", PODCAST_CATEGORY])
    for (const c of ARTICLE_CATEGORIES) expect(NON_EDITORIAL_CATEGORIES).not.toContain(c)
    expect(ARTICLE_ADMIN_CATEGORIES).toHaveLength(ARTICLE_CATEGORIES.length + NEWS_CATEGORIES.length + 1)
  })

  it("every admin category passes article validation", () => {
    for (const category of ARTICLE_ADMIN_CATEGORIES) {
      const r = validateArticleInput({ title: "Bir başlık", excerpt: "x".repeat(30), body: "y".repeat(120), category, status: "PUBLISHED" })
      expect(r.ok).toBe(true)
    }
  })

  it("shop categories match the menu and resolve by slug", () => {
    expect(SHOP_CATEGORIES.map((c) => c.slug)).toEqual(["wellness", "matlar", "aromaterapi"])
    for (const c of SHOP_CATEGORIES) {
      expect(SHOP_BY_SLUG[c.slug]).toBe(c)
      expect(c.plans.tr.length).toBeGreaterThan(0)
      expect(c.plans.en).toHaveLength(c.plans.tr.length)
    }
    expect(SHOP_BY_SLUG["yok"]).toBeUndefined()
  })
})
