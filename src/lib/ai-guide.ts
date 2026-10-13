/**
 * AYA Rehber: a small, deterministic "which page do you need?" engine.
 * It understands Turkish/English questions, picks an intent and answers with real links.
 * (Pure and unit-tested; the data lookups live in the API route.)
 */

import { CRISIS_REPLY, isCrisis, matchKnowledge } from "@/lib/ai-knowledge"

export type Intent =
  | "greeting" | "teachers" | "workshops" | "live" | "articles" | "pricing" | "become_teacher"
  | "recordings" | "payouts" | "report" | "account" | "booking" | "terms" | "thanks" | "support" | "unknown"

export interface GuideLink {
  label: string
  href: string
}

/** lower-case, Turkish letters folded to ASCII, punctuation → spaces */
export function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/İ/g, "i")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9$ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const has = (n: string, words: string[]) => words.some((w) => n.includes(w))

const HUMAN_PHRASES = [
  "canli destek", "canliya bagla", "canli yetkili", "yetkili ile", "yetkiliyle", "yetkili biri", "yetkiliye", "bir insanla", "insanla konus", "insan ile", "gercek biri", "gercek bir insan", "biriyle konus", "biri ile konus",
  "temsilci", "musteri hizmet", "musteri temsil", "operator", "destek ekibi", "destek istiyorum", "destege bagla", "destek talebi", "sizi arayin", "sizinle konusmak", "yetkililere ulas", "yetkili lazim",
  "live support", "live chat", "human", "real person", "talk to someone", "talk to a person", "customer service", "customer support", "support agent", "speak to an agent", "contact support",
]
/** Does the visitor ask to talk to a person? (The feedback buttons and "bağlan" chips land here as well.) */
export function wantsHuman(raw: string): boolean {
  const n = normalize(raw)
  if (/^destek$/.test(n)) return true
  return has(n, HUMAN_PHRASES)
}

/** Order matters: the more specific intents win. */
export function detectIntent(raw: string): Intent {
  const n = normalize(raw)
  if (!n) return "unknown"
  if (wantsHuman(raw)) return "support"
  if (has(n, ["egitmen ol", "ogretmen ol", "ders vermek", "ders vermek istiyorum", "hoca ol", "egitmen basvuru", "teacher application", "become a teacher", "teach on", "i want to teach"])) return "become_teacher"
  if (has(n, ["sikayet", "bildir", "rahatsiz", "taciz", "dolandir", "report", "abuse", "harass", "guvenlik sorun"])) return "report"
  if (has(n, ["kayit indir", "kaydi indir", "ders kayd", "indir", "recording", "download", "tekrar izle", "30 gun"])) return "recordings"
  if (has(n, ["odeme talep", "odeme talebi", "hakedis", "kazanc", "para cek", "payout", "withdraw", "earnings"])) return "payouts"
  if (has(n, ["fiyat", "paket", "abonelik", "ucret", "premium", "kac para", "price", "pricing", "subscription", "plan"]) && !has(n, ["egitmen", "hoca", "ogretmen"])) return "pricing"
  if (has(n, ["uye ol", "kayit ol", "hesap ac", "giris", "sifre", "login", "sign up", "register", "hesabim", "profil"])) return "account"
  if (has(n, ["sozlesme", "kosul", "gizlilik", "kvkk", "terms", "privacy", "iade"])) return "terms"
  if (has(n, ["canli", "yayin", "live", "stream", "simdi", "su an", "right now"])) return "live"
  if (has(n, ["atolye", "workshop", "etkinlik", "kurs", "course"])) return "workshops"
  if (has(n, ["yazi", "makale", "icerik", "blog", "okumak", "article", "nefes teknik", "oku"])) return "articles"
  if (has(n, ["rezervasyon", "randevu", "ders al", "ders ayir", "deneme ders", "book", "booking", "trial", "nasil ders"])) return "booking"
  if (has(n, ["egitmen", "hoca", "ogretmen", "teacher", "instructor", "yoga", "stres", "uyku", "bel ", "agri", "hamile", "kilo", "baslangic", "esneme", "meditasyon", "nefes", "anksiyete", "kaygi", "enerji", "guc", "rahatla", "sirt", "boyun", "beginner", "back pain", "stress", "sleep", "flexib"])) return "teachers"
  if (has(n, ["tesekkur", "sag ol", "thanks", "thank you"])) return "thanks"
  if (/^(merhaba|selam|hey|hi|hello|gunaydin|iyi gunler|naber)\b/.test(n)) return "greeting"
  return "unknown"
}

