/**
 * The guide's answers. Each handler looks up real data with the tools, then writes the reply from what it found:
 * it names the best match and the cheapest, explains why a style fits, says plainly when nothing matched and what
 * it tried instead. Wording varies with a per-message seed, so the same question reads the same but different
 * questions do not sound like one template.
 */
import { CRISIS_REPLY, KNOWLEDGE, matchKnowledge } from "@/lib/ai-knowledge"
import { DEFAULT_SUGGESTIONS, GuideData, GuideLink, STYLE_LABEL_TR, StyleId, composeNavigation } from "@/lib/ai-guide"
import { POSE_BY_SLUG, YogaPose } from "@/lib/yoga-poses"
import { STYLE_BY_SLUG, STYLES } from "@/lib/yoga-styles"
import { FREE_SHIPPING_KURUS } from "@/lib/shop"
import { AiCard } from "@/lib/ai/tools"
import { Answer, Env, answer, dayStart, istanbulHour, joinTr, usd, weekdayOf } from "./answer"
import { AREA_LABEL, CONDITION_LABEL, GOAL_LABEL, TimeHint } from "./lexicon"
import { AREA_LEAD, AREA_STYLES, CONDITION_ADVICE, GENTLE_CONDITIONS, GOAL_LEAD, GOAL_STYLES, LEVEL_LABEL, STYLE_SLUG } from "./maps"
import { pick } from "./nlp"
import { buildRoutine, poseAnswer, poseConflicts, styleName, suggestPoses } from "./poses"
import { Hit, entryTitle, knowledgeById, restore, retrieve, sentenceCase } from "./retrieval"
import { Slots } from "./slots"
import { BrainIntent } from "./intents"

const v = <T,>(env: Env, options: readonly T[], salt = 0): T => pick(env.seed + salt * 7919, options)
const JOIN: GuideLink = { label: "Ücretsiz üye ol", href: "/login?mode=register" }
const withJoin = (env: Env, links: GuideLink[]) => (env.signedIn ? links : [...links, JOIN])

// ───────────────────────── shared pieces ─────────────────────────

/** The styles that fit what the person said. Explicit styles win; otherwise goals and body areas decide; health conditions keep it gentle. */
export function pickStyles(s: Slots): StyleId[] {
  if (s.styles.length) return s.styles
  const gentle = s.conditions.some((c) => GENTLE_CONDITIONS.includes(c)) || s.goals.some((g) => ["pregnancy", "seniors", "pain"].includes(g))
  let list: StyleId[] = [...s.areas.flatMap((a) => AREA_STYLES[a]), ...s.goals.flatMap((g) => GOAL_STYLES[g])]
  if (gentle) list = list.filter((x) => x !== "vinyasa" && x !== "ashtanga")
  if (gentle && !list.length) list = ["restorative", "hatha"]
  if (s.level === "beginner") list = ["hatha", ...list]
  if (s.level === "advanced" && !gentle) list = [...list, "vinyasa", "ashtanga"]
  const out = [...new Set(list)]
  return out.slice(0, 3)
}

const styleNames = (ids: StyleId[]) => joinTr(ids.map((s) => `**${styleName(s)}**`))

/** "Bel ağrın için" / "Uyku ve stres için": what the answer is about, in words. */
function aboutPhrase(s: Slots): string {
  const goals = s.goals.filter((g) => !(g === "pain" && s.areas.length))
  const parts = [...s.areas.slice(0, 2).map((a) => `${AREA_LABEL[a]} ağrısı`.replace("karın ve sindirim ağrısı", "karın ve sindirim rahatsızlığı").replace("göz ağrısı", "göz yorgunluğu")), ...goals.slice(0, 2).map((g) => GOAL_LABEL[g])]
  const uniq = [...new Set(parts)]
  if (!uniq.length) return ""
  return `${joinTr(uniq)} için`
}

const conditionNotes = (s: Slots, max = 2) => s.conditions.slice(0, max).map((c) => CONDITION_ADVICE[c])

const poseCard = (p: YogaPose): AiCard => ({ kind: "pose", title: p.name, subtitle: `${p.sanskrit} · ${p.level}`, meta: p.category, href: `/pozlar/${p.slug}`, image: `/poses/${p.slug}.webp` })

/** Sat 00:00 of the coming weekend, in Istanbul. */
function weekendStart(now: Date): Date {
  const wd = weekdayOf(now)
  if (wd === 6) return dayStart(now, 0)
  if (wd === 0) return dayStart(now, -1)
  return dayStart(now, 6 - wd)
}

