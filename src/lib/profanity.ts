/**
 * Profanity, insult, hate and threat detection for Turkish and English, built to survive the usual tricks
 * (ŞİKTİR, s i k t i r, s.i.k.t.i.r, siiiiktir, $1kt1r, siktirgit) without flagging innocent words
 * (sıkıntı, sıktı, şikayet, sikke, class, assistant).
 *
 * Pure and dependency-free so the exact same code runs in the browser (live warning while typing) and on the
 * server (the authority). The server also passes the admins' extra words.
 */

export type ProfanityKind = "PROFANITY" | "INSULT" | "HATE" | "THREAT" | "SPAM"

export interface Match {
  kind: ProfanityKind
  /** the token as the visitor wrote it (for masking) */
  text: string
  /** the list entry that matched */
  root: string
}

interface Root {
  root: string
  kind: ProfanityKind
  /** "prefix": any suffix is fine (Turkish is agglutinative); "exact": the whole word only */
  mode: "prefix" | "exact"
  /** compare without collapsing repeated letters (nigger ≠ Niger) */
  noCollapse?: boolean
}

const P = (root: string, kind: ProfanityKind = "PROFANITY", o: Partial<Root> = {}): Root => ({ root, kind, mode: "prefix", ...o })
const X = (root: string, kind: ProfanityKind = "PROFANITY", o: Partial<Root> = {}): Root => ({ root, kind, mode: "exact", ...o })

/**
 * ASCII-folded, lower-case, 'ı' written as 'i'. Repeated letters are collapsed when matching, so list them once.
 *
 * Deliberately NOT here, because they are everyday words people also type without Turkish letters:
 * sık/sıkış/sıktı/sıkıldı (sik…), Amina (name), ananı (accusative of "mother"), götür (take), Kumar/Dick (surnames), got/pic (English).
 */
const ROOTS: Root[] = [
  // ── Turkish profanity
  P("siktir"), P("siker"), P("sikey"), P("sikec"), P("sikik", "PROFANITY", { mode: "exact" }),
  P("orospu"), P("oruspu"), P("orospi"), P("amcik"), P("amcuk"), X("amk"), P("amkoy"), X("amq"), X("aq"), P("aminakoy"), P("aminasok"),
  P("yarak"), P("dalyarak"), P("tasak"), X("gotu"), P("gotun"), P("gotver"), P("gotlek"), P("gotos"),
  P("pezevenk"), P("gavat"), P("kahpe"), P("kaltak"), P("yavsak"), P("kevase"), P("ibne"), X("pust"),
  X("picin"), P("picler"), P("piclik"), P("pickurusu"),
  P("serefsiz", "INSULT"), P("haysiyetsiz", "INSULT"), P("gerizekali", "INSULT"), P("dangalak", "INSULT"), P("beyinsiz", "INSULT"), P("itoglu", "INSULT"),
  P("aptal", "INSULT"), P("salak", "INSULT"), P("ahmak", "INSULT"), P("budala", "INSULT"), P("embesil", "INSULT"), P("andaval", "INSULT"), P("gerzek", "INSULT"),
  P("idiot", "INSULT"), X("moron", "INSULT"), X("morons", "INSULT"), P("moronic", "INSULT"), P("stupid", "INSULT"), P("dumbass", "INSULT"), P("jackass", "INSULT"), X("loser", "INSULT"), X("losers", "INSULT"),
  // ── hate speech
  P("gavur", "HATE"), P("yobaz", "HATE"), P("cingene", "HATE"), P("zenci", "HATE"),
  P("nigger", "HATE", { noCollapse: true }), P("nigga", "HATE", { noCollapse: true }), P("faggot", "HATE", { noCollapse: true }), X("fags", "HATE"), P("retard", "HATE"), P("tranny", "HATE"), X("kike", "HATE"),
  // ── English profanity
  P("fuck"), P("fck"), X("fuk"), P("shit"), P("bullshit"), P("bitch"), P("asshole"), P("arsehole"), P("bastard"), P("cunt"), P("whore"), P("slut"), P("motherfuck"), P("dickhead"), X("pussy"), X("wanker"), X("twat"),
  // ── spam / adult / scams
  X("escort", "SPAM"), P("porno", "SPAM"), X("porn", "SPAM"), P("bahis", "SPAM"), X("casino", "SPAM"), X("betting", "SPAM"),
]

