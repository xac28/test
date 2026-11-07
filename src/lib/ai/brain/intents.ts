/**
 * Intent scoring: every rule adds evidence for an intent; the intent with the most evidence wins and the margin to the
 * runner-up becomes the confidence. Rules look at the parsed message and at the slots it fills, so
 * "bel ağrım için ne yapmalıyım" (an area + advice wording) is understood without a single keyword list for it.
 */
import { Doc } from "./nlp"
import { Slots } from "./slots"

export type BrainIntent =
  | "greeting" | "thanks" | "bye" | "support" | "crisis"
  | "teachers" | "workshops" | "live" | "articles" | "news" | "podcast" | "pose" | "products" | "order" | "schedule"
  | "pricing" | "booking" | "become_teacher" | "recordings" | "payouts" | "report" | "account" | "terms"
  | "plan" | "recommend" | "compare" | "knowledge" | "unknown"

/** Intents that fetch live data (and therefore win over a canned answer when the evidence is strong). */
export const DATA_INTENTS: BrainIntent[] = ["teachers", "workshops", "live", "articles", "news", "podcast", "pose", "products", "order", "schedule", "plan", "recommend"]

/** On equal evidence the earlier one wins (the more specific). */
const PRIORITY: BrainIntent[] = [
  "order", "become_teacher", "schedule", "payouts", "recordings", "report", "compare", "plan", "pose", "podcast", "news", "articles", "products", "workshops", "live",
  "booking", "teachers", "pricing", "account", "terms", "recommend", "greeting", "thanks", "bye", "knowledge", "unknown",
]

export interface Classification {
  scores: Partial<Record<BrainIntent, number>>
  top: BrainIntent
  topScore: number
  second?: BrainIntent
  /** 0–1: how clearly the top intent beats the rest */
  confidence: number
}

const ADVICE = ["oner", "onerir", "onerisi", "tavsiye", "ne yapmaliyim", "ne yapayim", "ne yapmali", "ne yapabilirim", "iyi gelir", "iyi gelen", "faydali", "hangi yoga", "hangi stil", "hangi pratik", "yardimci olur", "rahatlatir", "gecer mi", "azaltir", "cozum", "ne onerirsin", "icin ne", "icin hangi", "icin yoga", "icin bir sey", "icin uygun", "uygun mu", "bana gore", "bana uygun", "ne dersin"]
const MAKE = ["yap", "hazirla", "olustur", "ver", "yaz", "planla", "dizayn", "ciz", "cikar", "oner"]

const has = (d: Doc, ...p: string[]) => d.has(...p)