/** The date range (and the part of the day) a time hint stands for. */
export function timeWindow(t: TimeHint | undefined, now: Date): { from?: Date; to?: Date; part?: "morning" | "noon" | "evening"; label?: string } {
  if (!t) return {}
  const out: ReturnType<typeof timeWindow> = { part: t.part }
  const dayNames = ["pazar", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi"]
  if (t.weekday !== undefined) {
    const diff = (t.weekday - weekdayOf(now) + 7) % 7
    out.from = dayStart(now, diff)
    out.to = dayStart(now, diff + 1)
    out.label = diff === 0 ? "bugün" : dayNames[t.weekday]
  } else if (t.day === "today") { out.from = now; out.to = dayStart(now, 1); out.label = "bugün" }
  else if (t.day === "tomorrow") { out.from = dayStart(now, 1); out.to = dayStart(now, 2); out.label = "yarın" }
  else if (t.day === "weekend") { const w = weekendStart(now); out.from = w.getTime() < now.getTime() ? now : w; out.to = new Date(w.getTime() + 2 * 86_400_000); out.label = "bu hafta sonu" }
  else if (t.day === "week") { out.from = now; out.to = dayStart(now, 7); out.label = "bu hafta" }
  else if (t.day === "nextweek") { out.from = dayStart(now, 7); out.to = dayStart(now, 14); out.label = "gelecek hafta" }
  if (t.part && !out.label) out.label = t.part === "morning" ? "sabah saatleri" : t.part === "noon" ? "öğle saatleri" : "akşam saatleri"
  else if (t.part && out.label) out.label += t.part === "morning" ? " sabah" : t.part === "noon" ? " öğle" : " akşam"
  return out
}

const inPart = (iso: string | null, part: "morning" | "noon" | "evening" | undefined) => {
  if (!iso || !part) return true
  const h = istanbulHour(new Date(iso))
  return part === "morning" ? h >= 5 && h < 12 : part === "noon" ? h >= 11 && h < 15 : h >= 17
}

// ───────────────────────── small talk ─────────────────────────

export function greeting(env: Env): Answer {
  const h = istanbulHour(env.now)
  const hi = h >= 5 && h < 11 ? "Günaydın" : h >= 18 || h < 4 ? "İyi akşamlar" : "Merhaba"
  const who = env.name ? `, ${env.name}` : ""
  const ask = v(env, ["Sana nasıl yardımcı olabilirim?", "Bugün ne arıyorsun?", "Ne konuşmak istersin?", "Neye ihtiyacın var?"])
  const can = v(env, [
    "Eğitmen, atölye ve canlı yayın bulabilir, pozları adım adım anlatabilir, sana göre bir pratik rutini hazırlayabilirim.",
    "Sana uygun yoga stilini seçebilir, poz ve nefes çalışmalarını anlatabilir, AYA'da ne nerede bulursun gösterebilirim.",
    "Ağrı, stres ya da uyku gibi bir derdin varsa ona göre yoga önerebilir; eğitmen ve atölye de bulabilirim.",
  ])
  return answer({
    intent: "greeting", kind: "navigation", rate: false,
    text: `**${hi}${who}!** Ben AYA Rehber. ${can} ${ask}`,
    suggestions: ["Bel ağrım için ne yapabilirim?", "10 dakikalık sabah rutini hazırla", "Canlı yayın var mı?", "Bana uygun bir eğitmen öner"],
    links: [{ label: "Eğitmenleri gör", href: "/teachers" }, { label: "Atölyeler", href: "/atolyeler" }],
  })
}

export function thanks(env: Env): Answer {
  return answer({
    intent: "thanks", kind: "navigation", rate: false,
    text: v(env, ["Rica ederim! Aklına başka bir şey gelirse buradayım. 🙏", "Ne demek, ne zaman istersen. İyi pratikler! 🙏", "Sevindim! Başka bir konuda da yardımcı olabilirim."]),
  })
}

export function bye(env: Env): Answer {
  return answer({ intent: "bye", kind: "navigation", rate: false, text: v(env, ["Görüşürüz, kendine iyi bak! 🙏", "Hoşça kal; nefesini unutma 🙂", "İyi günler! İhtiyacın olduğunda buradayım."]) })
}

export function crisis(): Answer {
  return answer({ intent: "crisis", kind: "crisis", rate: false, text: CRISIS_REPLY, suggestions: ["Kısa bir nefes egzersizi"] })
}

export function support(env: Env): Answer {
  return answer({
    intent: "support", kind: "support", rate: false, action: "support",
    text: env.signedIn
      ? "Seni **canlı desteğe** bağlıyorum. Ekibimiz yazdıklarını görür ve buradan yanıtlar; bir yanıt geldiğinde zil simgesinde de haber alırsın."
      : "Canlı destek için önce **giriş yapman** gerekiyor; böylece yanıtı hesabına iletebiliriz. Üye değilsen kayıt ücretsiz.",
    links: env.signedIn ? [] : [{ label: "Giriş yap", href: "/login?callbackUrl=%2F" }, JOIN],
  })
}

// ───────────────────────── teachers ─────────────────────────

export async function teachers(env: Env): Promise<Answer> {
  const s = env.turn.slots
  const styles = pickStyles(s)
  const explicit = s.styles.length > 0
  const maxUsd = s.price?.free ? 0 : s.price?.maxUsd
  const offset = env.turn.page * 3
  const base = { styles, sort: s.price?.cheap ? "price" : undefined, limit: 3 }
  const notes: string[] = []
  const tools: string[] = ["search_teachers"]

  let r = await env.tool("search_teachers", { ...base, max_price_usd: maxUsd, offset })
  let rows: any[] = r.result.teachers ?? []
  if (!rows.length && offset > 0) {
    notes.push("Hepsini gösterdim; baştan listeliyorum.")
    r = await env.tool("search_teachers", { ...base, max_price_usd: maxUsd, offset: 0 })
    rows = r.result.teachers ?? []
  }
  if (!rows.length && maxUsd !== undefined) {
    notes.push(`${usd(maxUsd)} bütçeye uyan eğitmen bulamadım; bütçeyi esnetince en uygun olanlar bunlar.`)
    r = await env.tool("search_teachers", { ...base, offset: 0 })
    rows = r.result.teachers ?? []
  }
  if (!rows.length && styles.length) {
    notes.push("Bu stile özel eğitmen bulamadım; genel olarak en iyi puanlılar:")
    r = await env.tool("search_teachers", { limit: 3, sort: base.sort })
    rows = r.result.teachers ?? []
  }
  if (!rows.length) {
    return answer({ intent: "teachers", kind: "navigation", tools, text: "Şu an listelenecek onaylı eğitmen yok. Atölyelere ya da canlı yayınlara göz atabilirsin.", links: [{ label: "Atölyeler", href: "/atolyeler" }, { label: "Canlı yayınlar", href: "/live" }], suggestions: ["Atölyeleri göster", "Canlı yayın var mı?"] })
  }

  const followLead = notes.length ? "" : s.price?.cheap ? "Fiyata göre sıraladım:" : env.turn.page > 0 ? "Diğer seçenekler:" : "Güncelledim:"
  const why = env.turn.followUp
    ? followLead
    : explicit
    ? `${styleNames(styles)} dersi veren ${rows.length} eğitmen buldum.`
    : styles.length && (s.areas.length || s.goals.length)
      ? `${sentenceCase(aboutPhrase(s))} ${styleNames(styles)} tarzı çalışmalar iyi gider; bu alanda ders veren ${rows.length} eğitmen buldum.`
      : v(env, [`Puanı en yüksek ${rows.length} eğitmen:`, `Sana ${rows.length} eğitmen önerebilirim:`, `${rows.length} eğitmen buldum:`])

  const best = [...rows].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)[0]
  const cheapest = [...rows].sort((a, b) => a.price_usd_per_hour - b.price_usd_per_hour)[0]
  const pickLine = rows.length === 1 || best.name === cheapest.name
    ? rows.length === 1 ? `**${best.name}**: ★ ${best.rating}, ${usd(best.price_usd_per_hour)}/saat.` : `**${best.name}** hem en yüksek puanlı (★ ${best.rating}) hem de en uygun fiyatlı (${usd(best.price_usd_per_hour)}/saat).`
    : `En yüksek puanlı **${best.name}** (★ ${best.rating}${best.reviews ? `, ${best.reviews} yorum` : ""}); en uygun fiyatlı **${cheapest.name}** (${usd(cheapest.price_usd_per_hour)}/saat).`
  const trial = "Her eğitmenle ilk **deneme dersi yarı fiyat**; profile girip müsait saatleri görebilirsin."
  const cond = conditionNotes(s, 1)

  const budget = maxUsd !== undefined && !notes.length && maxUsd > 0 ? `${usd(maxUsd)}/saat bütçene uyanlar:` : ""
  const text = [notes.join(" "), budget, why, pickLine, trial, ...cond.map((c) => `🌿 ${c}`)].filter(Boolean).join("\n\n")
  return answer({
    intent: "teachers", kind: "navigation", tools, text, cards: r.cards ?? [], confidence: env.turn.cls.confidence,
    links: withJoin(env, [{ label: "Tüm eğitmenler", href: "/teachers" }]),
    suggestions: [s.price?.cheap ? "Başka eğitmen göster" : "Daha uygun fiyatlısı var mı?", "Başka eğitmen göster", styles[0] ? `${styleName(styles[0])} nedir?` : "Yoga stilleri nelerdir?", "Atölyeleri göster"].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4),
  })
}

