import type { AiCard, ToolCtx } from "@/lib/ai/tools"
import type { GuideLink } from "@/lib/ai-guide"
import type { BrainIntent } from "./intents"
import type { DialogueState, ResolvedTurn } from "./dialogue"

/** What the engine decided to say. The streaming layer turns this into events. */
export interface Answer {
  text: string
  cards: AiCard[]
  links: GuideLink[]
  suggestions: string[]
  /** the chat should open live support */
  action?: "support"
  /** the guide did not know this and has recorded it for the admins */
  learning?: boolean
  /** label of the log row: taught | knowledge | navigation | unknown | crisis | support | recommend */
  kind: "taught" | "knowledge" | "navigation" | "unknown" | "crisis" | "support" | "recommend"
  intent: BrainIntent | "taught" | "crisis"
  confidence: number
  /** tools that were consulted (for the admin view) */
  tools: string[]
  /** a taught answer that was used */
  matchedId?: string
  /** feedback buttons make sense for this answer */
  rate: boolean
  /** status line to show while the work is done, in order */
  statuses: string[]
}

export interface Env {
  ctx: ToolCtx
  now: Date
  /** a stable number per message: the same question gets the same wording */
  seed: number
  /** first name, only on the first answers of a chat */
  name?: string
  turn: ResolvedTurn
  state: DialogueState
  signedIn: boolean
  role: string | null
  /** run a tool (collects the names for the log) */
  tool: (name: string, input: Record<string, unknown>) => Promise<{ result: any; cards?: AiCard[]; action?: "support"; isError?: boolean }>
}

export const answer = (a: Partial<Answer> & Pick<Answer, "text" | "intent" | "kind">): Answer => ({
  cards: [], links: [], suggestions: [], tools: [], confidence: 1, rate: true, statuses: [], ...a,
})

export const joinTr = (items: string[]): string => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ve ${items[items.length - 1]}`)

export const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

export function istanbulHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }).format(d)) % 24
}
export function istanbulDate(d: Date) {
  const f = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" }).format(d)
  const [y, m, day] = f.split("-").map(Number)
  return { y, m, d: day }
}
/** Midnight (Istanbul, UTC+3) of the day `offset` days from `now`. */
export function dayStart(now: Date, offset = 0): Date {
  const { y, m, d } = istanbulDate(now)
  return new Date(Date.UTC(y, m - 1, d + offset, -3, 0, 0))
}
export const weekdayOf = (d: Date) => new Date(d.getTime() + 3 * 3600_000).getUTCDay()
