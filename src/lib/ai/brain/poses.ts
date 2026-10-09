/** Pose logic that needs no database: picking poses for a need, building routines, answering questions about one pose. */
import { POSES, POSE_BY_SLUG, YogaPose } from "@/lib/yoga-poses"
import { STYLE_BY_SLUG } from "@/lib/yoga-styles"
import { StyleId } from "@/lib/ai-guide"
import { Area, Condition, Goal, Level, AREA_LABEL, GOAL_LABEL } from "./lexicon"
import { parse } from "./nlp"
import { conceptTags } from "./retrieval"
import { CONDITION_WORDS, GOAL_CATEGORIES, SEQUENCE, poseLevelOk } from "./maps"
import { PoseFacet } from "./slots"
import { fold } from "./nlp"

const TAGS = new Map<string, Set<string>>()
function tagsOf(p: YogaPose): Set<string> {
  let t = TAGS.get(p.slug)
  if (!t) {
    t = new Set(conceptTags(parse(`${p.summary} ${p.benefits.join(" ")} ${p.focus.join(" ")} ${p.intro}`)))
    TAGS.set(p.slug, t)
  }
  return t
}

/** The pose's own warnings mention a condition: it should not be suggested to someone who has it. */
export function poseConflicts(p: YogaPose, conditions: Condition[]): Condition[] {
  const avoid = ` ${fold(p.avoid.join(" "))} `
  return conditions.filter((c) => CONDITION_WORDS[c].some((w) => avoid.includes(w.endsWith(" ") ? ` ${w}` : w)))
}

export interface PoseNeed { areas?: Area[]; goals?: Goal[]; level?: Level; conditions?: Condition[]; styles?: StyleId[]; exclude?: string[] }

export function suggestPoses(need: PoseNeed, limit = 3): YogaPose[] {
  const conditions = need.conditions ?? []
  const wantCats = new Set<string>((need.goals ?? []).flatMap((g) => GOAL_CATEGORIES[g] ?? []))
  const scored = POSES.filter((p) => !need.exclude?.includes(p.slug) && poseLevelOk(p, need.level) && !poseConflicts(p, conditions).length).map((p) => {
    const t = tagsOf(p)
    let score = 0
    for (const a of need.areas ?? []) if (t.has(`#a:${a}`)) score += 3
    for (const g of need.goals ?? []) if (t.has(`#g:${g}`)) score += 2
    if (wantCats.has(p.category)) score += 1
    if (need.styles?.some((s) => p.styles.includes(s === "restorative" ? "restoratif" : s === "meditation" ? "meditasyon" : s))) score += 1
    if (p.level === "Başlangıç") score += 0.3
    return { p, score }
  })
  const best = scored.filter((x) => x.score >= 1).sort((a, b) => b.score - a.score || a.p.slug.localeCompare(b.p.slug))
  return best.slice(0, limit).map((x) => x.p)
}

/** "5–10 nefes" → minutes (a breath is about 5–6 seconds). */
export function holdMinutes(hold: string): number {
  const nums = (hold.match(/\d+/g) ?? []).map(Number)
  const breaths = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 5
  const sides = /her yan|her bacak|her taraf/.test(hold) ? 2 : 1
  return Math.max(0.5, Math.round(((breaths * 5.5) / 60) * sides * 10) / 10)
}

export interface RoutineStep { pose: YogaPose; minutes: number }
export interface Routine { steps: RoutineStep[]; total: number; opening: string; closing: string }

/** A sensible sequence: warm up standing, work the need, finish low and still. */
export function buildRoutine(opts: { minutes: number; goals?: Goal[]; areas?: Area[]; level?: Level; conditions?: Condition[]; styles?: StyleId[] }): Routine {
  const minutes = Math.min(90, Math.max(5, opts.minutes))
  const conditions = opts.conditions ?? []
  const count = minutes <= 8 ? 3 : minutes <= 15 ? 5 : minutes <= 25 ? 6 : minutes <= 40 ? 8 : 10
  const ok = POSES.filter((p) => poseLevelOk(p, opts.level) && !poseConflicts(p, conditions).length)
  const gentle = (opts.goals ?? []).some((g) => ["sleep", "relax", "stress", "pain", "pregnancy", "seniors"].includes(g)) || conditions.length > 0
  const chosen = new Set<string>()
  const pushPose = (p?: YogaPose) => { if (p && !chosen.has(p.slug)) chosen.add(p.slug) }

  // 1) the need itself
  for (const p of suggestPoses({ areas: opts.areas, goals: opts.goals, level: opts.level, conditions, styles: opts.styles }, Math.ceil(count / 2))) pushPose(p)
  // 2) the opening (standing, unless the aim is to wind down) and the closing rest
  const opener = ok.find((p) => p.slug === (gentle ? "kolay-oturus" : "dag-durusu"))
  const closer = ok.find((p) => p.slug === "savasana")
  // 3) fill from the categories that fit the goal, then from the general order
  const cats = new Set<string>((opts.goals ?? []).flatMap((g) => GOAL_CATEGORIES[g] ?? SEQUENCE))
  const fill = ok.filter((p) => !chosen.has(p.slug) && (cats.size === 0 || cats.has(p.category)) && p.slug !== "savasana" && p.slug !== opener?.slug)
  for (const p of fill) { if (chosen.size >= count - 2) break; pushPose(p) }
  for (const p of ok) { if (chosen.size >= count - 2) break; if (p.slug !== "savasana" && p.slug !== opener?.slug) pushPose(p) }

  const middle = [...chosen].map((s) => POSE_BY_SLUG[s]).filter((p) => p && p.slug !== opener?.slug && p.slug !== closer?.slug)
  middle.sort((a, b) => SEQUENCE.indexOf(a.category) - SEQUENCE.indexOf(b.category))
  const ordered = [opener, ...middle, closer].filter((p): p is YogaPose => !!p)
  // spread the time: the rest pose gets a fifth, the others share the rest by their natural hold
  const base = ordered.map((p) => holdMinutes(p.hold))
  const restIdx = ordered.findIndex((p) => p.slug === "savasana")
  const reserve = restIdx >= 0 ? Math.max(1, Math.round(minutes * 0.2)) : 0
  const share = Math.max(minutes - reserve - 1, 1) // one minute of breath to open
  const sum = base.reduce((a, b, i) => (i === restIdx ? a : a + b), 0) || 1
  const steps = ordered.map((pose, i) => ({ pose, minutes: i === restIdx ? reserve : Math.max(0.5, Math.round(((base[i] / sum) * share) * 2) / 2) }))
  const total = Math.round((steps.reduce((a, s) => a + s.minutes, 0) + 1) * 2) / 2
  const aim = (opts.goals ?? []).map((g) => GOAL_LABEL[g]).concat((opts.areas ?? []).map((a) => AREA_LABEL[a]))[0]
  return {
    steps,
    total,
    opening: `Başlamadan 1 dakika: ayakta ya da oturarak gözlerini kapat, 5 uzun nefes al${aim ? ` ve niyetini söyle: “${aim} için bu pratik”` : ""}.`,
    closing: gentle ? "Bitirirken birkaç dakika sessizce yat; vücudun yaptıklarını kaydetsin." : "Bitirince su iç ve vücudundaki değişikliği fark et.",
  }
}