// ───────────────────────── workshops & live ─────────────────────────

export async function workshops(env: Env): Promise<Answer> {
  const s = env.turn.slots
  const styleSlug = s.styles[0] ? STYLE_SLUG[s.styles[0]] : s.goals.length || s.areas.length ? STYLE_SLUG[pickStyles(s)[0] ?? "hatha"] : undefined
  const category = styleSlug ? STYLE_BY_SLUG[styleSlug]?.category : undefined
  const win = timeWindow(s.time, env.now)
  const maxUsd = s.price?.free ? 0 : s.price?.maxUsd
  const offset = env.turn.page * 4
  const notes: string[] = []
  const input = { category, mode: s.mode, max_price_usd: maxUsd, from: win.from?.toISOString(), to: win.to?.toISOString(), limit: 8, offset }
  let r = await env.tool("search_workshops", input)
  // a day or time of day only makes sense for live sessions; recordings can be watched any time
  let items: any[] = (r.result.workshops ?? []).filter((w: any) => (win.from || win.part ? w.mode === "canlı" : true) && (w.mode !== "canlı" || inPart(w.starts_iso, win.part)))
  if (!items.length && (win.from || win.part)) {
    notes.push(`${win.label ? `**${win.label}**` : "Bu zaman aralığı"} için atölye yok; yaklaşanlara baktım:`)
    r = await env.tool("search_workshops", { ...input, from: undefined, to: undefined, offset: 0 })
    items = r.result.workshops ?? []
  }
  if (!items.length && category) {
    notes.push(`**${category}** kategorisinde atölye yok; diğer yaklaşan atölyeler:`)
    r = await env.tool("search_workshops", { limit: 6, mode: s.mode })
    items = r.result.workshops ?? []
  }
  items = items.slice(0, 4)
  const cards: AiCard[] = (r.cards ?? []).filter((c: AiCard) => items.some((w) => w.link === c.href)).slice(0, 4)
  if (!items.length) {
    return answer({ intent: "workshops", kind: "navigation", tools: ["search_workshops"], text: "Şu an yayında atölye yok. Yenileri eklenince burada görünür; bu arada canlı yayınlara ya da yazılara göz atabilirsin.", links: [{ label: "Atölyeler", href: "/atolyeler" }, { label: "Canlı yayınlar", href: "/live" }], suggestions: ["Canlı yayın var mı?", "Bana eğitmen öner"] })
  }
  const lines = items.map((w) => {
    const when = w.mode === "canlı" ? w.starts_at.replace(/ \d{4}/, "") : "istediğin zaman izle"
    const price = w.price_usd > 0 ? usd(w.price_usd) : "ücretsiz"
    const seats = typeof w.seats_left === "number" && w.seats_left <= 3 && w.seats_left >= 0 ? (w.seats_left === 0 ? " · **kontenjan dolu**" : ` · **son ${w.seats_left} yer**`) : ""
    return `- **${w.title}** (${w.teacher}) · ${when} · ${price}${seats}`
  })
  const free = items.filter((w) => w.price_usd === 0).length
  const lead = notes.length ? notes.join(" ") : v(env, [`${win.label ? `${sentenceCase(win.label)} için ` : ""}${items.length} atölye var:`, `Yaklaşan atölyeler${win.label ? ` (${win.label})` : ""}:`])
  const tail = free ? `${free} tanesi ücretsiz.` : ""
  return answer({
    intent: "workshops", kind: "navigation", tools: ["search_workshops"], cards, confidence: env.turn.cls.confidence,
    text: [lead, lines.join("\n"), tail].filter(Boolean).join("\n\n"),
    links: withJoin(env, [{ label: "Tüm atölyeler", href: "/atolyeler" }]),
    suggestions: ["Hafta sonu atölye var mı?", "Ücretsiz atölyeler", "Kayıtlı atölyeler", "Canlı yayın var mı?"],
  })
}

export async function live(env: Env): Promise<Answer> {
  const r = await env.tool("live_now", {})
  const rooms: any[] = r.result.live ?? []
  if (rooms.length) {
    const lines = rooms.slice(0, 3).map((x) => `- **${x.title}** — ${x.teacher}${x.viewers ? ` · ${x.viewers} izleyici` : ""}`)
    return answer({
      intent: "live", kind: "navigation", tools: ["live_now"], cards: r.cards ?? [], statuses: ["Canlı yayınlara bakılıyor…"],
      text: `Şu an **${rooms.length}** canlı yayın var:\n${lines.join("\n")}`,
      links: withJoin(env, [{ label: "Tüm yayınlar", href: "/live" }]),
      suggestions: ["Bugün atölye var mı?", "Eğitmen öner"],
    })
  }
  const w = await env.tool("search_workshops", { mode: "LIVE", limit: 3 })
  const list: any[] = w.result.workshops ?? []
  const next = list.length ? `\n\nYaklaşan canlı atölyeler:\n${list.map((x) => `- **${x.title}** · ${x.starts_at.replace(/ \d{4}/, "")}`).join("\n")}` : ""
  return answer({
    intent: "live", kind: "navigation", tools: ["live_now", "search_workshops"], cards: w.cards ?? [],
    text: `Şu anda canlı yayın yok. Yayın başladığında burada ve ana sayfada görünür.${next}`,
    links: [{ label: "Canlı yayın rehberi", href: "/live" }, { label: "Atölyeler", href: "/atolyeler" }],
    suggestions: ["Atölyeleri göster", "Bana eğitmen öner", "Kayıtlı atölyeler"],
  })
}

