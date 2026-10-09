import { fold, KnowledgeEntry } from "@/lib/ai-knowledge"
import { maskText } from "@/lib/profanity"

const STOP = new Set([
  "nasil", "nedir", "neden", "nerede", "hangi", "kadar", "icin", "gibi", "olarak", "ile", "ve", "ama", "fakat", "veya", "bir", "bu", "su", "mi", "mu", "var", "yok", "ben", "sen", "biz", "siz",
  "cok", "daha", "icinde", "olur", "olur mu", "lutfen", "merhaba", "selam", "bilgi", "almak", "istiyorum", "istiyor", "yapilir", "yapabilirim", "the", "how", "what", "can", "does", "and", "for", "with",
])

/** Key phrases for a taught answer: the question's meaningful words (all of them, then the two longest). */
export function keysFromQuestion(question: string): string[] {
  const words = Array.from(new Set(fold(question).split(" ").filter((w) => w.length >= 4 && !STOP.has(w)))).slice(0, 6)
  if (!words.length) return []
  const out = [words.slice(0, 4).join(" ")]
  const top2 = [...words].sort((a, b) => b.length - a.length).slice(0, 2)
  if (top2.length === 2) out.push(top2.join(" "))
  return Array.from(new Set(out))
}

export function parseKeys(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

/** Admin-supplied keywords: comma/newline separated, folded; every entry becomes one phrase. */
export function keysFromInput(input: unknown): string[] {
  if (typeof input !== "string") return []
  return Array.from(new Set(input.split(/[,\n;]+/).map((k) => fold(k)).filter((k) => k.length >= 3))).slice(0, 12)
}

export interface TaughtRow { id: string; keys: string; answer: string; linkLabel: string | null; linkHref: string | null }

export function taughtToEntries(rows: TaughtRow[]): KnowledgeEntry[] {
  return rows.map((r) => ({
    id: r.id,
    keys: parseKeys(r.keys),
    answer: r.answer,
    links: r.linkHref ? [{ label: r.linkLabel || "Devamı", href: r.linkHref }] : undefined,
  }))
}

/** Only same-site paths or https links are accepted as an answer link. */
export function safeHref(v: unknown): string | null {
  if (typeof v !== "string") return null
  const h = v.trim()
  if (/^\/(?!\/)[A-Za-z0-9\-._~\/?=&%#]*$/.test(h)) return h.slice(0, 200)
  if (/^https:\/\/[A-Za-z0-9.-]+(?:\/[^\s]*)?$/.test(h)) return h.slice(0, 200)
  return null
}

/** What is stored of a visitor's question: personal contact data and profanity are masked. */
export function redactForLog(message: string): string {
  return maskText(message)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-posta]")
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, "[telefon]")
    .replace(/\b(?:TR\d{2}[\d ]{20,})\b/gi, "[iban]")
    .slice(0, 500)
}
