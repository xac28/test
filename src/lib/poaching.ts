/**
 * "Taking students off the platform": social media accounts, messengers, phone numbers, links, payment outside AYA
 * and "come to my own course" phrases. Pure and unit-tested; the enforcement ladder lives in policy.ts.
 *
 * Teachers get the full set (their texts are the ones that reach students); everybody else only the contact kinds.
 */
import { findContact, fold, tokenize } from "@/lib/profanity"

export type PoachKind = "SOCIAL" | "MESSENGER" | "PHONE" | "EMAIL" | "LINK" | "IBAN" | "OFFPLATFORM"

export const POACH_LABEL_TR: Record<PoachKind, string> = {
  SOCIAL: "sosyal medya hesabı",
  MESSENGER: "mesajlaşma uygulaması / iletişim",
  PHONE: "telefon numarası",
  EMAIL: "e-posta adresi",
  LINK: "harici bağlantı",
  IBAN: "IBAN / ödeme bilgisi",
  OFFPLATFORM: "platform dışına yönlendirme",
}

/** Prefix roots (ASCII-folded, repeated letters collapsed by tokenize's caller). */
const SOCIAL_PREFIX = ["instagram", "insta", "tiktok", "snapchat", "telegram", "facebook", "twitter", "linkedin", "youtube", "pinterest", "threads", "clubhouse"]
const SOCIAL_EXACT = ["fb", "ig"]
const MESSENGER_PREFIX = ["whatsapp", "whatsap", "watsap", "watsapp", "whatsup", "wapp", "discord", "skype", "viber", "signal"]
const MESSENGER_EXACT = ["wp", "dm", "dmden", "dmye", "whats", "zoom"]

const collapse = (s: string) => s.replace(/(.)\1+/g, "$1")

/** Phrases (matched on the folded text) that point people away from the platform. */
const PHRASES: { re: RegExp; label: string }[] = [
  { re: /\b(?:benimle|bizimle) (?:iletisime|irtibata|temasa) ge[cç]/, label: "benimle iletişime geç" },
  { re: /\b(?:bana|bizim) (?:ulas|ulasin|ulasabilirsin|yazin|yazabilirsin|mesaj atin|mesaj at)\b/, label: "bana ulaş/yaz" },
  { re: /\bozel(?:den)? ?(?:mesaj|yaz|ulas|konus|iletisim)/, label: "özelden yaz" },
  { re: /\b(?:kendi|ozel) (?:kurs|kurslar|studyo|stud|atolye|egitim program|grup ders|sinif)\w*/, label: "kendi kursum/stüdyom" },
  { re: /\b(?:kursum|kursuma|kursumda|kurslarim|studyom|studyoma|studyomda)\b/, label: "kursum/stüdyom" },
  { re: /\bplatform (?:disi|disinda|haric|disina)|\baya (?:disi|disinda|haric)\b|\bdisarida (?:ders|bulus|gorus|odeme)/, label: "platform dışında" },
  { re: /\b(?:komisyon|komisyonsuz|komisyon vermeden|araci olmadan|aracisiz|aracisi olmadan)\b/, label: "komisyonsuz" },
  { re: /\b(?:havale|eft|papara|ininal|banka hesab\w*|hesap numara\w*|param\w* gonder|bitcoin|usdt|kripto)\b/, label: "platform dışı ödeme" },
  { re: /\bdaha (?:ucuza|ucuz|uygun fiyata|uygun) (?:ders|veririm|verebilirim|yaparim|gelirim)/, label: "daha ucuza ders" },
  { re: /\b(?:contact|message|text|call|reach) me\b|\bdm me\b|\bmy (?:own )?(?:course|studio|academy|school|instagram|insta|whatsapp|telegram)\b|\boutside (?:of )?(?:the )?(?:platform|aya)\b|\boff[- ]platform\b/, label: "contact me / outside platform" },
]

export interface PoachResult {
  clean: boolean
  kinds: PoachKind[]
  /** what matched (for the admin log), e.g. ["instagram", "@ayse.yoga"] */
  matches: string[]
}

/** `teacher: true` also looks for "my own course" style phrases and platform names. */
export function scanPoaching(text: string, opts: { teacher?: boolean } = {}): PoachResult {
  const kinds = new Set<PoachKind>()
  const matches: string[] = []
  if (!text || !text.trim()) return { clean: true, kinds: [], matches }

  const add = (k: PoachKind, m: string) => { kinds.add(k); if (matches.length < 8 && !matches.includes(m)) matches.push(m) }

  // contact data in the usual shapes (e-mail, phone, IBAN, links, "wa: …")
  const c = findContact(text)
  if (c) add(c === "HANDLE" ? "MESSENGER" : (c as PoachKind), c.toLowerCase())

  // @handles and "ig: name" / "insta - name"
  const f = fold(text).replace(/ı/g, "i")
  const handle = /(?:^|[\s(])@([a-z0-9._]{3,30})\b/.exec(text.toLowerCase().normalize("NFKC"))
  if (handle) add("SOCIAL", `@${handle[1]}`)
  if (/\b(?:ig|insta|instagram|tiktok|tt|snap|fb|twitter|telegram|tg)\s*[:=\-–—]\s*[a-z0-9._]{3,}/.test(f)) add("SOCIAL", "kullanıcı adı")

  // platform / messenger names, also when spaced or leetspoken ("w h a t s a p p", "1nstagram")
  for (const { token } of tokenize(text)) {
    const t = collapse(token)
    const social = SOCIAL_PREFIX.find((r) => t.startsWith(collapse(r))) ?? SOCIAL_EXACT.find((r) => t === r)
    // two-letter abbreviations ("ig", "fb") are only meaningful in a teacher's text
    if (social && (social.length > 2 || opts.teacher)) add("SOCIAL", social)
    const msg = MESSENGER_PREFIX.find((r) => t.startsWith(collapse(r))) ?? MESSENGER_EXACT.find((r) => t === r)
    if (msg) add("MESSENGER", msg)
  }
  if (opts.teacher) for (const p of PHRASES) if (p.re.test(f)) add("OFFPLATFORM", p.label)

  return { clean: kinds.size === 0, kinds: Array.from(kinds), matches }
}

export const poachKindsLabel = (kinds: PoachKind[]) => kinds.map((k) => POACH_LABEL_TR[k]).join(", ")