/** The answer to one question about one pose. */
export function poseAnswer(p: YogaPose, facet: PoseFacet | undefined, conditions: Condition[]): { text: string; chips: string[] } {
  const head = `**${p.name}** (${p.english} · ${p.sanskrit}) · ${p.level} seviye · ${p.category}`
  const warn = poseConflicts(p, conditions)
  const warnLine = warn.length ? `\n\n⚠️ Not: yazdığın duruma (${warn.join(", ")}) bu duruş uygun olmayabilir; eğitmenine ya da doktoruna danışmadan zorlama.` : ""
  const chips = ["Daha kolay hali", "Kimler yapmamalı?", "Nefesi nasıl olmalı?", "Faydaları neler?"]
  const f = facet ?? "overview"
  switch (f) {
    case "steps":
      return { text: `${head}\n\nAdım adım:\n${p.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n**Nefes:** ${p.breath}\n**Ne kadar kal:** ${p.hold}${warnLine}`, chips: ["Daha kolay hali", "Kimler yapmamalı?", "Daha zor hali"] }
    case "benefits":
      return { text: `${head}\n\nFaydaları:\n${p.benefits.map((b) => `- ${b}`).join("\n")}${warnLine}`, chips: ["Nasıl yapılır?", "Kimler yapmamalı?"] }
    case "avoid":
      return { text: `${head}\n\nDikkat etmen gerekenler:\n${p.avoid.map((a) => `- ${a}`).join("\n")}\n\nAğrı hissedersen duruştan yavaşça çık; yoga acı çekmek için değildir.`, chips: ["Daha kolay hali", "Nasıl yapılır?"] }
    case "easier":
      return { text: `${head}\n\n**Daha kolay hali:** ${p.easier}${warnLine}`, chips: ["Daha zor hali", "Nasıl yapılır?"] }
    case "harder":
      return { text: `${head}\n\n**Daha zor hali:** ${p.harder}\n\nÖnce temel halinde rahat ve dengeli olduğundan emin ol.`, chips: ["Daha kolay hali", "Kimler yapmamalı?"] }
    case "breath":
      return { text: `${head}\n\n**Nefes:** ${p.breath}`, chips: ["Nasıl yapılır?", "Faydaları neler?"] }
    case "hold":
      return { text: `${head}\n\n**Ne kadar kalınır:** ${p.hold}. Yeni başlıyorsan alt sınırdan başla.`, chips: ["Nasıl yapılır?", "Daha kolay hali"] }
    case "counter": {
      const counters = p.counter.map((s) => POSE_BY_SLUG[s]).filter(Boolean)
      return { text: counters.length ? `${head}\n\nBu duruştan sonra dengelemek için: ${counters.map((c) => `**${c.name}**`).join(", ")}.` : `${head}\n\nBu duruştan sonra birkaç yavaş nefesle dinlenmen yeterli.`, chips: ["Nasıl yapılır?"] }
    }
    case "level":
      return { text: `${head}\n\n${p.level === "Başlangıç" ? "Yeni başlayanlar için uygun." : p.level === "Orta" ? "Biraz deneyim isteyen bir duruş; temel duruşlarda rahatsan deneyebilirsin." : "İleri seviye; önce temel duruşlarda güçlen ve bir eğitmenle çalış."} Kolaylaştırma: ${p.easier}`, chips: ["Nasıl yapılır?", "Daha kolay hali"] }
    default:
      return { text: `${head}\n\n${p.intro}\n\nBaşlıca faydaları:\n${p.benefits.slice(0, 3).map((b) => `- ${b}`).join("\n")}\n\n**Ne kadar kal:** ${p.hold}${warnLine}`, chips }
  }
}

export const styleName = (id: StyleId) => STYLE_BY_SLUG[id === "restorative" ? "restoratif" : id === "meditation" ? "meditasyon" : id]?.name ?? id