// ───────────────────────── content ─────────────────────────

const NOISE = new Set(["yazi", "yazilar", "makale", "makaleler", "icerik", "icerikler", "blog", "oku", "okumak", "okuyayim", "oner", "onerir", "misin", "hakkinda", "ilgili", "konusunda", "bir", "podcast", "podcasti", "bolum", "bolumler", "dinle", "dinlemek", "dinleyeyim", "duyuru", "duyurular", "haber", "haberler", "var", "yok", "bana", "goster", "son", "yeni", "yoga", "yogayla", "icin", "biraz", "sesli", "konusmalar", "konuk", "neler", "ne", "mi", "mu", "ver", "bul", "ara", "baska", "daha", "lutfen"])

function topicQuery(env: Env): string {
  const s = env.turn.slots
  const words = env.turn.doc.content.filter((w) => !NOISE.has(w) && w.length >= 3)
  const fromSlots = [...s.areas.map((a) => AREA_LABEL[a]), ...s.goals.map((g) => GOAL_LABEL[g])].flatMap((x) => x.split(" "))
  const q = [...new Set([...words.map((w) => restore(w)), ...fromSlots.map((w) => w.toLocaleLowerCase("tr-TR"))])].filter((w) => w.length >= 3 && !["ve", "için"].includes(w))
  return q.slice(0, 3).join(" ")
}

async function contentAnswer(env: Env, type: "article" | "news" | "podcast", intent: BrainIntent): Promise<Answer> {
  const q = env.turn.slots.topic ?? topicQuery(env)
  const offset = env.turn.page * 4
  const noun = type === "podcast" ? "podcast bölümü" : type === "news" ? "duyuru" : "yazı"
  let r = await env.tool("search_content", { query: q, type, offset })
  let rows: any[] = r.result.articles ?? r.result.podcast_episodes ?? []
  let note = ""
  if (!rows.length && q) {
    note = `**${q}** konusunda ${noun} bulamadım; en son ${noun === "yazı" ? "yazılar" : `${noun}ler`}:`
    r = await env.tool("search_content", { type, offset: 0 })
    rows = r.result.articles ?? r.result.podcast_episodes ?? []
  }
  if (!rows.length) {
    const link = type === "podcast" ? "/podcast" : type === "news" ? "/duyurular" : "/icerikler"
    return answer({ intent, kind: "navigation", tools: ["search_content"], text: `Şu an listelenecek ${noun} yok; yenileri eklenince burada olacak.`, links: [{ label: type === "podcast" ? "Podcast" : type === "news" ? "Duyurular" : "İçerikler", href: link }] })
  }
  const lines = rows.slice(0, 3).map((x) => `- **${x.title}**${x.summary ? ` — ${x.summary}` : x.category ? ` (${x.category})` : ""}`)
  const lead = note || (q ? `**${q}** hakkında ${rows.length} ${noun} buldum:` : v(env, [`Okumaya buradan başlayabilirsin:`, `Son ${noun === "yazı" ? "yazılar" : `${noun}ler`}:`]))
  const link = type === "podcast" ? { label: "Tüm bölümler", href: "/podcast" } : type === "news" ? { label: "Tüm duyurular", href: "/duyurular" } : { label: "Tüm içerikler", href: "/icerikler" }
  return answer({
    intent, kind: "navigation", tools: ["search_content"], cards: r.cards ?? [], text: `${lead}\n${lines.join("\n")}`, links: [link], confidence: env.turn.cls.confidence,
    suggestions: type === "article" ? ["Podcast öner", "Duyurular neler?", "Bana eğitmen öner"] : ["Yazılara bak", "Atölyeleri göster"],
  })
}
export const articles = (env: Env) => contentAnswer(env, "article", "articles")
export const news = (env: Env) => contentAnswer(env, "news", "news")
export const podcast = (env: Env) => contentAnswer(env, "podcast", "podcast")

// ───────────────────────── shop ─────────────────────────

export async function products(env: Env): Promise<Answer> {
  const s = env.turn.slots
  const q = env.turn.doc.content.filter((w) => !NOISE.has(w) && !["urun", "urunler", "magaza", "shop", "satin", "almak", "al", "istiyorum", "alisveris", "sepet", "hediye", "fiyat", "lira", "tl", "altinda", "kadar", "ucuz"].includes(w) && w.length >= 3 && !/^\d+$/.test(w)).map(restore).slice(0, 2).join(" ")
  const input = { category: s.productCategory, query: s.productCategory ? "" : q, max_tl: s.price?.maxTl, sort: s.price?.cheap ? "price" : undefined, offset: env.turn.page * 4 }
  let r = await env.tool("search_products", input)
  let rows: any[] = r.result.products ?? []
  let note = ""
  if (!rows.length && (input.query || input.max_tl !== undefined)) {
    note = input.max_tl !== undefined && !input.query ? `₺${input.max_tl} altında ürün bulamadım; mağazadaki ürünler:` : "Tam bu aramaya uyan ürün bulamadım; mağazada şunlar var:"
    r = await env.tool("search_products", { category: s.productCategory })
    rows = r.result.products ?? []
  }
  if (!rows.length) return answer({ intent: "products", kind: "navigation", tools: ["search_products"], text: "Mağazada şu an listelenecek ürün yok; yeni ürünler eklenince burada görünür.", links: [{ label: "Mağaza", href: "/shop" }] })
  const lines = rows.slice(0, 4).map((p) => `- **${p.name}** — ${p.price}${p.in_stock ? (p.stock ? ` · son ${p.stock} adet` : "") : " · **tükendi**"}`)
  const ship = `₺${FREE_SHIPPING_KURUS / 100} üzeri siparişlerde kargo ücretsiz; ödemeyi havale/EFT ya da kapıda yapabilirsin.`
  return answer({
    intent: "products", kind: "navigation", tools: ["search_products"], cards: r.cards ?? [], confidence: env.turn.cls.confidence,
    text: [note || v(env, ["Mağazadan şunları önerebilirim:", "AYA Shop'ta şunlar var:"]), lines.join("\n"), ship].join("\n\n"),
    links: [{ label: "Mağazaya git", href: "/shop" }],
    suggestions: ["Daha ucuz ürünler", "Yoga matı öner", "Aromaterapi ürünleri", "Siparişim nerede?"],
  })
}

