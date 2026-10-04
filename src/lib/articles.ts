/** Article (İçerik) helpers: reading time, a tiny safe markup parser, validation. */

export const ARTICLE_CATEGORIES = ["Yoga", "Nefes", "Meditasyon", "Felsefe", "Beslenme", "Yaşam", "Eğitmenlerden"] as const

export type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "ul"; items: string[] }

/** ~200 words per minute, never less than one minute. */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/**
 * Minimal markup so editors don't need HTML:
 *   ## Başlık        → h2          ### Alt başlık → h3
 *   > Alıntı         → quote       - madde        → list
 *   blank line       → paragraph break
 * Everything is returned as plain text blocks and rendered by React (never as raw HTML).
 */
export function parseArticleBody(body: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ").trim() })
    para = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: "ul", items: list })
    list = []
  }
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
    } else if (line.startsWith("### ")) {
      flushPara(); flushList()
      blocks.push({ type: "h3", text: line.slice(4).trim() })
    } else if (line.startsWith("## ")) {
      flushPara(); flushList()
      blocks.push({ type: "h2", text: line.slice(3).trim() })
    } else if (line.startsWith("> ")) {
      flushPara(); flushList()
      blocks.push({ type: "quote", text: line.slice(2).trim() })
    } else if (/^[-*] /.test(line)) {
      flushPara()
      list.push(line.slice(2).trim())
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return blocks.filter((b) => (b.type === "ul" ? b.items.length > 0 : b.text.length > 0))
}

export interface ArticleInput {
  title?: unknown
  excerpt?: unknown
  body?: unknown
  category?: unknown
  coverUrl?: unknown
  status?: unknown
}

export type ArticleValidation =
  | { ok: true; data: { title: string; excerpt: string; body: string; category: string; coverUrl: string | null; status: "DRAFT" | "PUBLISHED" } }
  | { ok: false; error: string }

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

export function validateArticleInput(input: ArticleInput): ArticleValidation {
  const title = str(input.title)
  if (title.length < 4 || title.length > 200) return { ok: false, error: "Başlık 4–200 karakter olmalı." }
  const excerpt = str(input.excerpt)
  if (excerpt.length < 20 || excerpt.length > 400) return { ok: false, error: "Özet 20–400 karakter olmalı." }
  const body = typeof input.body === "string" ? input.body.trim() : ""
  if (body.length < 100) return { ok: false, error: "Yazı en az 100 karakter olmalı." }
  if (body.length > 100_000) return { ok: false, error: "Yazı çok uzun." }
  const category = str(input.category)
  if (!category || category.length > 60) return { ok: false, error: "Kategori seçin." }
  const coverUrl = str(input.coverUrl) || null
  if (coverUrl && !(/^https?:\/\//i.test(coverUrl) || coverUrl.startsWith("/uploads/"))) {
    return { ok: false, error: "Kapak görseli bağlantısı geçersiz." }
  }
  return {
    ok: true,
    data: { title, excerpt, body, category, coverUrl, status: input.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT" },
  }
}