export type StyleId = "hatha" | "vinyasa" | "yin" | "meditation" | "ashtanga" | "restorative"

const STYLE_KEYWORDS: Record<StyleId, string[]> = {
  hatha: ["hatha", "temel", "baslangic", "beginner", "nazik", "gentle", "ilk kez", "yeni basl"],
  vinyasa: ["vinyasa", "akis", "flow", "dinamik", "dynamic", "kardiyo", "kilo", "enerji"],
  yin: ["yin", "esneme", "stretch", "yavas", "slow", "derin", "esnek", "flexib", "sirt", "boyun"],
  meditation: ["meditasyon", "meditation", "mindful", "farkindalik", "stres", "stress", "anksiyete", "kaygi", "anxiety", "huzur", "sakin", "nefes", "breath", "uyku", "sleep", "calm"],
  ashtanga: ["ashtanga", "guc", "power", "guclu", "yogun", "zorlu", "intense", "kas"],
  restorative: ["restorative", "onarici", "dinlenme", "tukenmis", "burnout", "bel ", "agri", "pain", "back", "hamile", "pregnan", "iyilesme", "toparlan"],
}

export function detectStyles(raw: string): StyleId[] {
  const n = ` ${normalize(raw)} `
  const found: StyleId[] = []
  for (const [style, words] of Object.entries(STYLE_KEYWORDS) as [StyleId, string[]][]) {
    if (words.some((w) => n.includes(w.endsWith(" ") ? ` ${w}` : w))) found.push(style)
  }
  return found
}

export function wantsCheap(raw: string): boolean {
  return has(normalize(raw), ["ucuz", "uygun fiyat", "butce", "ekonomik", "cheap", "budget", "affordable"])
}

export interface GuideTeacher {
  id: string
  name: string
  country: string
  specialties: string
  rating: number
  reviewCount: number
  hourlyRate: number
  studentsCount: number
  /** where the profile lives, e.g. /teachers/<slug-or-id> */
  href: string
}

export function rankTeachers(all: GuideTeacher[], message: string, limit = 3, forceStyles?: StyleId[]): { teachers: GuideTeacher[]; matched: StyleId[] } {
  const styles = forceStyles?.length ? forceStyles : detectStyles(message)
  let pool = all
  if (styles.length) {
    const hit = all.filter((t) => {
      const s = normalize(t.specialties)
      return styles.some((st) => s.includes(st) || (st === "meditation" && s.includes("mindful")) || (st === "hatha" && s.includes("face")))
    })
    if (hit.length) pool = hit
  }
  const cheap = wantsCheap(message)
  const sorted = [...pool].sort((a, b) =>
    cheap
      ? a.hourlyRate - b.hourlyRate || b.rating - a.rating
      : b.rating - a.rating || b.reviewCount - a.reviewCount || b.studentsCount - a.studentsCount
  )
  return { teachers: sorted.slice(0, limit), matched: styles }
}

export const STYLE_LABEL_TR: Record<StyleId, string> = {
  hatha: "Hatha (yumuşak, temel)",
  vinyasa: "Vinyasa (akışlı, dinamik)",
  yin: "Yin (yavaş, derin esneme)",
  meditation: "Meditasyon ve nefes",
  ashtanga: "Ashtanga (güçlü, yoğun)",
  restorative: "Onarıcı yoga (dinlenme)",
}

