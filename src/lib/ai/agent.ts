import { AiCard, ToolCtx } from "@/lib/ai/tools"
import { ChatMsg, think } from "@/lib/ai/brain/engine"
import type { Answer } from "@/lib/ai/brain/answer"

export type { ChatMsg }

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "status"; label: string }
  | { type: "cards"; cards: AiCard[] }
  | { type: "links"; links: { label: string; href: string }[] }
  | { type: "suggestions"; suggestions: string[] }
  | { type: "learning" }
  | { type: "action"; action: "support" }

export interface AgentResult {
  text: string
  tools: string[]
  intent: string
  kind: Answer["kind"]
  confidence: number
  matchedId?: string
  learning: boolean
  /** feedback buttons make sense for this answer */
  rate: boolean
}

/** Milliseconds between streamed chunks. 0 (tests) writes the answer at once. */
const pace = (chunks: number) => {
  const env = process.env.AYA_AI_STREAM_MS
  if (env !== undefined && env !== "") return Math.max(0, Number(env) || 0)
  return Math.min(22, Math.max(5, Math.round(2400 / Math.max(chunks, 1))))
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (!ms) return resolve()
    const t = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve() }, { once: true })
  })

/** Splits an answer into small pieces that keep markdown markers and line breaks intact. */
export function chunkText(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? []
  const out: string[] = []
  for (let i = 0; i < words.length; i += 2) out.push(words.slice(i, i + 2).join(""))
  return out
}

/**
 * One question → answer, streamed: a status line while data is looked up, the result cards, the text as it is
 * "written", then links, follow-up chips and hand-over actions. The engine itself is src/lib/ai/brain.
 */
export async function runAgent(opts: {
  history: ChatMsg[]
  ctx: ToolCtx
  page?: string
  emit: (e: AgentEvent) => void
  signal?: AbortSignal
}): Promise<AgentResult> {
  const { history, ctx, emit, signal } = opts
  const a = await think(history, ctx, { onStatus: (label) => emit({ type: "status", label }) })
  if (signal?.aborted) throw new Error("aborted")

  if (a.cards.length) emit({ type: "cards", cards: dedupeCards(a.cards) })
  const chunks = chunkText(a.text)
  const wait = pace(chunks.length)
  for (const c of chunks) {
    if (signal?.aborted) break
    emit({ type: "text", text: c })
    await sleep(wait, signal)
  }
  if (a.links.length) emit({ type: "links", links: a.links })
  if (a.suggestions.length) emit({ type: "suggestions", suggestions: a.suggestions })
  if (a.learning) emit({ type: "learning" })
  if (a.action) emit({ type: "action", action: a.action })
  return { text: a.text, tools: a.tools, intent: String(a.intent), kind: a.kind, confidence: a.confidence, matchedId: a.matchedId || undefined, learning: !!a.learning, rate: a.rate }
}

function dedupeCards(cards: AiCard[]): AiCard[] {
  const seen = new Set<string>()
  return cards.filter((c) => !seen.has(c.href) && !!seen.add(c.href))
}
