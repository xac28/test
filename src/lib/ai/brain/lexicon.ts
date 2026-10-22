/**
 * What the words in a message are about: body areas, goals, health conditions, levels, times, prices.
 * Every concept lists the words that signal it (folded ASCII). `exact` words must match the whole word,
 * `prefix` words match any inflection ("uyku" → "uykusuzluk", "uykum") and tolerate one typo from 5 letters.
 */
import { Doc, editDistance } from "./nlp"

export interface ConceptSpec {
  exact?: string[]
  prefix?: string[]
  /** multi-word signals, searched in the folded text */
  phrase?: string[]
}

export type Area = "back_low" | "back" | "neck" | "shoulder" | "hip" | "knee" | "wrist" | "foot" | "head" | "belly" | "eyes" | "legs" | "chest"
export type Goal = "sleep" | "stress" | "energy" | "flexibility" | "strength" | "balance" | "weight" | "focus" | "relax" | "posture" | "pregnancy" | "seniors" | "kids" | "breath" | "pain" | "mood" | "digestion"
export type Condition = "pregnancy" | "knee" | "wrist" | "neck" | "back" | "pressure" | "heart" | "injury" | "shoulder" | "osteoporosis" | "glaucoma" | "period" | "surgery"

export const AREAS: Record<Area, ConceptSpec> = {
  back_low: { exact: ["bel", "belim", "belimde", "belime", "belimi", "beli", "belin", "belinde", "belden", "belimden", "lumbar", "lombar", "belde", "belini", "belinin"], phrase: ["alt sirt", "bel fitigi", "bel agrisi", "bel tutulmasi"] },
  back: { prefix: ["sirt", "omurga", "kambur", "torasik"], phrase: ["ust sirt", "sirt agrisi"] },
  neck: { prefix: ["boyun", "boyn", "ense", "servikal"], phrase: ["boyun agrisi"] },
  shoulder: { prefix: ["omuz", "omz", "kurek"] },
  hip: { prefix: ["kalca", "piriformis"], exact: ["siyatik", "gluteal"], phrase: ["kalca agrisi"] },
  knee: { exact: ["diz", "dizim", "dizimde", "dizime", "dizimi", "dizin", "dizler", "dizlerim", "dizlerimde", "dizlerimi", "dizde", "dizinde", "dizlerin", "menisküs", "menisus", "menisk"], prefix: ["menisk"] },
  wrist: { prefix: ["bilek", "bileg", "karpal"], phrase: ["el bilegi"] },
  foot: { prefix: ["topuk", "tabanim"], exact: ["ayak", "ayagim", "ayaklarim", "ayaklar", "ayagimda", "plantar"] },
  head: { prefix: ["migren", "basagri", "baslari"], phrase: ["bas agrisi", "bas agrim", "basim agriyor"] },
  belly: { prefix: ["karin", "karn", "gobek", "mide", "bagirsak", "sindirim", "siskin", "kabiz", "gaz sanci"], phrase: ["karin agrisi"] },
  eyes: { exact: ["goz", "gozum", "gozlerim", "gozler", "gozlerimde", "gozumde"], prefix: ["gozluk"] },
  legs: { prefix: ["bacak", "bacag", "baldir", "kramp", "uyusma"], phrase: ["bacak agrisi"] },
  chest: { prefix: ["gogus", "gogsum", "gogsunde"], exact: ["gogsum"] },
}