export function classify(d: Doc, s: Slots, raw: string): Classification {
  const sc: Partial<Record<BrainIntent, number>> = {}
  const add = (i: BrainIntent, w: number) => { sc[i] = (sc[i] ?? 0) + w }
  const short = d.words.length <= 4

  // ── people, events, content
  if (has(d, "egitmen", "hoca", "ogretmen", "teacher", "instructor", "egitmenler", "ogretmenler", "birebir", "ozel ders", "kisisel ders", "yoga ogretmeni", "hocam")) add("teachers", 5)
  if (has(d, "kim ogretiyor", "kimden ders", "kimle ders", "en iyi hoca", "en iyi egitmen")) add("teachers", 3)
  if (has(d, "atolye", "workshop", "etkinlik", "seminer", "grup dersi", "kurs", "course", "egitim programi", "atolyeler")) add("workshops", 5)
  if (has(d, "canli yayin", "yayinda", "live", "stream", "yayin") && !has(d, "kaydi", "kayit", "indir")) add("live", 5)
  if (has(d, "canli") && !has(d, "destek", "ders", "atolye", "yetkili", "kayit", "indir")) add("live", 2.5)
  if (has(d, "su an", "simdi", "right now", "yayinda mi") && has(d, "yayin", "canli", "ders", "live")) add("live", 2)
  if (has(d, "yazi", "makale", "icerik", "blog", "okumak", "okuyayim", "okunacak", "article", "yazilar", "makaleler", "icerikler") || d.exact("oku")) add("articles", 5)
  if (has(d, "duyuru", "haber", "haberler", "neler yeni", "yeni ne var", "kampanya", "announcement", "news", "duyurular")) add("news", 5)
  if (has(d, "podcast", "konusmalar", "sesli", "dinlemek", "dinleyeyim", "bolum", "bolumler", "konuk")) add("podcast", 5)
  if (has(d, "urun", "magaza", "shop", "satin al", "satin almak", "yoga mati", "mat onerisi", "yastik", "aromaterapi", "bolster", "blok", "sepet", "alisveris", "hediye")) add("products", 5)
  if (s.productCategory) add("products", 3)
  if (has(d, "siparis", "kargo", "takip no", "takip numarasi", "order") || d.rx(/\b(siparisim|siparislerim|paketim|kargom)\b/)) add("order", 4)
  if (s.orderCode) add("order", 8)
  if (has(d, "siparis ver", "siparis vermek", "siparis olustur")) { add("products", 3); sc.order = (sc.order ?? 0) - 3 }
  if (d.words.some((w) => /^(takvim|derslerim|rezervasyonlarim|programim|randevum|atolyelerim)/.test(w)) || d.rx(/\b(dersim var|ne zaman dersim|yaklasan dersim|yaklasan derslerim|siradaki dersim|bugun dersim|yarin dersim|bu hafta dersim|kayitli oldugum|katildigim atolye|benim derslerim)\b/) || has(d, "my schedule")) add("schedule", 7)
  if (d.rx(/\bders (var mi|ne zaman|olur mu)\b/) || has(d, "ders var mi", "ders programi", "ders saatleri")) { add("workshops", 4); add("live", 2) }

  // ── how the platform works
  if (has(d, "fiyat", "fiyatlar", "paket", "paketler", "abonelik", "premium", "kac para", "kac tl", "kac dolar", "price", "pricing", "subscription", "plan fiyat") || d.words.some((w) => /^ucret(ler|i|in|ini|e|ler[ie])?$/.test(w)) || (d.has("ne kadar") && !has(d, "sure", "dakika", "nefes", "kal", "tutmali", "yapmali", "beklemeli"))) add("pricing", 4)
  if (has(d, "rezervasyon", "randevu", "ders al", "ders alma", "ders almak", "ders ayir", "ders ayirt", "deneme dersi", "deneme ders", "nasil ders", "book", "booking", "trial")) add("booking", 5)
  if (has(d, "egitmen ol", "ogretmen ol", "hoca ol", "ders vermek", "egitmen basvuru", "teacher application", "become a teacher", "teach on", "i want to teach", "ders verebilir miyim", "platformda ders ver")) add("become_teacher", 8)
  if (has(d, "ders kaydi", "ders kayd", "kaydi indir", "kayit indir", "dersi indir", "tekrar izle", "kaydi izle", "recording", "dersin kaydi", "30 gun") || (d.exact("indir", "indirmek", "indirebilir") && has(d, "ders", "kayit"))) add("recordings", 6)
  if (has(d, "odeme talep", "odeme talebi", "hakedis", "kazanc", "kazancim", "para cek", "para cekmek", "payout", "withdraw", "earnings", "iban")) add("payouts", 6)
  if (has(d, "sikayet", "sikayetci", "taciz", "dolandir", "dolandirici", "report", "abuse", "harass", "guvenlik sorun", "rahatsiz edi", "uygunsuz", "kufur", "hakaret", "yayini bildir") || d.exact("bildir", "bildirmek", "bildirmek istiyorum", "ihbar")) add("report", 6)
  if (has(d, "uye ol", "uyelik", "kayit ol", "hesap ac", "hesap olustur", "giris yap", "giris", "sifre", "login", "sign up", "register", "e posta dogrula", "eposta dogrula", "cikis yap", "parola")) add("account", 5)
  if (has(d, "sozlesme", "kosullar", "gizlilik", "kvkk", "terms", "privacy", "kullanim kosul", "cerez", "kisisel veri")) add("terms", 5)

  // ── what the person needs
  if (s.poseSlug) add("pose", 6)
  if (has(d, "poz", "pozu", "pozlar", "pozlari", "asana", "durusu", "duruslar", "duruslari", "pose", "pozisyon")) add("pose", 3)
  if (s.poseFacet && s.poseSlug) add("pose", 3)
  if (has(d, "program", "rutin", "seri", "haftalik", "gunluk pratik", "pratik plani", "ders plani", "akis hazirla", "sabah rutini", "aksam rutini", "yoga plani", "antrenman", "calisma plani", "sekans", "sequence", "routine")) add("plan", 4)
  if (s.duration && (has(d, "rutin", "program", "pratik", "yoga", "akis", "seri") || ADVICE.some((a) => d.has(a)))) add("plan", 3)
  if (d.words.some((w) => MAKE.some((m) => w.startsWith(m) && w.length <= m.length + 4)) && has(d, "program", "rutin", "plan", "pratik", "seri")) add("plan", 3)
  if (has(d, "hafta icin", "haftalik program", "haftalik plan", "bir haftalik", "7 gun", "30 gun yoga", "gunluk plan")) add("plan", 3)

  const needs = s.areas.length * 3 + s.goals.length * 2.5 + s.conditions.length * 2
  const advice = ADVICE.some((a) => d.has(a)) || has(d, "icin", "yuzunden", "nedeniyle", "var", "cekiyorum", "yasiyorum", "sorunu", "sorun", "problem", "gecmiyor", "hissediyorum", "oluyor", "olmuyor", "yoruyor", "ağrıyor", "agriyor")
  if (needs > 0) {
    add("recommend", needs + (advice ? 2 : 0))
    if (has(d, "yoga", "pratik", "egzersiz", "hareket", "esneme", "nefes", "meditasyon", "pose", "poz", "duruş")) add("recommend", 1.5)
  }
  if (s.styles.length && !sc.teachers && !sc.workshops && !sc.live) add("recommend", 3)
  if (s.level && (has(d, "yoga", "ders", "baslamak", "baslayayim", "nereden", "nasil") || ADVICE.some((a) => d.has(a)))) add("recommend", 3)
  if (s.styles.length >= 2 && d.rx(/\bmi\b.*\bmi\b|\bmu\b.*\bmu\b/)) add("compare", 7)
  if (s.styles.length >= 2 && (has(d, "mi yoksa", "yoksa", "farki", "fark", "arasindaki", "arasinda", "hangisi", "karsilastir", "vs", "versus", "ya da", "veya", "mi mi") || has(d, "ile") && has(d, "fark"))) add("compare", 8)
  if (has(d, "hangisi daha", "hangisi benim icin", "farki ne", "farki nedir", "aradaki fark", "karsilastir") && s.styles.length >= 1) add("compare", 4)

  // ── small talk with an intent of its own
  if (/^(merhaba|merhabalar|selam|selamlar|hey|hi|hello|gunaydin|iyi gunler|iyi aksamlar|naber|slm|mrb|sa|selamun aleykum|hayirli sabahlar)\b/.test(d.norm) && d.words.length <= 4) add("greeting", 6)
  if (d.rx(/\b(tesekkur|tesekkurler|tesekkur ederim|sag ol|sagol|eyvallah|thanks|thank you|saol|mersi|super|harika|mukemmel)\b/) && d.words.length <= 6) add("thanks", 6)
  if (d.rx(/\b(gorusuruz|hoscakal|hosca kal|bay bay|bye|goodbye|iyi geceler|kendine iyi bak|cikiyorum|ben cikiyorum)\b/) && d.words.length <= 6) add("bye", 6)

  // an explicit style + "ders/eğitmen" wording is about teachers even if the style word also looks like a goal
  if (s.styles.length && (sc.teachers ?? 0) > 0) add("teachers", 2)
  // a question about the thing itself ("hatha nedir") is knowledge, not a search
  if (has(d, "nedir", "ne demek", "nasil bir sey", "anlat", "hakkinda bilgi", "ne anlama", "tanimi", "what is", "kimdir") && !s.poseSlug) add("knowledge", 4)
  if (short && !Object.keys(sc).length) add("knowledge", 0.5)
  void raw

  // "bul / öner / var mı" on top of a subject that fetches data: the person wants a search
  if (has(d, "bul", "bulmak", "bulabilir", "ara", "ariyorum", "arayin", "oner", "onerir", "var mi", "goster", "listele", "istiyorum")) {
    for (const k of ["teachers", "workshops", "live", "articles", "podcast", "products", "news"] as BrainIntent[]) if ((sc[k] ?? 0) >= 4) add(k, 2)
  }
  if (sc.teachers && (s.styles.length || s.price || s.level || s.areas.length)) add("teachers", 2)
  // "hangi yoga bana uygun": no subject yet, the question is the choice itself
  if (has(d, "hangi yoga", "hangi stil", "hangi tur", "yoga secmek", "bana uygun yoga", "ne tur yoga", "hangi yogayi", "hangi yoga stili") && !sc.teachers) add("recommend", 5)

  const ranked = (Object.entries(sc) as [BrainIntent, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || PRIORITY.indexOf(a[0]) - PRIORITY.indexOf(b[0]))
  if (!ranked.length) return { scores: sc, top: "unknown", topScore: 0, confidence: 0 }
  const [top, topScore] = ranked[0]
  const second = ranked[1]
  const margin = second ? (topScore - second[1]) / Math.max(topScore, 1) : 1
  const strength = Math.min(1, topScore / 8)
  return { scores: sc, top, topScore, second: second?.[0], confidence: Math.round(strength * (0.4 + 0.6 * margin) * 100) / 100 }
}

export { ADVICE }
