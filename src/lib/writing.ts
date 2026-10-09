/**
 * The editors' writing helper, built on our own text analysis (no external service):
 *  - an extractive summary for the excerpt (the sentences that carry the text's main words)
 *  - title ideas from the text's key phrases
 *  - a checklist for the article (length, headings, readability, search-friendly lengths)
 *  - a newsletter draft from what was published recently
 * Pure functions: the editor runs them in the browser, the API and the tests run the same code.
 */
import { parse, stem, STOP } from "@/lib/ai/brain/nlp"

// ───────────────────────── text helpers ─────────────────────────

/** Drops the editor's markup (## headings, > quotes, - lists, **bold**) and links, keeping the prose. */
export function plainText(body: string): string {
  return body
    .replace(/^\s*#{1,3}\s+.*$/gm, " ")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const ABBREV = /\b(?:Dr|Prof|Doç|Yrd|Sn|Av|Bkz|vb|vs|yy|örn|Örn|No|St|M\.Ö|M\.S)\.$/

/** Splits prose into sentences (Turkish capitals, abbreviations, numbers like "4.5"). */
export function sentences(text: string): string[] {
  const out: string[] = []
  let cur = ""
  for (const part of text.split(/(?<=[.!?…])\s+/)) {
    cur = cur ? `${cur} ${part}` : part
    // an abbreviation or a very short fragment does not end a sentence
    if (ABBREV.test(part) || cur.length < 12) continue
    out.push(cur.trim())
    cur = ""
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

const cut = (s: string, max: number) => {
  if (s.length <= max) return s
  const at = s.lastIndexOf(" ", max - 1)
  return `${s.slice(0, at > max * 0.6 ? at : max - 1).replace(/[,;:\s]+$/, "")}…`
}

// ───────────────────────── key words ─────────────────────────

export interface Keyword { stem: string; word: string; count: number }

/** The words that carry the text, most frequent first (stems merged, shown in their most common spelling). */
export function keywords(text: string, limit = 8): Keyword[] {
  const counts = new Map<string, { n: number; forms: Map<string, number> }>()
  for (const raw of text.toLocaleLowerCase("tr-TR").split(/[^\p{L}0-9]+/u)) {
    if (raw.length < 3) continue
    const folded = parse(raw).words[0]
    if (!folded || STOP.has(folded)) continue
    const s = stem(folded)
    if (s.length < 3 || STOP.has(s)) continue
    const e = counts.get(s) ?? { n: 0, forms: new Map() }
    e.n++
    e.forms.set(raw, (e.forms.get(raw) ?? 0) + 1)
    counts.set(s, e)
  }
  return [...counts.entries()]
    .map(([s, e]) => ({ stem: s, word: [...e.forms.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0], count: e.n }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "tr"))
    .slice(0, limit)
}

/** The base form to put in a title: a plural or case ending is dropped when the stem is a real word of the text. */
const titleWord = (k: Keyword, text: string): string => {
  const lower = k.word
  const base = lower.length > k.stem.length + 2 && new RegExp(`(^|[^\\p{L}])${k.stem}([^\\p{L}]|$)`, "u").test(text.toLocaleLowerCase("tr-TR")) ? k.stem : lower
  return base
}
const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1) : s)

// ───────────────────────── summary ─────────────────────────

export interface SummaryOptions { max?: number; min?: number; sentences?: number }

/**
 * An extractive summary: sentences are scored by how many of the text's frequent words they hold (short and very long ones
 * are discounted, the opening gets a bonus), the best ones are kept in their original order and trimmed to `max` characters.
 */
export function summarize(body: string, opts: SummaryOptions = {}): string {
  const max = opts.max ?? 280
  const min = opts.min ?? 20
  const want = opts.sentences ?? 2
  const text = plainText(body)
  const list = sentences(text).filter((s) => s.length >= 25 && !/^\W*$/.test(s))
  if (!list.length) return cut(text, max)
  const kw = new Map(keywords(text, 40).map((k) => [k.stem, k.count]))
  const scored = list.map((s, i) => {
    const stems = parse(s).stems.filter((x) => kw.has(x))
    const unique = new Set(stems)
    let score = [...unique].reduce((n, x) => n + Math.log(1 + (kw.get(x) ?? 0)), 0) / Math.sqrt(Math.max(parse(s).content.length, 4))
    if (i === 0) score *= 1.35
    else if (i === 1) score *= 1.1
    if (s.length > 320) score *= 0.7
    if (s.length < 45) score *= 0.8
    if (/[?]$/.test(s)) score *= 0.7
    return { s, i, score }
  })
  const chosen: typeof scored = []
  let size = 0
  for (const c of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (chosen.length >= want) break
    const add = c.s.length + (chosen.length ? 1 : 0)
    if (chosen.length && size + add > max) continue
    chosen.push(c)
    size += add
  }
  const out = chosen.sort((a, b) => a.i - b.i).map((c) => c.s).join(" ")
  const result = cut(out, max)
  return result.length >= min ? result : cut(text, max)
}

// ───────────────────────── titles ─────────────────────────

/** A few title ideas from the text; always editable suggestions, never published by themselves. */
export function titleIdeas(body: string, current = ""): string[] {
  const text = plainText(body)
  const kw = keywords(text, 6).map((k) => titleWord(k, text))
  const ideas: string[] = []
  const heading = /^\s*##\s+(.+)$/m.exec(body)?.[1]?.trim()
  if (heading && heading.length >= 8 && heading.length <= 90) ideas.push(heading)
  const first = sentences(text)[0]
  if (first) {
    const short = first.replace(/[.!?…]+$/, "")
    if (short.length >= 12 && short.length <= 80) ideas.push(cap(short))
  }
  const [a, b, c] = kw
  if (a) ideas.push(`${cap(a)}: yeni başlayanlar için kısa rehber`)
  if (a && b) ideas.push(`${cap(a)} ve ${b} hakkında bilmen gerekenler`)
  if (a && b && c) ideas.push(`${cap(a)}, ${b} ve ${c}: sakin bir giriş`)
  if (a) ideas.push(`${cap(a)} pratiğine nereden başlamalı?`)
  const seen = new Set<string>([current.trim().toLocaleLowerCase("tr-TR")])
  return ideas.filter((t) => t.length >= 4 && t.length <= 200 && !seen.has(t.toLocaleLowerCase("tr-TR")) && !!seen.add(t.toLocaleLowerCase("tr-TR"))).slice(0, 5)
}

// ───────────────────────── checklist ─────────────────────────

export interface ArticleDraftInfo { title: string; excerpt: string; body: string; coverUrl?: string | null }
export interface Check { id: string; label: string; ok: boolean; hint: string }
export interface ArticleReport { words: number; readingMinutes: number; avgSentenceWords: number; headings: number; score: number; checks: Check[] }

/** Whether a draft is ready: lengths that search engines and mail clients show in full, structure and readability. */
export function checkArticle(a: ArticleDraftInfo): ArticleReport {
  const text = plainText(a.body)
  const words = wordCount(text)
  const sents = sentences(text)
  const avg = sents.length ? Math.round((words / sents.length) * 10) / 10 : 0
  const headings = (a.body.match(/^\s*#{2,3}\s+\S/gm) ?? []).length
  const title = a.title.trim()
  const excerpt = a.excerpt.trim()
  const topic = keywords(text, 3).map((k) => k.stem)
  const inTitle = topic.length ? parse(title).stems.some((s) => topic.includes(s)) : true
  const longParas = a.body.split(/\n\s*\n/).filter((p) => wordCount(p) > 140).length
  const checks: Check[] = [
    { id: "title-length", label: "Başlık 20–65 karakter", ok: title.length >= 20 && title.length <= 65, hint: title.length < 20 ? "Başlık biraz kısa; konuyu daha açık söyle." : "Arama sonuçlarında kesilmemesi için 65 karakteri geçme." },
    { id: "excerpt-length", label: "Özet 120–200 karakter", ok: excerpt.length >= 120 && excerpt.length <= 200, hint: excerpt.length < 120 ? "Özeti biraz uzat: yazının ne verdiğini anlat." : "Özet çok uzun; ilk iki cümlede topla." },
    { id: "length", label: "Yazı en az 300 kelime", ok: words >= 300, hint: `Şu an ${words} kelime; derinlik için biraz daha ayrıntı ekle.` },
    { id: "headings", label: "Ara başlıklar var (## Başlık)", ok: headings >= 2 || words < 200, hint: "Uzun yazıyı ## ile ara başlıklara böl; okuması kolaylaşır." },
    { id: "sentences", label: "Cümleler ortalama 25 kelimeyi geçmiyor", ok: avg > 0 && avg <= 25, hint: `Ortalama ${avg} kelime; uzun cümleleri ikiye böl.` },
    { id: "paragraphs", label: "Paragraflar çok uzun değil", ok: longParas === 0, hint: `${longParas} paragraf 140 kelimeden uzun; bölmeyi dene.` },
    { id: "topic", label: "Başlıkta konunun ana kelimesi geçiyor", ok: inTitle, hint: `Yazıda en çok geçen kelime “${keywords(text, 1)[0]?.word ?? ""}”; başlıkta da kullan.` },
    { id: "cover", label: "Kapak görseli seçili", ok: !!a.coverUrl, hint: "Kapak görseli paylaşımlarda ve listede daha çok ilgi çeker." },
  ]
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
  return { words, readingMinutes: Math.max(1, Math.round(words / 200)), avgSentenceWords: avg, headings, score, checks }
}

// ───────────────────────── newsletter draft ─────────────────────────

export interface DraftItems {
  articles?: { title: string; excerpt?: string; url: string }[]
  news?: { title: string; excerpt?: string; url: string }[]
  episodes?: { title: string; guest?: string | null; url: string }[]
  products?: { name: string; price: string; url: string }[]
  workshops?: { title: string; when: string; url: string }[]
}

/** A newsletter text from what is new: a friendly opening, one block per kind of content, a closing. */
export function draftNewsletter(items: DraftItems, opts: { site: string; weekLabel?: string }): { subject: string; body: string; count: number } {
  const blocks: string[] = []
  const add = (title: string, rows: string[]) => { if (rows.length) blocks.push(`${title}\n${rows.join("\n")}`) }
  add("📖 Yeni yazılar", (items.articles ?? []).map((a) => `• ${a.title}${a.excerpt ? ` — ${cut(a.excerpt, 120)}` : ""}\n  ${a.url}`))
  add("📣 Duyurular", (items.news ?? []).map((a) => `• ${a.title}${a.excerpt ? ` — ${cut(a.excerpt, 120)}` : ""}\n  ${a.url}`))
  add("🎧 Podcast", (items.episodes ?? []).map((e) => `• ${e.title}${e.guest ? ` (konuk: ${e.guest})` : ""}\n  ${e.url}`))
  add("🛍 Shop'ta yeni", (items.products ?? []).map((p) => `• ${p.name} — ${p.price}\n  ${p.url}`))
  add("🧘 Yaklaşan canlı atölyeler", (items.workshops ?? []).map((w) => `• ${w.title} — ${w.when}\n  ${w.url}`))
  const count = (items.articles?.length ?? 0) + (items.news?.length ?? 0) + (items.episodes?.length ?? 0) + (items.products?.length ?? 0) + (items.workshops?.length ?? 0)
  const lead = items.articles?.[0]?.title ?? items.news?.[0]?.title ?? items.episodes?.[0]?.title ?? items.products?.[0]?.name ?? items.workshops?.[0]?.title
  const subject = !count ? "AYA'dan haberler" : count === 1 ? `AYA: ${lead}` : `AYA${opts.weekLabel ? ` ${opts.weekLabel}` : ""}: ${cut(lead ?? "yeni içerikler", 60)} ve ${count - 1} yeni içerik`
  const body = [
    "Merhaba,",
    count ? "Sakin bir nefes arasında göz atabileceğin yeni şeyler var:" : "Bu hafta anlatacak yeni bir şey yok; yine de buradayız.",
    ...blocks,
    "Kendine iyi bak,\nAYA ekibi",
  ].join("\n\n")
  return { subject: cut(subject, 190), body, count }
}
