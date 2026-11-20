/**
 * Slot filling: the concrete things a message mentions (a style, a body area, a goal, a level, a price, a day, a pose,
 * an order code…). The dialogue layer merges the slots of a whole conversation, so "peki ya daha ucuzu?" still knows
 * it is about yin teachers.
 */
import { POSES, YogaPose } from "@/lib/yoga-poses"
import { SHOP_SLUGS } from "@/lib/shop"
import { StyleId } from "@/lib/ai-guide"
import { Doc, parse, stem, wordEq } from "./nlp"
import { AREAS, Area, CONDITIONS, Condition, GOALS, Goal, Level, PriceHint, TimeHint, detect, detectLevel, detectPrice, detectTime } from "./lexicon"

export type PoseFacet = "steps" | "benefits" | "avoid" | "easier" | "harder" | "breath" | "hold" | "counter" | "level" | "overview"

export interface Slots {
  styles: StyleId[]
  areas: Area[]
  goals: Goal[]
  conditions: Condition[]
  level?: Level
  time?: TimeHint
  price?: PriceHint
  mode?: "LIVE" | "RECORDED"
  /** minutes ("10 dakikalık rutin") */
  duration?: number
  poseSlug?: string
  poseFacet?: PoseFacet
  productCategory?: string
  productQuery?: string
  orderCode?: string
  email?: string
  /** a free-text subject (article/podcast search) */
  topic?: string
}

export const emptySlots = (): Slots => ({ styles: [], areas: [], goals: [], conditions: [] })

const STYLE_WORDS: Record<StyleId, string[]> = {
  hatha: ["hatha", "hata yoga"],
  vinyasa: ["vinyasa", "vinyasa flow", "flow yoga", "akis yoga", "power yoga"],
  yin: ["yin", "yin yoga"],
  meditation: ["meditasyon", "meditation", "mindfulness", "yoga nidra", "nidra", "nefes calismasi", "pranayama"],
  ashtanga: ["ashtanga", "astanga", "ashtanga yoga"],
  restorative: ["restoratif", "restorative", "onarici yoga", "destekli yoga"],
}

export function detectStyleNames(doc: Doc): StyleId[] {
  const out: StyleId[] = []
  for (const [id, words] of Object.entries(STYLE_WORDS) as [StyleId, string[]][]) {
    if (words.some((w) => (w.includes(" ") ? doc.has(w) : doc.words.some((x) => x === w || (w.length >= 5 && wordEq(x, w)))))) out.push(id)
  }
  return out
}

const GENERIC_POSE_WORDS = new Set(["durusu", "pozu", "poz", "durus", "selam", "pose", "yoga", "asana", "i", "ii", "iii", "s"])
/** Everyday words that also occur in pose names: never enough on their own. */
const COMMON_WORDS = new Set(["kolay", "zor", "derin", "hali", "uzun", "kisa", "dag", "easy", "pose", "facing", "standing", "upward", "downward"])
const POSE_CUES = ["poz", "pozu", "durus", "duruş", "asana", "yapilir", "yapilis", "yapiyorum", "nasil yapilir", "yoga"]

interface PoseKey { pose: YogaPose; names: string[][] }
let POSE_KEYS: PoseKey[] | null = null
function poseKeys(): PoseKey[] {
  if (POSE_KEYS) return POSE_KEYS
  POSE_KEYS = POSES.map((pose) => ({
    pose,
    // each of the Turkish, English and Sanskrit names is a way to say the pose
    names: [pose.name, pose.english, pose.sanskrit]
      .map((n) => [...new Set(parse(n.toLocaleLowerCase("tr-TR")).words.filter((w) => !GENERIC_POSE_WORDS.has(w) && w.length >= 3))])
      .filter((t) => t.length),
  }))
  return POSE_KEYS
}

const NUM_WORD: Record<string, number> = { "1": 1, bir: 1, i: 1, "2": 2, iki: 2, ii: 2, "3": 3, uc: 3, iii: 3 }

/** The library pose a message is about (by Turkish, English or Sanskrit name). */
export function detectPose(doc: Doc): YogaPose | undefined {
  const cue = doc.has(...POSE_CUES)
  const mentions = new Set(doc.words.map((w) => NUM_WORD[w]).filter(Boolean))
  let best: { pose: YogaPose; score: number } | undefined
  for (const { pose, names } of poseKeys()) {
    let score = 0
    let single = false
    for (const tokens of names) {
      const hit = tokens.filter((t) => doc.words.some((w) => wordEq(w, t)))
      const distinctive = hit.some((t) => t.length >= 5 && !COMMON_WORDS.has(t))
      // every word of the name, or one telling word of it ("köpek", "savaşçı")
      const sc = hit.length === tokens.length ? 1 : distinctive ? Math.max(0.5, hit.length / tokens.length) : 0
      if (sc > score) { score = sc; single = tokens.length === 1 }
    }
    if (score <= 0) continue
    // "savaşçı 2" vs "savaşçı 1": the numeral decides
    const roman = /\b(I{1,3})\b/.exec(pose.name)
    if (roman && mentions.size) score += mentions.has(roman[1].length) ? 0.5 : -0.5
    // one-word names ("deve", "tekne") need a yoga cue or an almost bare message
    if (single && !cue && doc.content.length > 3) score -= 0.6
    if (score > 0.45 && (!best || score > best.score)) best = { pose, score }
  }
  return best?.pose
}