export const GOALS: Record<Goal, ConceptSpec> = {
  sleep: { prefix: ["uyku", "uyuy", "uyuya", "insomn", "uykusuz", "yatamiyorum", "rahat uyu"], phrase: ["uyuyamiyorum", "uyuyamam", "gece uyan", "uykum gelmiyor", "uyku sorunu", "uyku duzeni"] },
  stress: { prefix: ["stres", "gergin", "kaygi", "anksiyete", "anxiety", "panik", "endise", "bunal", "sinirli", "ofke", "asiri dusun", "burnout", "yipran", "tukenmis", "tukenmislik"], exact: ["gerginim", "stresliyim", "bunaldim"] },
  energy: { prefix: ["enerji", "yorgun", "halsiz", "durgun", "uyusuk", "dinc", "zinde", "canlan", "motivasyon", "enerjik", "uyanik", "canlilik"], phrase: ["gucsuz hissediyorum"] },
  flexibility: { prefix: ["esnek", "esnem", "esnet", "tutuk", "katilas", "kasilmis", "gerilmek", "gerilme", "stretch", "flexib", "sertlik"], phrase: ["parmak ucuma", "yere dokun"] },
  strength: { prefix: ["guclen", "gucle", "guclu", "kas ", "kaslar", "kas gucu", "kuvvet", "sikilas", "tonlan", "strength", "dayanikli", "core", "pilates"], exact: ["guc", "kas", "kasim", "kaslarim"] },
  balance: { prefix: ["denge", "dengel", "balance"] },
  weight: { prefix: ["kilo", "zayifl", "incel", "kalori", "metabol", "kardiyo"], exact: ["fit", "yag", "form", "forma", "formda", "formum", "terle", "terlemek"], phrase: ["kilo ver", "forma gir", "yag yak"] },
  focus: { prefix: ["odak", "konsantr", "zihin", "mindful", "farkindalik", "verimlilik"], phrase: ["dikkatim dagil", "dikkatimi topla", "dikkat eksik", "ders calis", "dikkat daginik"] },
  relax: { exact: ["rahat"], prefix: ["sakin", "huzur", "gevse", "dinlen", "rahatla", "relax", "dinginles"], phrase: ["kafam rahatlasin", "kafami bosalt"] },
  posture: { prefix: ["durus", "durusum", "kambur", "durus bozuk", "postur", "durus"], phrase: ["durus bozuklugu", "masa basi", "masa basinda", "bilgisayar basinda", "ofis"] },
  pregnancy: { prefix: ["hamile", "gebe", "gebelik", "lohusa", "emzir", "dogum", "prenatal", "postnatal", "bebek bekl"], exact: ["hamilelik"] },
  seniors: { prefix: ["yasli", "emekli", "buyuk anne", "buyukanne", "buyukbaba", "buyuk baba", "annem", "babam", "yaslanma", "ileri yas", "60 yas", "70 yas"] },
  kids: { prefix: ["cocug", "cocuk", "bebe", "cocuklar", "ogrenci cocuk", "kizim", "oglum", "minik"] },
  breath: { prefix: ["nefes", "pranayama", "soluk", "nefes al", "breath", "hiperventil"] },
  pain: { prefix: ["agri", "sizl", "sanci", "zonkl", "tutulma", "yaralan", "sakat", "burkul", "kramp", "fitik", "pain", "ache"], exact: ["hurt", "hurts"], phrase: ["agri cekiyorum"] },
  mood: { prefix: ["depresyon", "mutsuz", "uzgun", "moral", "huzursuz", "yalniz", "keyifsiz", "umutsuz"], exact: ["sikildim", "sikiliyorum"], phrase: ["canim sikiliyor"] },
  digestion: { prefix: ["sindirim", "kabiz", "hazim", "siskin", "reflu", "bagirsak"] },
}

export const CONDITIONS: Record<Condition, ConceptSpec> = {
  pregnancy: GOALS.pregnancy,
  knee: AREAS.knee,
  wrist: AREAS.wrist,
  neck: { prefix: ["boyun fitig", "servikal", "boyun dis"], phrase: ["boyun fitigi", "boyun duzlesmesi"] },
  back: { prefix: ["skolyoz", "lordoz", "kifoz", "disk", "bel fitigi", "omurga kaymas"], phrase: ["bel fitigi", "disk kaymasi", "bel kaymasi", "siyatik"], exact: ["fitik", "fitigim", "siyatik"] },
  pressure: { prefix: ["tansiyon", "hipertansiyon", "hipotansiyon"], phrase: ["yuksek tansiyon", "dusuk tansiyon"] },
  heart: { prefix: ["kalp", "kardiyak", "aritmi", "bypass", "stent"], phrase: ["kalp hastalig", "kalp rahatsiz"] },
  injury: { prefix: ["sakatl", "yaralan", "burkul", "kirik", "cikik", "yirtik", "tendon", "bag yarasi"], phrase: ["kas yirtigi", "bag yirtigi"] },
  shoulder: { prefix: ["omuz sikis", "omuz cikig", "donuk omuz"], phrase: ["donuk omuz", "omuz sikismasi"] },
  osteoporosis: { prefix: ["osteopor", "kemik erim"] },
  glaucoma: { prefix: ["glokom", "goz tansiyon", "retina"] },
  period: { prefix: ["adet", "regl", "menstr", "mensturasyon"] },
  surgery: { prefix: ["ameliyat", "operasyon", "cerrahi", "sezaryen", "protez"] },
}