export async function order(env: Env): Promise<Answer> {
  const s = env.turn.slots
  const email = s.email ?? env.ctx.user?.email ?? undefined
  if (!s.orderCode) {
    return answer({ intent: "order", kind: "navigation", rate: false, text: "Siparişinin durumuna bakmam için **sipariş kodunu** (AYA-XXXXXX biçiminde, onay e-postanda yazıyor) ve **sipariş verirken kullandığın e-postayı** yazar mısın?", links: [{ label: "Mağaza", href: "/shop" }], suggestions: [] })
  }
  if (!email) {
    return answer({ intent: "order", kind: "navigation", rate: false, text: `**${s.orderCode}** kodunu aldım. Güvenlik için siparişte kullandığın **e-posta adresini** de yazar mısın?` })
  }
  const r = await env.tool("order_status", { code: s.orderCode, email })
  if (!r.result.found) {
    return answer({ intent: "order", kind: "navigation", tools: ["order_status"], statuses: ["Sipariş sorgulanıyor…"], text: "Bu kod ve e-posta ile eşleşen bir sipariş bulamadım. Kodu (AYA-XXXXXX) ve siparişte kullandığın e-postayı bir daha kontrol eder misin? Sorun sürerse canlı destek yardımcı olur.", suggestions: ["Canlı destekle konuş"] })
  }
  const o = r.result
  const track = o.tracking_no ? `\nKargo takip numaran: **${o.tracking_no}**.` : ""
  const next = /ödeme|bekl/i.test(String(o.status)) ? "\nÖdemen onaylanınca hazırlığa başlanır; 3 gün içinde ödenmeyen havale siparişleri iptal edilir." : /kargo/i.test(String(o.status)) ? "\nKargon yolda; teslimat birkaç gün sürebilir." : ""
  return answer({
    intent: "order", kind: "navigation", tools: ["order_status"], statuses: ["Sipariş sorgulanıyor…"], cards: r.cards ?? [],
    text: `**${o.code}** siparişin şu an: **${o.status}**.\nToplam ${o.total} · ${o.payment}\nÜrünler: ${(o.items ?? []).join(", ")}.${track}${next}`,
    links: [{ label: "Sipariş detayı", href: o.link }], suggestions: ["Başka sipariş sorgula", "İade nasıl yapılır?"],
  })
}

export async function schedule(env: Env): Promise<Answer> {
  if (!env.signedIn) {
    return answer({ intent: "schedule", kind: "navigation", rate: false, text: "Takvimini görebilmem için **giriş yapman** gerekiyor; derslerin ve atölyelerin hesabına bağlı.", links: [{ label: "Giriş yap", href: "/login?callbackUrl=%2Fdashboard" }, JOIN] })
  }
  const r = await env.tool("my_schedule", {})
  const x = r.result
  const lessons: any[] = x.lessons ?? []
  const taught: any[] = x.lessons_i_teach ?? []
  const ws: any[] = x.workshops ?? []
  if (!lessons.length && !taught.length && !ws.length) {
    return answer({ intent: "schedule", kind: "navigation", tools: ["my_schedule"], rate: false, statuses: ["Takvimine bakılıyor…"], text: "Yaklaşan bir ders ya da atölyen yok. İstersen sana uygun bir eğitmen ya da atölye bulayım.", suggestions: ["Bana eğitmen öner", "Atölyeleri göster"], links: [{ label: "Panelim", href: "/dashboard" }] })
  }
  const parts: string[] = []
  if (lessons.length) parts.push(`**${lessons.length} yaklaşan dersin** var. Sıradaki: **${lessons[0].with}** ile ${lessons[0].at}.`)
  if (taught.length) parts.push(`Vereceğin ${taught.length} ders var; ilki ${taught[0].student} ile ${taught[0].at}.`)
  if (ws.length) parts.push(`Kayıtlı atölyelerin:\n${ws.map((w) => `- **${w.title}**${w.at ? ` · ${w.at}` : ""} (${w.status})`).join("\n")}`)
  return answer({ intent: "schedule", kind: "navigation", tools: ["my_schedule"], statuses: ["Takvimine bakılıyor…"], cards: r.cards ?? [], rate: false, text: parts.join("\n\n"), links: [{ label: "Panelim", href: "/dashboard" }], suggestions: ["Yeni ders ayırmak istiyorum", "Atölyeleri göster"] })
}

// ───────────────────────── poses, routines ─────────────────────────

export function pose(env: Env): Answer | null {
  const s = env.turn.slots
  const p = s.poseSlug ? POSE_BY_SLUG[s.poseSlug] : undefined
  if (p) {
    const a = poseAnswer(p, s.poseFacet, s.conditions)
    const counters = (s.poseFacet === "counter" ? p.counter : []).map((c) => POSE_BY_SLUG[c]).filter(Boolean)
    return answer({
      intent: "pose", kind: "knowledge", tools: ["find_pose"], text: a.text, cards: [poseCard(p), ...counters.map(poseCard)], confidence: env.turn.cls.confidence,
      links: [{ label: `${p.name} sayfası`, href: `/pozlar/${p.slug}` }], suggestions: a.chips,
    })
  }
  // "bel için poz öner" → pick from the library by need
  const list = suggestPoses({ areas: s.areas, goals: s.goals, level: s.level, conditions: s.conditions }, 3)
  if (list.length) {
    const about = aboutPhrase(s)
    return answer({
      intent: "pose", kind: "knowledge", tools: ["find_pose"], cards: list.map(poseCard), confidence: env.turn.cls.confidence,
      text: `${about ? `${sentenceCase(about)} ` : ""}şu duruşları deneyebilirsin:\n${list.map((x) => `- **${x.name}** (${x.level}) — ${x.summary}`).join("\n")}\n\nHer birini yavaş, nefesle ve ağrı hissetmeden yap.${s.conditions.length ? `\n\n🌿 ${conditionNotes(s, 1)[0]}` : ""}`,
      links: [{ label: "Tüm pozlar", href: "/pozlar" }], suggestions: [`${list[0].name} nasıl yapılır?`, "10 dakikalık rutin hazırla", "Bana eğitmen öner"],
    })
  }
  // a bare "pozlar": show the library; a pose that is not in it falls through to the knowledge base
  if (env.turn.doc.content.length > 2) return null
  return answer({
    intent: "pose", kind: "knowledge", tools: ["find_pose"], text: "Poz kütüphanesinde adım adım anlatımlı, 3 boyutlu gösterimli duruşlar var. Bir pozun adını (ör. “çocuk pozu”, “savaşçı”) ya da bir hedefi (ör. “bel için poz”) yazarsan sana özel anlatayım.",
    links: [{ label: "Poz kütüphanesi", href: "/pozlar" }], suggestions: ["Çocuk pozu nasıl yapılır?", "Bel için hangi pozlar?", "Yeni başlayanlar için pozlar"],
  })
}

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

