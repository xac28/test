/**
 * Language layer of AYA's own guide engine: no model, no network. Turkish-aware text folding, a light stemmer,
 * typo tolerance and a parsed `Doc` that the rest of the engine asks questions of.
 */
import { fold } from "@/lib/ai-knowledge"

export { fold }

/** Chat shorthand and common misspellings → the word we know. */
const SLANG: Record<string, string> = {
  slm: "selam", mrb: "merhaba", mrhb: "merhaba", nbr: "naber", nslsn: "nasilsin", nasilsn: "nasilsin", tsk: "tesekkurler", tskler: "tesekkurler", tsk2: "tesekkurler", eyw: "eyvallah",
  napiyon: "napiyorsun", gn: "gunaydin", bnm: "benim", bi: "bir", bisey: "bir sey", birsey: "bir sey", hrn: "hangi", knk: "kanka", yrdm: "yardim", yardm: "yardim",
  ogretmn: "ogretmen", egitmn: "egitmen", hoca: "hoca", yogaa: "yoga", yogayi: "yoga", pls: "lutfen", plz: "lutfen", thx: "thanks", tmm: "tamam", okey: "tamam", ok: "tamam",
  cnm: "canim", sey: "sey", dk: "dakika", dkk: "dakika", dak: "dakika", sa: "saat", usd: "dolar", tl: "lira",
}

/** Words that carry no meaning for matching. */
export const STOP = new Set([
  "ve", "ile", "bir", "bu", "su", "o", "icin", "ama", "fakat", "ya", "mi", "mu", "de", "da", "ki", "ne", "ben", "sen", "biz", "siz", "onlar", "bana", "sana", "bize", "beni", "seni",
  "benim", "senin", "bizim", "var", "yok", "gibi", "kadar", "daha", "cok", "az", "biraz", "en", "olarak", "olan", "icin", "lutfen", "sadece", "hem", "veya", "ise", "mi", "misin", "musun",
  "miyim", "miyiz", "midir", "mudur", "hangi", "nasil", "neden", "niye", "nerede", "nereye", "kim", "kac", "ne", "ara", "tane", "bazi", "her", "tum", "hic", "pek", "cunku", "yani", "sey",
  "bunu", "bunun", "bunlar", "sunu", "onu", "onun", "ona", "bana", "olur", "olsun", "istiyorum", "istiyor", "isterim", "lazim", "gerek", "gerekiyor", "yapabilir", "yapar",
  "the", "a", "an", "is", "are", "to", "of", "and", "in", "for", "i", "you", "my", "me", "can", "do", "how", "what",
])

// suffixes, longest first (applied to folded ASCII words); the stem must keep at least 3 letters
const SUFFIXES = [
  "lerinden", "larindan", "lerimiz", "larimiz", "leriniz", "lariniz", "lerinin", "larinin", "lerine", "larina", "lerini", "larini", "lerde", "larda", "lerden", "lardan",
  "ligini", "liginin", "ligine", "lugunu", "luguna", "ceklerini", "caklarini", "iyorum", "iyoruz", "iyorsun", "iyorsunuz", "iyorlar", "uyorum", "uyoruz", "uyorsun",
  "mayacak", "meyecek", "madim", "medim", "mamak", "memek", "masini", "mesini", "mesine", "masina", "lik", "luk", "lig", "lug", "cilik", "cilig",
  "leri", "lari", "ler", "lar", "iyor", "uyor", "ecek", "acak", "mis", "mus", "diler", "dilar", "ti", "di", "du", "tu", "dim", "dum", "tim", "tum", "dik", "tik",
  "inin", "unun", "nin", "nun", "nan", "nen", "yle", "yla", "den", "dan", "ten", "tan", "ndan", "nden", "inde", "unda", "nda", "nde", "in", "un", "de", "da", "te", "ta",
  "le", "la", "ye", "ya", "yi", "yu", "si", "su", "mak", "mek", "ma", "me", "im", "um", "iz", "uz", "sin", "sun", "siniz", "sunuz", "dir", "dur", "tir", "tur", "ki", "ci", "cu", "li", "lu",
]

