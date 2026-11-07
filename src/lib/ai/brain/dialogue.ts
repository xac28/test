/**
 * Conversation memory. The browser sends the whole chat; replaying the user's earlier messages through the same
 * pipeline rebuilds what the guide knew at that point (intent, style, area, level, price…). The newest message is then
 * read in that light: "peki ya daha ucuzu?" is about the same search, "başka var mı?" asks for the next page, and
 * "daha kolay hali?" is about the pose we were just talking about.
 */
import { Classification, classify, BrainIntent } from "./intents"
import { Doc, parse } from "./nlp"
import { Slots, emptySlots, extractSlots, hasContent } from "./slots"

export interface DialogueState {
  /** what the conversation has established so far */
  slots: Slots
  lastIntent?: BrainIntent
  lastPoseSlug?: string
  /** how many times in a row the visitor asked for "more" of the same thing */
  page: number
  /** user turns seen */
  turns: number
}

export interface ResolvedTurn {
  doc: Doc
  own: Slots
  cls: Classification
  intent: BrainIntent
  /** the message leans on the earlier conversation */
  followUp: boolean
  /** slots after merging the conversation into this message */
  slots: Slots
  page: number
  /** the visitor asked for more of the same */
  more: boolean
}

export const initialState = (): DialogueState => ({ slots: emptySlots(), page: 0, turns: 0 })

const MORE = ["baska", "baska var mi", "baskalari", "digerleri", "diger", "daha fazla", "devam", "biraz daha", "daha var mi", "baska bir sey", "baska oneri", "alternatif", "ya baska", "oteki", "ötekiler", "gostermeye devam", "hepsi", "tumunu goster"]
const LEAN = ["peki", "ya ", "ayrica", "bir de", "bide", "onun", "bunun", "ondan", "bundan", "aynisi", "ayni", "onu", "bunu", "bunlar", "onlar", "o zaman", "madem", "ama", "yani", "yoksa"]
const CONTEXTUAL: BrainIntent[] = ["teachers", "workshops", "live", "articles", "news", "podcast", "pose", "products", "plan", "recommend", "compare", "pricing", "booking"]
/** Intents a short follow-up message may continue (the contextual ones, and an order lookup that still waits for the e-mail). */
const STICKY: BrainIntent[] = [...CONTEXTUAL, "order"]

/** Which slots survive a change of subject (health and level are about the person, not the search). */
function carryOver(prev: Slots): Slots {
  return { ...emptySlots(), conditions: prev.conditions, level: prev.level, goals: prev.goals, areas: prev.areas }
}

export function resolve(raw: string, state: DialogueState): ResolvedTurn {
  const doc = parse(raw)
  const own = extractSlots(raw, doc)
  const cls = classify(doc, own, raw)
  const more = doc.has(...MORE) && doc.words.length <= 6
  const lean = doc.has(...LEAN) || more
  const short = doc.words.length <= 5
  const prevIntent = state.lastIntent

  let intent = cls.top
  let followUp = false

  // a bare pose question about the pose we were just discussing ("daha kolay hali?", "kaç nefes?")
  if (state.lastPoseSlug && !own.poseSlug && own.poseFacet && (intent === "unknown" || intent === "knowledge" || intent === "pose" || cls.topScore < 6)) {
    intent = "pose"
    followUp = true
  } else if (more && prevIntent) {
    intent = prevIntent
    followUp = true
  } else if (prevIntent && (cls.topScore < 4 || cls.confidence < 0.3) && (hasContent(own) || lean) && short) {
    // too little evidence of its own, but it names a price/day/style/area: a refinement of the previous request
    intent = STICKY.includes(prevIntent) ? prevIntent : cls.topScore < 1 ? prevIntent : cls.top
    followUp = intent === prevIntent
  } else if (prevIntent && lean && cls.topScore < 6 && CONTEXTUAL.includes(prevIntent) && (cls.top === "recommend" || cls.top === "unknown" || cls.top === "knowledge")) {
    intent = prevIntent
    followUp = true
  }

  // merge: same subject → keep everything and let this message override; new subject → keep only the person's own traits
  const base = followUp || intent === prevIntent ? state.slots : carryOver(state.slots)
  const pick = <T,>(mine: T[], theirs: T[]) => (mine.length ? mine : theirs)
  const slots: Slots = {
    styles: pick(own.styles, base.styles),
    areas: pick(own.areas, base.areas),
    goals: pick(own.goals, base.goals),
    conditions: [...new Set([...base.conditions, ...own.conditions])],
    level: own.level ?? base.level,
    time: own.time ?? base.time,
    price: own.price ? { ...(followUp ? base.price : undefined), ...own.price } : base.price,
    mode: own.mode ?? base.mode,
    duration: own.duration ?? base.duration,
    poseSlug: own.poseSlug ?? (intent === "pose" ? state.lastPoseSlug : undefined),
    poseFacet: own.poseFacet,
    productCategory: own.productCategory ?? (followUp ? base.productCategory : undefined),
    orderCode: own.orderCode ?? base.orderCode,
    email: own.email ?? base.email,
    topic: own.topic ?? base.topic,
  }
  // "ucuz" on top of an earlier "pahalı olmasın" is the same thing; an explicit new limit replaces an old one
  if (own.price?.maxUsd || own.price?.maxTl) slots.price = { ...slots.price, ...own.price }

  const page = more && followUp ? state.page + 1 : 0
  return { doc, own, cls, intent, followUp, slots, page, more }
}

/** Folds one finished turn into the state (what the next message will be read against). */
export function advance(state: DialogueState, t: ResolvedTurn): DialogueState {
  const keep = !CONTEXTUAL.includes(t.intent) && t.intent !== "order" && t.intent !== "schedule"
  return {
    // small talk, thanks and "who are you" must not wipe the thread
    slots: keep && t.intent !== "knowledge" ? state.slots : t.slots,
    lastIntent: keep ? state.lastIntent : t.intent,
    lastPoseSlug: t.slots.poseSlug ?? state.lastPoseSlug,
    page: keep ? state.page : t.page,
    turns: state.turns + 1,
  }
}

/** Replays the earlier user messages of a chat to rebuild the state. */
export function replay(userMessages: string[]): DialogueState {
  let s = initialState()
  for (const m of userMessages) s = advance(s, resolve(m, s))
  return s
}