export function plan(env: Env): Answer {
  const s = env.turn.slots
  const weekly = env.turn.doc.has("haftalik", "hafta icin", "bir haftalik", "7 gun", "bir hafta", "haftaya")
  const gentleConds = s.conditions.length > 0
  if (weekly) {
    const gentle = gentleConds || s.level === "beginner" || !s.level
    const base = pickStyles({ ...s, styles: [] })
    const pool: StyleId[] = s.styles.length ? s.styles : [...(base.length ? base : ["hatha" as StyleId]), ...(gentle ? (["yin"] as StyleId[]) : (["vinyasa"] as StyleId[])), "meditation"]
    const uniq = [...new Set(pool)].filter((x) => !gentle || (x !== "vinyasa" && x !== "ashtanga"))
    const at = (i: number) => styleName(uniq[i % uniq.length])
    const mins = s.duration ?? (s.level === "beginner" || !s.level ? 20 : 30)
    const days = [
      `**Pazartesi** — ${at(0)} · ${mins} dk · haftaya sakin ve hizalı başla`,
      `**Çarşamba** — ${at(1)} · ${mins} dk`,
      `**Cuma** — ${at(2)} · ${mins} dk`,
      `**Cumartesi** — hafif bir yürüyüş ya da ${at(0)} · ${Math.max(15, mins - 10)} dk`,
      `**Pazar** — 10 dk nefes ve Savasana; haftayı sakince kapat`,
    ]
    const ex = buildRoutine({ minutes: 15, goals: s.goals, areas: s.areas, level: s.level ?? "beginner", conditions: s.conditions }).steps.slice(0, 3).map((x) => x.pose)
    return answer({
      intent: "plan", kind: "recommend", tools: ["find_pose"], cards: ex.map(poseCard), confidence: env.turn.cls.confidence,
      text: `${s.level === "beginner" || !s.level ? "Yeni başlayan biri için" : "Sana"} dengeli bir **haftalık program**:\n${days.join("\n")}\n\nSalı ve Perşembe dinlenme günleri; ağrı ya da yorgunluk varsa bir seansı atla.${gentleConds ? `\n\n🌿 ${conditionNotes(s, 1)[0]}` : ""}\n\nİstersen herhangi bir günün pratiğini adım adım hazırlayayım.`,
      links: withJoin(env, [{ label: "Eğitmenler", href: "/teachers" }, { label: "Atölyeler", href: "/atolyeler" }]), suggestions: ["Pazartesi pratiğini hazırla", "10 dakikalık rutin hazırla", "Bana eğitmen öner"],
    })
  }
  const minutes = s.duration ?? 15
  const r = buildRoutine({ minutes, goals: s.goals, areas: s.areas, level: s.level, conditions: s.conditions, styles: s.styles })
  const about = aboutPhrase(s)
  const lines = r.steps.map((st, i) => `${i + 1}. **${st.pose.name}** — ${st.minutes >= 1 ? `${st.minutes} dk` : "30 sn"}${/nefes/.test(st.pose.hold) ? ` (${st.pose.hold.replace(/\(.*\)/, "").trim()})` : ""}`)
  return answer({
    intent: "plan", kind: "recommend", tools: ["find_pose"], cards: r.steps.slice(0, 4).map((x) => poseCard(x.pose)), confidence: env.turn.cls.confidence,
    text: `${about ? `${sentenceCase(about)} ` : ""}yaklaşık **${r.total} dakikalık** bir rutin hazırladım${s.level ? ` (${LEVEL_LABEL[s.level]} seviye)` : ""}:\n\n${r.opening}\n\n${lines.join("\n")}\n\n${r.closing}${s.conditions.length ? `\n\n🌿 ${conditionNotes(s, 1)[0]}` : ""}`,
    links: [{ label: "Pozların anlatımları", href: "/pozlar" }], suggestions: ["Daha kısa olsun", "Daha uzun bir rutin", "Haftalık program hazırla", `${r.steps[1]?.pose.name ?? "Pozu"} nasıl yapılır?`].slice(0, 4),
  })
}

// ───────────────────────── advice (the blend) ─────────────────────────

const SMALLTALK = new Set(["how_are_you", "who_are_you", "what_can_you_do", "age", "where_from", "morning", "night", "bye", "yes_ok", "no", "joke", "more_joke", "bored", "sad", "happy", "thanks_ai", "insult", "love", "weather", "time", "out_of_scope"])

/** The knowledge-base entry that best fits the need: concept retrieval first, the phrase matcher second. */
function adviceEntry(env: Env) {
  const top = retrieve(env.turn.doc, 4).find((h) => h.kind === "kb" && !SMALLTALK.has(h.id))
  if (top && top.score >= 6 && top.coverage >= 0.4) return knowledgeById(top.id)
  const kb = matchKnowledge(env.turn.doc.raw)
  return kb && kb.score >= 3 && !SMALLTALK.has(kb.entry.id) ? kb.entry : undefined
}