function matchSpec(doc: Doc, spec: ConceptSpec): boolean {
  const padded = ` ${doc.norm} `
  if (spec.phrase?.some((p) => padded.includes(` ${p}`) || padded.includes(p))) return true
  if (spec.prefix?.some((p) => p.trim().includes(" ") && padded.includes(` ${p.trim()}`))) return true
  for (const w of doc.words) {
    if (spec.exact?.includes(w)) return true
    if (spec.prefix) {
      for (const p of spec.prefix) {
        const pk = p.trim()
        if (!pk || pk.includes(" ")) continue
        // a prefix with a trailing space must be a whole word ("kas " ≠ "kasim")
        if (p.endsWith(" ")) { if (w === pk) return true; continue }
        if (w.startsWith(pk) && (pk.length >= 4 || w.length <= pk.length + 4)) return true
        if (pk.length >= 7 && w[0] === pk[0] && w.length >= pk.length - 1 && editDistance(w.slice(0, pk.length), pk, 1) <= 1) return true
      }
    }
  }
  return false
}

export function detect<K extends string>(doc: Doc, table: Record<K, ConceptSpec>): K[] {
  const out: K[] = []
  for (const k of Object.keys(table) as K[]) if (matchSpec(doc, table[k])) out.push(k)
  return out
}

export type Level = "beginner" | "intermediate" | "advanced"

export function detectLevel(doc: Doc): Level | undefined {
  if (doc.has("yeni basliyorum", "yeni basladim", "yeni baslayan", "yeni baslayanlar", "ilk kez", "hic yapmadim", "hic yoga yapmadim", "acemi", "baslangic", "sifirdan", "hic bilmiyorum", "beginner", "ilk defa", "yeniyim", "denememis")) return "beginner"
  if (doc.has("ileri seviye", "ileri duzey", "ileri", "advanced", "deneyimli", "usta", "yillardir yapiyorum", "uzman")) return "advanced"
  if (doc.has("orta seviye", "orta duzey", "orta", "intermediate", "biraz biliyorum", "arada yapiyorum")) return "intermediate"
  return undefined
}

export type TimeHint = { day?: "today" | "tomorrow" | "weekend" | "week" | "nextweek"; part?: "morning" | "noon" | "evening"; weekday?: number }

const WEEKDAYS: [number, string[]][] = [
  [1, ["pazartesi", "pzt"]], [2, ["sali"]], [3, ["carsamba", "crs"]], [4, ["persembe", "prs"]], [5, ["cuma"]], [6, ["cumartesi", "cmt"]], [0, ["pazar"]],
]