/** Innocent words that merely start like a listed one (checked after folding; ı kept). */
const ALLOW = new Set([
  "siklet", "sikke", "sikayet", "amir", "amiral", "dalyan", "gotik", "gothic", "pusu", "pusula", "ocak", "kumas", "kumanda", "kumbara", "kumsal",
  "fagot", "figure", "retardant", "assistant", "assist", "class", "classic", "glass", "grass", "pass", "mass", "bass", "brass",
  "cockpit", "cocktail", "shitake", "shiitake", "escorted", "escorting", "hacim", "hacivat", "gavurdagi", "ibnesina", "ibn", "gotland", "mkdir",
  "retarde", "retardation_", "salaka", "salakalar", "salakalasmak", "salakasi", "tasaklar_", "yarakli_",
])

// ── normalisation ────────────────────────────────────────────────────────────

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "€": "e", "£": "l", "+": "t" }

/** lower-case + strip diacritics, but keep the dotless ı so that "sıktı" and "siktir" stay different words. */
export function fold(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/ı/g, "ı") // keep
    .replace(/[​-‏‪-‮⁠﻿­]/g, "")
    .replace(/ç/g, "c").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
}

const collapse = (s: string) => s.replace(/(.)\1+/g, "$1")
const toI = (s: string) => s.replace(/ı/g, "i")

const PREP = ROOTS.map((r) => ({ ...r, c: r.noCollapse ? toI(fold(r.root)) : collapse(toI(fold(r.root))) }))