export async function recommend(env: Env): Promise<Answer> {
  const s = env.turn.slots
  if (!s.styles.length && !s.areas.length && !s.goals.length && !s.conditions.length && !s.level) {
    return answer({
      intent: "recommend", kind: "recommend", confidence: 0.4, rate: false,
      text: v(env, ["Sana en uygun stili bulmak için iki şeyi bilmem yeter: **seviyen** (yeni mi başlıyorsun?) ve **hedefin** (esneklik, güç, stres, uyku, ağrı…). Ne dersin?", "Seve seve! Önce kısaca tanıyayım: yogaya yeni mi başlıyorsun, ve en çok neyi istiyorsun: rahatlamak, esnemek, güçlenmek, uyumak, bir ağrıyı hafifletmek?"]),
      suggestions: ["Yeni başlıyorum, stres atmak istiyorum", "Güçlenmek ve form tutmak istiyorum", "Esnemek istiyorum", "Bel ağrım var"],
    })
  }
  const styles = pickStyles(s)
  const about = aboutPhrase(s)
  const kbEntry = adviceEntry(env)

  const [tr, ws] = await Promise.all([
    env.tool("search_teachers", { styles, max_price_usd: s.price?.free ? 0 : s.price?.maxUsd, sort: s.price?.cheap ? "price" : undefined, limit: 3 }),
    env.tool("search_workshops", { category: styles[0] ? STYLE_BY_SLUG[STYLE_SLUG[styles[0]]]?.category : undefined, limit: 2 }),
  ])
  const poses = suggestPoses({ areas: s.areas, goals: s.goals, level: s.level, conditions: s.conditions, styles }, 2)
  const rows: any[] = tr.result.teachers ?? []
  const wrows: any[] = ws.result.workshops ?? []

  const lead = s.areas.length ? v(env, AREA_LEAD[s.areas[0]]) : s.goals.length ? v(env, GOAL_LEAD[s.goals[0]]) : ""
  const parts: string[] = []
  parts.push(about ? `**${sentenceCase(about)}** şunları öneririm.` : "Sana şunları önerebilirim.")
  parts.push(kbEntry ? kbEntry.answer.replace(/\n\n_Bu bilgi genel amaçlıdır[^_]*_/, "").trim() : lead)
  if (styles.length) parts.push(`**Uygun stiller:** ${styleNames(styles)}${s.level === "beginner" ? " (yeni başlayanlar için en nazik olanlardan başlayın)" : ""}.`)
  if (poses.length) parts.push(`**Denenecek duruşlar:** ${joinTr(poses.map((p) => `**${p.name}**`))} — kartlara dokunup adım adım anlatıma bakabilirsin.`)
  const cond = conditionNotes(s, 2)
  if (cond.length) parts.push(cond.map((c) => `🌿 ${c}`).join("\n"))
  if (rows.length) {
    const best = [...rows].sort((a, b) => b.rating - a.rating)[0]
    parts.push(`Birebir destek istersen **${best.name}** (★ ${best.rating}, ${usd(best.price_usd_per_hour)}/saat) ve diğer eğitmenlere göz at; ilk deneme dersi yarı fiyat.`)
  }
  if (wrows.length) parts.push(`Yaklaşan atölye: **${wrows[0].title}**${wrows[0].mode === "canlı" ? ` (${wrows[0].starts_at.replace(/ \d{4}/, "")})` : ""}.`)
  parts.push("_Bu bilgiler genel amaçlıdır, tıbbi tavsiye yerine geçmez; ağrı sürerse doktoruna danış._")

  const cards: AiCard[] = [...poses.map(poseCard), ...(tr.cards ?? []).slice(0, 2), ...(ws.cards ?? []).slice(0, 1)]
  return answer({
    intent: "recommend", kind: "recommend", tools: ["search_teachers", "search_workshops", "find_pose"], cards, matchedId: undefined, confidence: env.turn.cls.confidence,
    statuses: ["Sana uygun eğitmen, atölye ve pozlar aranıyor…"],
    text: parts.filter(Boolean).join("\n\n"),
    links: withJoin(env, [{ label: "Tüm eğitmenler", href: "/teachers" }, { label: "Pozlar", href: "/pozlar" }]),
    suggestions: ["10 dakikalık rutin hazırla", "Bana eğitmen öner", styles[0] ? `${styleName(styles[0])} nedir?` : "Yoga stilleri nelerdir?", "Haftalık program hazırla"],
  })
}

// ───────────────────────── compare ─────────────────────────

export function compare(env: Env): Answer {
  const s = env.turn.slots
  const ids = (s.styles.length >= 2 ? s.styles : [...s.styles, ...pickStyles(s)]).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3)
  const infos = ids.map((id) => STYLE_BY_SLUG[STYLE_SLUG[id]]).filter(Boolean)
  const rows = infos.map((i) => `- **${i.name}** — ${i.pace}; yoğunluk ${"●".repeat(i.intensity)}${"○".repeat(5 - i.intensity)}; seviye ${i.level}; ${i.duration}. ${i.benefits[0]}.`)
  // a recommendation from what the person said
  let verdict = ""
  const want = s.goals[0]
  if (want && infos.length >= 2) {
    const fit = ids.find((id) => GOAL_STYLES[want].includes(id))
    if (fit) verdict = `**${GOAL_LABEL[want]}** hedefin için ${styleName(fit)} daha uygun.`
  }
  if (!verdict && infos.length >= 2) {
    const [a, b] = [...infos].sort((x, y) => x.intensity - y.intensity)
    verdict = s.level === "beginner" || !s.level ? `Yeni başlıyorsan ya da sakin bir tempo istiyorsan **${a.name}**, daha dinamik ve güçlü bir şey istiyorsan **${b.name}** seç.` : `Daha sakin için **${a.name}**, daha yoğun için **${b.name}**.`
  }
  return answer({
    intent: "compare", kind: "knowledge", tools: [], confidence: env.turn.cls.confidence,
    text: `${infos.length >= 2 ? "Kısaca karşılaştırayım:" : "Bu stili anlatayım:"}\n${rows.join("\n")}${verdict ? `\n\n${verdict}` : ""}`,
    links: infos.slice(0, 3).map((i) => ({ label: `${i.name} nedir?`, href: `/yoga-stilleri/${i.slug}` })),
    suggestions: ["Bana eğitmen öner", "Atölyeleri göster", ...(infos[0] ? [`${infos[0].name} eğitmenleri`] : [])].slice(0, 4),
  })
}

// ───────────────────────── knowledge ─────────────────────────

const STYLE_FROM_ENTRY: Record<string, StyleId> = { hatha: "hatha", vinyasa: "vinyasa", yin: "yin", ashtanga: "ashtanga", restorative: "restorative", yoga_nidra: "meditation" }