export function detectTime(doc: Doc): TimeHint | undefined {
  const t: TimeHint = {}
  if (doc.rx(/\b(bugun|bu gun|simdi|su an|az sonra|bu aksam)\b/) || doc.has("today")) t.day = "today"
  if (doc.rx(/\b(yarin|ertesi gun)\b/) || doc.has("tomorrow")) t.day = "tomorrow"
  if (doc.rx(/\b(hafta sonu|haftasonu|hafta sonlari|cumartesi pazar)\b/) || doc.has("weekend")) t.day = "weekend"
  if (doc.rx(/\bbu hafta\b/) || doc.has("this week")) t.day ??= "week"
  if (doc.rx(/\b(gelecek hafta|haftaya|onumuzdeki hafta|haftaya kadar)\b/) || doc.has("next week")) t.day = "nextweek"
  if (doc.has("sabah", "sabahlari", "erken", "morning", "gunaydin")) t.part = "morning"
  if (doc.has("ogle", "ogleden", "ogle arasi", "noon")) t.part = "noon"
  if (doc.has("aksam", "aksamlari", "gece", "is cikisi", "evening", "ogleden sonra")) t.part = "evening"
  for (const [n, names] of WEEKDAYS) {
    // whole word with a case suffix ("pazartesi", "cumaya", "salida"): "pazar" must not match "pazartesi"
    const re = new RegExp(`^(${names.join("|")})(ye|ya|de|da|den|dan|nin|si|yi|ki|ler)?$`)
    if (doc.words.some((w) => re.test(w))) t.weekday = n
  }
  return t.day || t.part || t.weekday !== undefined ? t : undefined
}

export interface PriceHint { maxUsd?: number; maxTl?: number; cheap?: boolean; free?: boolean; premium?: boolean }

export function detectPrice(doc: Doc): PriceHint | undefined {
  const p: PriceHint = {}
  if (doc.has("ucuz", "uygun fiyat", "uygun fiyatli", "butce", "ekonomik", "cheap", "budget", "affordable", "pahali olmayan", "en ucuz", "daha ucuz")) p.cheap = true
  if (doc.has("ucretsiz", "bedava", "free", "para vermeden", "parasiz")) p.free = true
  if (doc.has("en iyi", "premium", "en kaliteli", "lux", "pahali olsun")) p.premium = true
  // "50 dolar altı", "$40'a kadar", "500 liraya kadar"
  const m = /(\d{1,5})(?:[.,]\d+)?\s*(dolar|usd|lira|tl)?(?:\s*(?:alti|altinda|altina|kadar|den az|dan az|ya kadar|e kadar|a kadar|geçmesin|gecmesin|ustu degil|max|maksimum|butcem|butce))?/g
  let best: { n: number; unit?: string; limited: boolean } | undefined
  for (const mm of doc.norm.matchAll(m)) {
    const n = Number(mm[1])
    const unit = mm[2]
    const limited = /alti|altinda|kadar|den az|dan az|gecmesin|max|butce/.test(mm[0])
    if (!n || (!unit && !limited)) continue
    if (!unit && n < 5) continue // "3 eğitmen" is not a price
    if (!best || limited) best = { n, unit, limited }
  }
  if (best) {
    if (best.unit === "lira" || best.unit === "tl") p.maxTl = best.n
    else if (best.unit === "dolar" || best.unit === "usd") p.maxUsd = best.n
    else p.maxUsd = best.n // a bare limit ("50'nin altı") is most often a lesson price
  }
  return p.cheap || p.free || p.premium || p.maxUsd || p.maxTl ? p : undefined
}

export const CONDITION_LABEL: Record<Condition, string> = {
  pregnancy: "hamilelik", knee: "diz", wrist: "bilek", neck: "boyun", back: "bel/sırt", pressure: "tansiyon", heart: "kalp", injury: "sakatlık", shoulder: "omuz",
  osteoporosis: "kemik erimesi", glaucoma: "göz tansiyonu", period: "adet dönemi", surgery: "ameliyat sonrası",
}

export const AREA_LABEL: Record<Area, string> = {
  back_low: "bel", back: "sırt", neck: "boyun", shoulder: "omuz", hip: "kalça", knee: "diz", wrist: "bilek", foot: "ayak", head: "baş", belly: "karın ve sindirim", eyes: "göz", legs: "bacak", chest: "göğüs",
}

export const GOAL_LABEL: Record<Goal, string> = {
  sleep: "uyku", stress: "stres ve gerginlik", energy: "enerji", flexibility: "esneklik", strength: "güç", balance: "denge", weight: "form ve kondisyon", focus: "odaklanma", relax: "gevşeme",
  posture: "duruş", pregnancy: "hamilelik", seniors: "ileri yaş", kids: "çocuklar", breath: "nefes", pain: "ağrı", mood: "ruh hali", digestion: "sindirim",
}