export interface GuideReply {
  intent: Intent | "knowledge" | "crisis" | "taught"
  /** the widget opens the live-support chat */
  action?: "support"
  /** teach the visitor that this was a gap and has been recorded */
  learning?: boolean
  reply: string
  links: GuideLink[]
  teachers?: GuideTeacher[]
  /** follow-up questions to offer as chips */
  suggestions?: string[]
}

export interface GuideData {
  teachers: GuideTeacher[]
  workshops: { title: string; slug: string; category: string; startsAt: string | null; priceUsd: number; mode: string }[]
  live: { id: string; title: string; teacher: string }[]
  articles: { title: string; slug: string; category: string }[]
  signedIn: boolean
  role: string | null
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : ""

/** Compose the answer (a pure function of the intent and the data the route looked up). */
/** Navigation intents that are explicit enough to beat a general knowledge answer. */
const STRONG: Intent[] = ["become_teacher", "report", "recordings", "payouts", "pricing", "account", "terms", "live", "workshops", "articles", "booking"]
/** A knowledge hit this specific (a whole phrase matched) outranks a navigation intent. */
const SPECIFIC = 8

export const DEFAULT_SUGGESTIONS = ["Canlı destekle konuş", "Yoga nedir?", "Bel ağrım için ne yapayım?", "Üye olmak istiyorum"]

export function composeReply(message: string, data: GuideData): GuideReply {
  const joinLink: GuideLink = { label: "Ücretsiz üye ol", href: "/login?mode=register" }
  if (isCrisis(message)) return { intent: "crisis", reply: CRISIS_REPLY, links: [], suggestions: ["Kısa bir nefes egzersizi"] }
  if (wantsHuman(message)) {
    return {
      intent: "support",
      action: "support",
      reply: data.signedIn
        ? "Seni **canlı desteğe** bağlıyorum. Ekibimiz yazdıklarını görür ve buradan yanıtlar; bir yanıt geldiğinde zil simgesinde de haber alırsın."
        : "Canlı destek için önce **giriş yapman** gerekiyor; böylece yanıtı hesabına iletebiliriz. Üye değilsen kayıt ücretsiz.",
      links: data.signedIn ? [] : [{ label: "Giriş yap", href: "/login?callbackUrl=%2F" }, joinLink],
    }
  }

  const navIntent = detectIntent(message)
  const k = matchKnowledge(message)
  if (k && (k.score >= SPECIFIC || !STRONG.includes(navIntent))) {
    const e = k.entry
    const ranked = e.teachersFor?.length ? rankTeachers(data.teachers, message, 3, e.teachersFor) : null
    const links = [...(e.links ?? [])]
    if (ranked?.teachers.length) {
      links.push({ label: "Tüm eğitmenler", href: "/teachers" })
      if (!data.signedIn) links.push(joinLink)
    }
    return {
      intent: ranked?.teachers.length ? "teachers" : "knowledge",
      reply: e.answer + (ranked?.teachers.length ? "\n\nSana uygun eğitmenler:" : ""),
      links,
      teachers: ranked?.teachers,
      suggestions: e.next,
    }
  }
  return composeNavigation(message, data, navIntent)
}

export function composeNavigation(message: string, data: GuideData, intent: Intent): GuideReply {
  const n = normalize(message)
  const join: GuideLink = { label: "Ücretsiz üye ol", href: "/login?mode=register" }
  const withJoin = (links: GuideLink[]) => (data.signedIn ? links : [...links, join])

  switch (intent) {
    case "greeting":
      return {
        intent,
        reply: "Merhaba! Ben **AYA Rehber**. Sana uygun eğitmeni, atölyeyi ya da canlı yayını bulmana yardım ederim. Ne arıyorsun?",
        links: [{ label: "Eğitmenleri gör", href: "/teachers" }, { label: "Atölyeler", href: "/atolyeler" }, { label: "Canlı yayınlar", href: "/live" }],
      }
    case "thanks":
      return { intent, reply: "Rica ederim! Başka bir şey lazım olursa buradayım. 🙏", links: [] }
    case "teachers": {
      const { teachers, matched } = rankTeachers(data.teachers, message)
      if (!teachers.length) {
        return { intent, reply: "Şu an listelenecek onaylı eğitmen yok. Atölyelere ya da canlı yayınlara göz atabilirsin.", links: [{ label: "Atölyeler", href: "/atolyeler" }, { label: "Canlı yayınlar", href: "/live" }] }
      }
      const why = matched.length ? `**${matched.map((s) => STYLE_LABEL_TR[s]).join(" · ")}** için` : "Puanı en yüksek"
      return {
        intent,
        reply: `${why} ${teachers.length} eğitmen buldum. Profile girip müsait saatleri görebilir, **yarı fiyatına deneme dersi** alabilirsin.${wantsCheap(message) ? " (Fiyata göre sıraladım.)" : ""}`,
        links: withJoin([{ label: "Tüm eğitmenler", href: "/teachers" }]),
        teachers,
      }
    }
    case "workshops": {
      const q = detectStyles(message)
      const list = (q.length ? data.workshops.filter((w) => q.some((s) => normalize(w.category).includes(s))) : []).concat(data.workshops).filter((w, i, a) => a.findIndex((x) => x.slug === w.slug) === i).slice(0, 3)
      if (!list.length) return { intent, reply: "Şu an yayında atölye yok. Yenileri eklenince burada görünür; bu arada canlı yayınlara bakabilirsin.", links: [{ label: "Atölyeler", href: "/atolyeler" }, { label: "Canlı yayınlar", href: "/live" }] }
      return {
        intent,
        reply: "Yaklaşan atölyeler:\n" + list.map((w) => `• **${w.title}** — ${w.mode === "LIVE" ? fmtDate(w.startsAt) : "kayıtlı"} · ${w.priceUsd > 0 ? `$${w.priceUsd}` : "ücretsiz"}`).join("\n"),
        links: withJoin([...list.map((w) => ({ label: w.title, href: `/atolyeler/${w.slug}` })), { label: "Tüm atölyeler", href: "/atolyeler" }]),
      }
    }
    case "live": {
      if (!data.live.length) return { intent, reply: "Şu anda canlı yayın yok. Yayın başladığında burada ve ana sayfada görünür. Bu arada atölyelere göz atabilirsin.", links: [{ label: "Canlı yayın rehberi", href: "/live" }, { label: "Atölyeler", href: "/atolyeler" }] }
      return {
        intent,
        reply: `Şu an **${data.live.length}** canlı yayın var:\n` + data.live.slice(0, 3).map((l) => `• **${l.title}** — ${l.teacher}`).join("\n"),
        links: withJoin([...data.live.slice(0, 3).map((l) => ({ label: `İzle: ${l.title}`, href: `/live/${l.id}` })), { label: "Tüm yayınlar", href: "/live" }]),
      }
    }
    case "articles": {
      const list = data.articles.slice(0, 3)
      if (!list.length) return { intent, reply: "Yazılar bölümüne yakında yenileri eklenecek.", links: [{ label: "İçerikler", href: "/icerikler" }] }
      return {
        intent,
        reply: "Okumaya şuradan başlayabilirsin:\n" + list.map((a) => `• **${a.title}** (${a.category})`).join("\n"),
        links: [...list.map((a) => ({ label: a.title, href: `/icerikler/${a.slug}` })), { label: "Tüm içerikler", href: "/icerikler" }],
      }
    }
    case "pricing":
      return {
        intent,
        reply: "Tek ders satın alabilir ya da aylık/yıllık pakete geçebilirsin. Her eğitmenin ilk deneme dersi **yarı fiyat**. Atölyelerin bir kısmı ücretsiz.",
        links: [{ label: "Paketler", href: "/pricing" }, { label: "Eğitmenler", href: "/teachers" }, { label: "Atölyeler", href: "/atolyeler" }],
      }
    case "become_teacher":
      return {
        intent,
        reply: "Eğitmen olmak için: **1)** başvuru formunu doldur ve sertifikanı yükle, **2)** ekibimiz inceler, **3)** yöneticilerle kısa bir deneme yayını yaparsın, **4)** onaylanınca ders ve yayın vermeye başlarsın.",
        links: data.role === "TEACHER" ? [{ label: "Eğitmen paneli", href: "/teach" }] : [{ label: "Eğitmen başvurusu", href: "/become-teacher" }],
      }
    case "recordings":
      return {
        intent,
        reply: "Eğitmen dersi kaydederse kayıt **yalnızca o dersin eğitmeni ve öğrencisi** tarafından indirilebilir ve **30 gün** sonra silinir. İndirme bağlantısı panelindeki “Ders Kayıtları” bölümünde.",
        links: withJoin([{ label: data.role === "TEACHER" ? "Eğitmen paneli" : "Panelim", href: data.role === "TEACHER" ? "/teach" : "/dashboard" }]),
      }
    case "payouts":
      return {
        intent,
        reply: data.role === "TEACHER"
          ? "Kazancını **Kazançlar** sayfasından çekebilirsin: tutarı ve IBAN'ı girip talep oluştur, yönetici onaylayınca ödeme yapılır."
          : "Ödeme talepleri eğitmenler içindir: eğitmen panelindeki **Kazançlar** sayfasından oluşturulur. Eğitmen olmak istersen başvurabilirsin.",
        links: data.role === "TEACHER" ? [{ label: "Kazançlar", href: "/teach/earnings" }] : [{ label: "Eğitmen başvurusu", href: "/become-teacher" }],
      }
    case "report":
      return {
        intent,
        reply: "Bir sorun mu yaşadın? Canlı yayında “Yayını bildir” ya da bir mesajın yanındaki bayrağa, atölye ve eğitmen sayfalarında “Bildir” düğmesine, ders odasında “Sorun bildir”e basabilirsin. Yöneticiler inceler; bildirdiğin kişi kimliğini görmez. Durumu **Raporlarım**'den izlersin.",
        links: data.signedIn ? [{ label: "Raporlarım", href: "/dashboard/reports" }] : [join],
      }
    case "account":
      return {
        intent,
        reply: data.signedIn
          ? "Zaten giriş yaptın. Profilini ve ilerlemeni panelinden yönetebilirsin."
          : "Üyelik **ücretsiz**: e-postayla ya da Google ile 1 dakikada kayıt olursun. Kayıtta kullanım sözleşmesini onaylaman gerekir.",
        links: data.signedIn ? [{ label: "Panelim", href: "/dashboard" }, { label: "Profilim", href: "/dashboard/profile" }] : [{ label: "Üye ol / giriş yap", href: "/login?mode=register" }],
      }
    case "terms":
      return { intent, reply: "Kullanım koşullarını ve gizlilik politikasını buradan okuyabilirsin.", links: [{ label: "Kullanım sözleşmesi", href: "/terms" }, { label: "Gizlilik", href: "/privacy" }] }
    case "booking":
      return {
        intent,
        reply: "Ders ayırmak için bir eğitmen seç, profildeki müsait saatlerden birini işaretle ve ödemeyi tamamla. İlk deneme dersi **yarı fiyat**. Onaylı eğitmenlerle ders ayırabilirsin.",
        links: withJoin([{ label: "Eğitmen bul", href: "/teachers" }]),
      }
    default: {
      void n
      return {
        intent: "unknown",
        learning: true,
        reply: "Bunu henüz bilmiyorum ama **öğreneceğim**: sorunu ekibime ilettim, cevap eklendiğinde bir dahaki sefere yanıtlayabileceğim. Şimdi yardıma ihtiyacın varsa **canlı destek** yazman yeterli; ya da yoga, nefes, meditasyon ve AYA (eğitmenler, atölyeler, ödeme, kayıtlar) hakkında farklı bir soru sorabilirsin.",
        links: [{ label: "Eğitmenler", href: "/teachers" }, { label: "Atölyeler", href: "/atolyeler" }, { label: "Canlı yayınlar", href: "/live" }],
        suggestions: DEFAULT_SUGGESTIONS,
      }
    }
  }
}