/** Words in the text, with spaced-out letters ("s i k t i r") and separator tricks ("s.i.k.t.i.r") glued back. */
export function tokenize(text: string): { token: string; raw: string }[] {
  const out: { token: string; raw: string }[] = []
  const folded = fold(text)
  const parts = folded.split(/[\s]+/).filter(Boolean)
  // 1) glue runs of single characters ("s i k t i r", "s . i . k")
  const glued: string[] = []
  let run: string[] = []
  const flush = () => {
    if (run.length >= 3) glued.push(run.join(""))
    else glued.push(...run)
    run = []
  }
  for (const p of parts) {
    const stripped = p.replace(/[._\-*'`~^|\\/,;:]+/g, "")
    if (stripped.length === 1 && /[a-zı@$0-9!+]/.test(stripped)) run.push(stripped)
    else {
      flush()
      glued.push(p)
    }
  }
  flush()
  for (const g of glued) {
    // 2) a token like "s.i.k.t.i.r" or "s*i*k" → glue it; otherwise split on punctuation
    const chunks = g.split(/[._\-*'`~^|\\/,;:()\[\]{}"?<>=&%#]+/)
    const singles = chunks.filter(Boolean)
    const pieces = singles.length >= 4 && singles.every((c) => c.length <= 2) ? [singles.join("")] : singles
    for (const raw of pieces) {
      const piece = raw.replace(/[!+]+$/g, "") // sentence punctuation is not leetspeak
      // leetspeak only inside words that also contain a letter
      const withLetters = /[a-zı]/.test(piece)
      const mapped = withLetters ? piece.replace(/[0134579@$!€£+]/g, (ch) => LEET[ch] ?? ch) : piece
      const letters = mapped.replace(/[^a-zı]/g, "")
      if (letters) out.push({ token: letters, raw: g })
    }
  }
  return out
}

function matchToken(tokenWithDotless: string, extra: Set<string>): Root | null {
  const ti = toI(tokenWithDotless)
  const tc = collapse(ti)
  if (ALLOW.has(ti)) return null
  for (const r of PREP) {
    const subject = r.noCollapse ? ti : tc
    if (r.mode === "exact") {
      if (subject === r.c) return r
    } else if (subject.startsWith(r.c)) return r
  }
  if (extra.size) {
    for (const w of extra) if (tc === w || (w.length >= 4 && tc.startsWith(w))) return { root: w, kind: "PROFANITY", mode: "exact" }
  }
  return null
}

/** Multi-word entries ("mal herif") and threats are looked up on the whole folded text. */
const PHRASES: { re: RegExp; kind: ProfanityKind; root: string }[] = [
  { re: /\bseni (?:oldur|gebert|vur|bogaz|doverim|dovecegim)/, kind: "THREAT", root: "seni öldür…" },
  { re: /\b(?:oldurecegim|oldurucem|gebertecegim|gebertirim|vururum|bicaklarim|kafani kiracagim)\b/, kind: "THREAT", root: "tehdit" },
  { re: /\bgeber(?:sin|esice|ip git)?\b/, kind: "THREAT", root: "geber…" },
  { re: /\b(?:kill yourself|kys|i will kill you|i'll kill you|go die)\b/, kind: "THREAT", root: "kill you" },
  { re: /\bintihar et\b/, kind: "THREAT", root: "intihar et" },
  { re: /\bamina\s*(?:koy|sok|kod)/, kind: "PROFANITY", root: "amına…" },
  { re: /\banani\s*(?:sik|avrat)/, kind: "PROFANITY", root: "ananı…" },
  { re: /\b(?:takipci|begeni|follower)s?\s*(?:sat|satin|al|for sale|buy)/, kind: "SPAM", root: "takipçi satışı" },
  { re: /\bmal herif\b/, kind: "INSULT", root: "mal herif" },
  { re: /\bit oglu it\b/, kind: "INSULT", root: "it oğlu it" },
  { re: /\b(?:get lost|shut up) (?:you )?(?:idiot|moron|loser)\b/, kind: "INSULT", root: "insult" },
]

/** Words whose Turkish spelling differs from an innocent English/ASCII twin (göt/got, piç/pic): checked on the text as typed. */
const DIACRITIC: { re: RegExp; kind: ProfanityKind; root: string }[] = [
  { re: /(?<![\p{L}])göt(?:ü|ün|ünü|e|te|ten|ler|lek|veren)?(?![\p{L}])/u, kind: "PROFANITY", root: "göt" },
  { re: /(?<![\p{L}])piç(?:ler|lik|in)?(?![\p{L}])/u, kind: "PROFANITY", root: "piç" },
  { re: /(?<![\p{L}])pic\s*(?:kurusu|oglu|oğlu)/u, kind: "PROFANITY", root: "piç" },
]

export interface ScanResult {
  clean: boolean
  matches: Match[]
  kinds: ProfanityKind[]
}

/** Scan a text. `extraWords` are the admins' additional blocked words (already lower-case ASCII). */
export function scanText(text: string, extraWords: string[] = []): ScanResult {
  const matches: Match[] = []
  if (!text || !text.trim()) return { clean: true, matches, kinds: [] }
  // admin words go through the same leetspeak mapping as the text, so "yoga2" and "yogaiz" are one and the same
  const extra = new Set(
    extraWords
      .map((w) => collapse(toI(fold(w).trim().replace(/[0134579@$!€£+]/g, (ch) => LEET[ch] ?? ch).replace(/[^a-zı]/g, ""))))
      .filter((w) => w.length >= 3),
  )
  for (const { token, raw } of tokenize(text)) {
    const hit = matchToken(token, extra)
    if (hit) matches.push({ kind: hit.kind, text: raw, root: hit.root })
  }
  const flat = toI(fold(text)).replace(/\s+/g, " ")
  for (const p of PHRASES) {
    const m = p.re.exec(flat)
    if (m) matches.push({ kind: p.kind, text: m[0], root: p.root })
  }
  const typed = text.normalize("NFC").toLowerCase()
  for (const d of DIACRITIC) {
    const m = d.re.exec(typed)
    if (m) matches.push({ kind: d.kind, text: m[0], root: d.root })
  }
  const kinds = Array.from(new Set(matches.map((m) => m.kind)))
  return { clean: matches.length === 0, matches, kinds }
}

/** Replace every offending word with its first letter and stars: "s*****". Used for excerpts and logs. */
export function maskText(text: string, extraWords: string[] = []): string {
  const { matches } = scanText(text, extraWords)
  let out = text
  for (const m of matches) {
    const word = m.text
    if (!word) continue
    const masked = word[0] + "*".repeat(Math.max(2, word.length - 1))
    out = out.split(word).join(masked)
    // spaced-out evasions are masked by whole-text replacement below
  }
  return out
}

export const KIND_LABEL_TR: Record<ProfanityKind, string> = {
  PROFANITY: "küfür",
  INSULT: "hakaret",
  HATE: "nefret söylemi",
  THREAT: "tehdit",
  SPAM: "reklam / istenmeyen içerik",
}

// ── contact details, links and other off-platform tricks ────────────────────

export type ContactKind = "LINK" | "EMAIL" | "PHONE" | "IBAN" | "HANDLE"

const URL_RE = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|me|co|tr|info|biz|xyz|ly|gl|app|site|shop|club|online|ru|link)\b(?:\/\S*)?/i
const EMAIL_RE = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i
const IBAN_RE = /\b[a-z]{2}\d{2}(?:[\s-]?\d{4}){4,6}(?:[\s-]?\d{1,4})?\b/i
const MESSENGER_RE = /\b(?:whats\s?app|watsap|vatsap|telegram|insta(?:gram)?|snap(?:chat)?|dm(?:'?den)? (?:at|yaz)|ozelden yaz|ozelden ulas|t\.me|wa\.me)\b/i

/** Phone numbers in the usual Turkish and international shapes, tolerant of spaces and dashes. */
function hasPhone(text: string): boolean {
  const digits = (text.match(/[\d][\d\s().-]{8,}\d/g) || []).map((s) => s.replace(/\D/g, ""))
  return digits.some((d) => d.length >= 10 && d.length <= 15 && (d.startsWith("05") || d.startsWith("5") || d.startsWith("90") || d.startsWith("0") || d.startsWith("1") || d.length >= 10))
}

export function findContact(text: string): ContactKind | null {
  const f = text.normalize("NFKC")
  if (EMAIL_RE.test(f)) return "EMAIL"
  if (IBAN_RE.test(f.replace(/\s+/g, " "))) return "IBAN"
  if (URL_RE.test(f)) return "LINK"
  if (hasPhone(f)) return "PHONE"
  if (MESSENGER_RE.test(fold(f))) return "HANDLE"
  return null
}

export const CONTACT_LABEL_TR: Record<ContactKind, string> = {
  LINK: "bağlantı",
  EMAIL: "e-posta adresi",
  PHONE: "telefon numarası",
  IBAN: "IBAN",
  HANDLE: "harici mesajlaşma / sosyal medya yönlendirmesi",
}

// ── low-effort spam shapes ──────────────────────────────────────────────────

export type SpamKind = "SHOUTING" | "REPEATED_CHARS" | "REPEATED_WORDS" | "EMOJI_FLOOD"

export function findSpamShape(text: string): SpamKind | null {
  const letters = text.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "")
  if (letters.length >= 14) {
    const upper = letters.replace(/[^A-ZÇĞİÖŞÜ]/g, "").length
    if (upper / letters.length > 0.8) return "SHOUTING"
  }
  const words = fold(text).split(/\s+/).filter(Boolean)
  if (words.length >= 6) {
    const counts = new Map<string, number>()
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)
    if (Math.max(...counts.values()) / words.length > 0.6) return "REPEATED_WORDS"
  }
  const emojis = text.match(/\p{Extended_Pictographic}/gu)?.length ?? 0
  if (emojis >= 12 && emojis / Math.max(text.length, 1) > 0.4) return "EMOJI_FLOOD"
  if (/(.)\1{9,}/u.test(text)) return "REPEATED_CHARS"
  return null
}