const FACETS: [PoseFacet, string[]][] = [
  ["steps", ["nasil yapilir", "nasil yapilis", "nasil yapiyorum", "nasil yapayim", "yapilisi", "adim adim", "tarif", "nasil girilir", "nasil girerim", "how to"]],
  ["easier", ["daha kolay", "kolaylastir", "kolay hali", "zorlaniyorum", "yapamiyorum", "basit hali", "kolaylastirma", "modifikasyon", "easier"]],
  ["harder", ["daha zor", "zorlastir", "ileri hali", "bir ust seviye", "harder"]],
  ["avoid", ["kimler yapmamali", "yapmamam gereken", "kacinmam", "kacinilmasi", "dikkat etmem", "zararli", "riskli", "tehlikeli", "kontrendikasyon", "yapmamali", "yapilmaz", "kimler yapamaz"]],
  ["benefits", ["fayda", "faydasi", "faydalari", "ne ise yarar", "ne icin yapilir", "ne yarar", "ise yarar", "etkisi", "neye iyi gelir"]],
  ["hold", ["kac nefes", "ne kadar sure", "kac saniye", "kac dakika", "ne kadar kal", "sure"]],
  ["breath", ["nefes", "nasil nefes"]],
  ["counter", ["karsi poz", "ardindan", "sonra ne yapayim", "dengelemek", "hangi poz"]],
  ["level", ["seviye", "baslangic icin mi", "zor mu", "kolay mi"]],
]
export function detectFacet(doc: Doc): PoseFacet | undefined {
  for (const [f, phrases] of FACETS) if (doc.has(...phrases)) return f
  return undefined
}

export function detectProductCategory(doc: Doc): string | undefined {
  if (doc.has("mat", "yoga mati", "kaymaz mat", "yoga mat", "paspas")) return SHOP_SLUGS.includes("matlar") ? "matlar" : undefined
  if (doc.has("aromaterapi", "esansiyel yag", "tutsu", "koku", "mum", "uc yag", "yag", "incense", "aroma")) return SHOP_SLUGS.includes("aromaterapi") ? "aromaterapi" : undefined
  if (doc.has("yastik", "bolster", "blok", "kemer", "battaniye", "gozluk", "goz yastigi", "wellness", "uyku maskesi", "cay")) return SHOP_SLUGS.includes("wellness") ? "wellness" : undefined
  return undefined
}

export function detectOrderCode(raw: string): string | undefined {
  const m = /\bAYA[-\s]?([A-Z0-9]{6})\b/i.exec(raw)
  return m ? `AYA-${m[1].toUpperCase()}` : undefined
}
export function detectEmail(raw: string): string | undefined {
  const m = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(raw)
  return m ? m[0].toLowerCase() : undefined
}

export function detectDuration(doc: Doc): number | undefined {
  const m = /(\d{1,3})\s*(?:dakika|dk|min)/.exec(doc.norm) ?? /(\d{1,3})\s*(?:saat)/.exec(doc.norm)
  if (m) {
    const n = Number(m[1])
    const mins = /saat/.test(m[0]) ? n * 60 : n
    if (mins >= 3 && mins <= 120) return mins
  }
  if (doc.has("yarim saat")) return 30
  if (doc.has("bir saat", "1 saat")) return 60
  if (doc.has("kisa", "hizli", "mini")) return 10
  return undefined
}

export function detectMode(doc: Doc): "LIVE" | "RECORDED" | undefined {
  if (doc.has("kayitli", "kayit", "izle istedigim zaman", "istedigim zaman", "tekrar izle", "on demand", "recorded")) return "RECORDED"
  if (doc.has("canli", "gercek zamanli", "live", "online ders")) return "LIVE"
  return undefined
}

/** Everything one message says. */
export function extractSlots(raw: string, doc: Doc = parse(raw)): Slots {
  const pose = detectPose(doc)
  const productCategory = detectProductCategory(doc)
  return {
    styles: detectStyleNames(doc),
    areas: detect(doc, AREAS),
    goals: detect(doc, GOALS),
    conditions: detect(doc, CONDITIONS),
    level: detectLevel(doc),
    time: detectTime(doc),
    price: detectPrice(doc),
    mode: detectMode(doc),
    duration: detectDuration(doc),
    poseSlug: pose?.slug,
    poseFacet: detectFacet(doc),
    productCategory,
    orderCode: detectOrderCode(raw),
    email: detectEmail(raw),
  }
}

/** A message that names something of its own, rather than leaning on the earlier conversation. */
export function hasContent(s: Slots): boolean {
  return !!(s.styles.length || s.areas.length || s.goals.length || s.conditions.length || s.level || s.time || s.price || s.mode || s.duration || s.poseSlug || s.productCategory || s.orderCode || s.email)
}

export { stem }
