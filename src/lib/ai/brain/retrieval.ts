/**
 * Semantic-ish retrieval without a model: BM25 over the knowledge base and the pose library, where every text is
 * also tagged with the concepts it talks about (sleep, back pain, stress…). A question that shares no word with an
 * answer but shares its concept ("uyuyamıyorum" ↔ "uyku düzeni") still finds it.
 */
import { KNOWLEDGE, KnowledgeEntry } from "@/lib/ai-knowledge"
import { POSES } from "@/lib/yoga-poses"
import { STYLES } from "@/lib/yoga-styles"
import { AREAS, GOALS, CONDITIONS, detect } from "./lexicon"
import { Doc, STOP, parse, stem } from "./nlp"

interface IndexedDoc { kind: "kb" | "pose"; id: string; terms: Map<string, number>; length: number }

const K1 = 1.4
const B = 0.75

interface Index { docs: IndexedDoc[]; df: Map<string, number>; avg: number; vocab: string[] }
let INDEX: Index | null = null

/** Words every pose text contains: they say nothing about which pose is meant. */
const GENERIC = new Set(["poz", "pozu", "pozlar", "pozlari", "pozunu", "pozun", "durus", "durusu", "duruslar", "duruslari", "asana", "pose"])
const meaningfulStems = (d: Doc) => d.content.filter((w) => !GENERIC.has(w)).map(stem)

export function conceptTags(d: Doc): string[] {
  return [...detect(d, AREAS).map((a) => `#a:${a}`), ...detect(d, GOALS).map((g) => `#g:${g}`), ...detect(d, CONDITIONS).map((c) => `#c:${c}`)]
}

function termsOf(text: string, weight = 1): Map<string, number> {
  const d = parse(text)
  const m = new Map<string, number>()
  for (const s of meaningfulStems(d)) m.set(s, (m.get(s) ?? 0) + weight)
  for (const t of conceptTags(d)) m.set(t, (m.get(t) ?? 0) + 2 * weight)
  return m
}
function merge(into: Map<string, number>, from: Map<string, number>) {
  for (const [k, v] of from) into.set(k, (into.get(k) ?? 0) + v)
}

function build(): Index {
  const docs: IndexedDoc[] = []
  for (const e of KNOWLEDGE) {
    if (e.lang === "en" || e.shortOnly) continue
    const t = termsOf(e.keys.join(" "), 3)
    merge(t, termsOf(e.answer, 1))
    docs.push({ kind: "kb", id: e.id, terms: t, length: [...t.values()].reduce((a, b) => a + b, 0) })
  }
  for (const p of POSES) {
    const t = termsOf(`${p.name} ${p.english} ${p.sanskrit}`, 3)
    merge(t, termsOf(`${p.summary} ${p.benefits.join(" ")} ${p.focus.join(" ")} ${p.category}`, 1))
    docs.push({ kind: "pose", id: p.slug, terms: t, length: [...t.values()].reduce((a, b) => a + b, 0) })
  }
  const df = new Map<string, number>()
  for (const d of docs) for (const k of d.terms.keys()) df.set(k, (df.get(k) ?? 0) + 1)
  return { docs, df, avg: docs.reduce((a, d) => a + d.length, 0) / Math.max(docs.length, 1), vocab: [...df.keys()] }
}
const index = () => (INDEX ??= build())

export interface Hit { kind: "kb" | "pose"; id: string; score: number; /** share of the question's terms the answer covers (0–1) */ coverage: number }

/** Best matches for a message. Scores are BM25 sums; ≈6+ is a solid match, below ≈2.5 is noise. */
export function retrieve(d: Doc, limit = 3): Hit[] {
  const idx = index()
  const q = new Map<string, number>()
  for (const s of meaningfulStems(d)) if (!STOP.has(s)) q.set(s, (q.get(s) ?? 0) + 1)
  for (const t of conceptTags(d)) q.set(t, (q.get(t) ?? 0) + 2)
  // typo / inflection tolerance: an unknown long stem borrows the closest known term sharing its first five letters
  for (const [s] of [...q]) {
    if (idx.df.has(s) || s.startsWith("#") || s.length < 6) continue
    const near = idx.vocab.find((v) => !v.startsWith("#") && v.length >= 5 && v.slice(0, 5) === s.slice(0, 5) && Math.abs(v.length - s.length) <= 3)
    if (near) q.set(near, (q.get(near) ?? 0) + 0.7)
  }
  const N = idx.docs.length
  const hits: Hit[] = []
  for (const doc of idx.docs) {
    let score = 0
    let covered = 0
    let total = 0
    for (const [term, qw] of q) {
      total += qw
      const tf = doc.terms.get(term)
      if (!tf) continue
      covered += qw
      const n = idx.df.get(term) ?? 0
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      score += qw * idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * doc.length) / idx.avg)))
    }
    if (score > 0) hits.push({ kind: doc.kind, id: doc.id, score: Math.round(score * 100) / 100, coverage: total ? Math.round((covered / total) * 100) / 100 : 0 })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

const ENTRY_BY_ID = new Map<string, KnowledgeEntry>(KNOWLEDGE.map((e) => [e.id, e]))
export const knowledgeById = (id: string) => ENTRY_BY_ID.get(id)

// ───────── restoring Turkish letters for display ("bel agrisi" → "bel ağrısı") ─────────

let RESTORE: Map<string, string> | null = null
function restoreMap(): Map<string, string> {
  if (RESTORE) return RESTORE
  const counts = new Map<string, Map<string, number>>()
  const feed = (text: string) => {
    for (const w of text.toLocaleLowerCase("tr-TR").split(/[^\p{L}0-9]+/u)) {
      if (w.length < 2) continue
      const f = parse(w).norm
      if (!f || f === w) { if (!f) continue }
      const m = counts.get(f) ?? new Map<string, number>()
      m.set(w, (m.get(w) ?? 0) + 1)
      counts.set(f, m)
    }
  }
  for (const e of KNOWLEDGE) { if (e.lang === "en") continue; feed(e.answer); (e.next ?? []).forEach(feed) }
  for (const p of POSES) feed(`${p.name} ${p.summary} ${p.benefits.join(" ")} ${p.steps.join(" ")}`)
  for (const s of STYLES) feed(`${s.name} ${s.tagline} ${s.intro} ${s.forYou.join(" ")}`)
  RESTORE = new Map()
  for (const [f, m] of counts) RESTORE.set(f, [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] === f ? 1 : -1))[0][0])
  return RESTORE
}

/** Puts Turkish letters back into a folded phrase using the words the site itself uses. */
export function restore(folded: string): string {
  const map = restoreMap()
  return folded.split(" ").map((w) => map.get(w) ?? w).join(" ")
}

export const sentenceCase = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1) : s)

/** A readable question for an entry, e.g. "Bel ağrısı". */
export function entryTitle(e: KnowledgeEntry): string {
  const key = [...e.keys].sort((a, b) => a.length - b.length).find((k) => k.split(" ").length <= 4) ?? e.keys[0]
  return sentenceCase(restore(key))
}

export { stem }