/** A deliberately light Turkish stemmer: strips up to two suffix layers, never below 4 letters. Applied to both sides of every comparison. */
export function stem(word: string): string {
  let w = word
  if (w.length <= 3) return w
  for (let pass = 0; pass < 2; pass++) {
    let cut = false
    for (const s of SUFFIXES) {
      if (w.length - s.length >= 4 && w.endsWith(s)) {
        w = w.slice(0, -s.length)
        cut = true
        break
      }
    }
    if (!cut) break
  }
  // vowel harmony leftovers: "yogay" → "yoga", "kitapl" stays
  return w
}

/** Damerau-Levenshtein distance, stopping early once it must exceed `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const al = a.length
  const bl = b.length
  let prev2: number[] = []
  let prev: number[] = Array.from({ length: bl + 1 }, (_, j) => j)
  for (let i = 1; i <= al; i++) {
    const cur: number[] = [i]
    let rowMin = i
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[bl]
}

/** Does the visitor's word mean this known word? Same stem, a long shared prefix, or a typo or two. */
export function wordEq(q: string, k: string): boolean {
  if (q === k) return true
  if (!q || !k) return false
  const sq = stem(q)
  const sk = stem(k)
  if (sq === sk) return true
  if (k.length >= 4 && q.length > k.length && q.startsWith(k)) return true
  if (sk.length >= 4 && sq.startsWith(sk)) return true
  // typos: only for longer words that start alike ("yarin" and "yayin" are two different words, "meditasyn" is a typo)
  const L = Math.min(q.length, k.length)
  if (L >= 6 && q[0] === k[0] && editDistance(q, k, 1) <= 1) return true
  if (L >= 9 && q[0] === k[0] && editDistance(q, k, 2) <= 2) return true
  if (sq.length >= 6 && sk.length >= 6 && sq[0] === sk[0] && editDistance(sq, sk, 1) <= 1) return true
  return false
}

export interface Doc {
  raw: string
  /** folded, single-spaced */
  norm: string
  /** every folded word, slang expanded */
  words: string[]
  /** meaningful words only */
  content: string[]
  /** stems of the content words */
  stems: string[]
  /** a word or phrase of the list occurs (phrase = consecutive words) */
  has(...phrases: string[]): boolean
  /** which of the listed words/phrases occur */
  which(phrases: string[]): string[]
  /** the exact word occurs (no stemming, no typo) */
  exact(...words: string[]): boolean
  /** a regular expression over the folded text */
  rx(re: RegExp): boolean
}

/** Folds, splits and expands a message. */
export function parse(raw: string): Doc {
  const norm0 = fold(raw.replace(/\$/g, " dolar ").replace(/₺/g, " lira "))
  const words = norm0
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => (SLANG[w] ? SLANG[w].split(" ") : [w]))
    .flatMap((w) => (w.includes("-") ? [w.replace(/-/g, ""), ...w.split("-").filter(Boolean)] : [w]))
  const norm = words.join(" ")
  const content = words.filter((w) => !STOP.has(w) && (w.length > 1 || /\d/.test(w)))
  const stems = content.map(stem)
  const padded = ` ${norm} `
  const matchPhrase = (p: string) => {
    const pw = fold(p).split(" ").filter(Boolean)
    if (!pw.length) return false
    if (pw.length === 1) return words.some((w) => wordEq(w, pw[0]))
    // phrases: exact substring first (cheap), then word by word in order with typo tolerance
    if (padded.includes(` ${pw.join(" ")} `) || padded.includes(` ${pw.join(" ")}`)) return true
    for (let i = 0; i + pw.length <= words.length; i++) if (pw.every((k, j) => wordEq(words[i + j], k))) return true
    return false
  }
  return {
    raw,
    norm,
    words,
    content,
    stems,
    has: (...phrases) => phrases.some(matchPhrase),
    which: (phrases) => phrases.filter(matchPhrase),
    exact: (...ws) => ws.some((w) => words.includes(w)),
    rx: (re) => re.test(norm),
  }
}

/** Small deterministic hash: the same message always gets the same wording, different messages vary. */
export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const pick = <T,>(seed: number, options: readonly T[]): T => options[seed % options.length]