/** Answer from the built-in knowledge base (or a hit the retrieval layer found). */
export async function knowledge(env: Env, entryId: string, hedge?: string): Promise<Answer | null> {
  const e = knowledgeById(entryId) ?? KNOWLEDGE.find((x) => x.id === entryId)
  if (!e) return null
  const styleId = STYLE_FROM_ENTRY[e.id] ?? e.teachersFor?.[0]
  const cards: AiCard[] = []
  let tools: string[] = []
  let text = e.answer
  const links = [...(e.links ?? [])]
  if (e.teachersFor?.length) {
    const r = await env.tool("search_teachers", { styles: e.teachersFor, limit: 3 })
    cards.push(...(r.cards ?? []))
    tools = ["search_teachers"]
    if (cards.length) { text += "\n\nSana uygun eğitmenler:"; links.push({ label: "Tüm eğitmenler", href: "/teachers" }) }
  }
  if (e.id.startsWith("pose_")) {
    const hit = retrieve(env.turn.doc, 4).find((h) => h.kind === "pose")
    if (hit && POSE_BY_SLUG[hit.id]) { cards.push(poseCard(POSE_BY_SLUG[hit.id])); links.push({ label: `${POSE_BY_SLUG[hit.id].name} sayfası`, href: `/pozlar/${hit.id}` }) }
  }
  if (styleId) {
    const slug = STYLE_SLUG[styleId]
    if (STYLE_BY_SLUG[slug] && !links.some((l) => l.href.startsWith("/yoga-stilleri"))) links.push({ label: `${STYLE_BY_SLUG[slug].name} hakkında`, href: `/yoga-stilleri/${slug}` })
  }
  if (!cards.length && !env.signedIn && e.teachersFor?.length) links.push(JOIN)
  return answer({
    intent: "knowledge", kind: "knowledge", tools, cards, links: links.slice(0, 4), suggestions: e.next ?? [], text: hedge ? `${hedge}\n\n${text}` : text,
    confidence: env.turn.cls.confidence, rate: !["how_are_you", "who_are_you", "age", "where_from", "morning", "night", "bye", "yes_ok", "no", "thanks_ai", "en_thanks", "en_bye", "love"].includes(e.id) && !e.shortOnly,
  })
}

/** The wish is clear but the subject is not: ask, with the usual answers one tap away. */
export function clarify(env: Env): Answer {
  return answer({
    intent: "unknown", kind: "navigation", confidence: 0.3, rate: false,
    text: v(env, ["Memnuniyetle! Ne tür bir şey arıyorsun? Bir eğitmen, atölye, yazı ya da podcast mı; yoksa belirli bir derdine (bel ağrısı, stres, uyku…) uygun bir pratik mi?", "Elbette, biraz daha anlatır mısın? Eğitmen, atölye, içerik ya da bir poz/rutin mi istiyorsun? Bir derdin ya da hedefin varsa (uyku, stres, esneklik…) onu da yaz."]),
    suggestions: ["Bana eğitmen öner", "Atölyeleri göster", "Bir yazı öner", "10 dakikalık rutin hazırla"],
  })
}

/** Nothing matched firmly: offer the closest topics instead of giving up. */
export function didYouMean(env: Env, hits: Hit[]): Answer {
  const titles = hits.filter((h) => h.kind === "kb").map((h) => knowledgeById(h.id)).filter((e): e is NonNullable<typeof e> => !!e).map(entryTitle)
  const poseHit = hits.find((h) => h.kind === "pose")
  const chips = [...titles.slice(0, 2), ...(poseHit && POSE_BY_SLUG[poseHit.id] ? [`${POSE_BY_SLUG[poseHit.id].name} nasıl yapılır?`] : [])].slice(0, 3)
  return answer({
    intent: "unknown", kind: "unknown", learning: true, confidence: 0.2, rate: true,
    text: chips.length
      ? `Tam anlayamadım ama şunlardan birini mi soruyorsun? Aşağıdan seçebilir ya da sorunu biraz daha açık yazabilirsin. Soruyu ekibime de ilettim; cevabı geliştirecekler.`
      : "Bunu henüz bilmiyorum ama **öğreneceğim**: sorunu ekibime ilettim, cevap eklendiğinde bir dahaki sefere yanıtlayabileceğim. Şimdi yardıma ihtiyacın varsa **canlı destek** yazman yeterli; ya da yoga, nefes, meditasyon ve AYA (eğitmenler, atölyeler, ödeme, kayıtlar) hakkında farklı bir soru sorabilirsin.",
    links: [{ label: "Eğitmenler", href: "/teachers" }, { label: "Atölyeler", href: "/atolyeler" }, { label: "Canlı yayınlar", href: "/live" }],
    suggestions: chips.length ? [...chips, "Canlı destekle konuş"].slice(0, 4) : DEFAULT_SUGGESTIONS,
  })
}

/** Static navigation answers (membership, prices, recordings…) reuse the reviewed texts of the rule engine. */
export function navigation(env: Env, intent: BrainIntent): Answer | null {
  const map: Partial<Record<BrainIntent, Parameters<typeof composeNavigation>[2]>> = {
    pricing: "pricing", booking: "booking", become_teacher: "become_teacher", recordings: "recordings", payouts: "payouts", report: "report", account: "account", terms: "terms",
  }
  const gi = map[intent]
  if (!gi) return null
  const data: GuideData = { teachers: [], workshops: [], live: [], articles: [], signedIn: env.signedIn, role: env.role }
  const g = composeNavigation(env.turn.doc.raw, data, gi)
  return answer({ intent, kind: "navigation", text: g.reply, links: g.links, suggestions: NAV_CHIPS[intent] ?? [], confidence: env.turn.cls.confidence })
}

const NAV_CHIPS: Partial<Record<BrainIntent, string[]>> = {
  pricing: ["Deneme dersi nedir?", "Ödeme yöntemleri neler?", "Bana eğitmen öner"],
  booking: ["Deneme dersi nedir?", "Bana eğitmen öner", "Ders iptal edilebilir mi?"],
  become_teacher: ["Komisyon oranı nedir?", "Başvuru nasıl onaylanır?", "Ödeme talebi nasıl yapılır?"],
  recordings: ["Ders kaydı kaç gün durur?", "Derse nasıl katılırım?"],
  payouts: ["Komisyon oranı nedir?"],
  report: ["Canlı destekle konuş", "Topluluk kuralları neler?"],
  account: ["Şifremi unuttum", "Hesabımı nasıl silerim?"],
  terms: ["Kişisel verilerim nasıl korunuyor?"],
}

export { STYLES, STYLE_LABEL_TR, CONDITION_LABEL, poseConflicts }
