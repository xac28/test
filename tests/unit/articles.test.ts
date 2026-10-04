import { describe, it, expect } from "vitest"
import { readingMinutes, parseArticleBody, validateArticleInput } from "@/lib/articles"
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
