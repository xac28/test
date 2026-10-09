import Anthropic from "@anthropic-ai/sdk"
import { AI_LIMITS, AI_MODEL } from "@/lib/ai/config"
import { PERSONA, dynamicContext, knowledgeText } from "@/lib/ai/prompt"
import { AiCard, TOOLS, TOOL_STATUS, ToolCtx, runTool } from "@/lib/ai/tools"

export interface ChatMsg { role: "user" | "assistant"; content: string }

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "status"; label: string }
  | { type: "cards"; cards: AiCard[] }
  | { type: "action"; action: "support" }

export interface AgentResult {
  text: string
  tools: string[]
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  refused: boolean
  /** the loop ran out of tool round trips before the model answered */
  exhausted: boolean
}

const REFUSAL_TEXT = "Bu konuda sana yardımcı olamıyorum. Yoga, AYA ya da mağaza hakkında başka bir şey sorabilirsin."

/**
 * One question → answer, streamed. The model may look things up with tools (up to maxToolTurns round trips);
 * its text is forwarded as it is written, tool results become cards. Throws when the API itself fails,
 * so the caller can fall back to the rule-based guide.
 */
export async function runAgent(opts: {
  client: Anthropic
  history: ChatMsg[]
  ctx: ToolCtx
  page?: string
  emit: (e: AgentEvent) => void
  signal?: AbortSignal
}): Promise<AgentResult> {
  const { client, history, ctx, emit, signal } = opts
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }))
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: PERSONA },
    // the cache breakpoint sits after everything that never changes; the per-request block below stays outside it
    { type: "text", text: knowledgeText(), cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamicContext({ now: new Date(), user: ctx.user ? { role: ctx.user.role, name: ctx.user.name } : null, page: opts.page }) },
  ]

  const out: AgentResult = { text: "", tools: [], inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, refused: false, exhausted: false }
  const cardKeys = new Set<string>()

  for (let turn = 0; turn < AI_LIMITS.maxToolTurns; turn++) {
    const stream = client.beta.messages.stream(
      {
        model: AI_MODEL(),
        max_tokens: AI_LIMITS.maxOutputTokens,
        // a policy decline is retried on a fallback model by the API itself (see "server-side fallbacks")
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // a chat answer needs little deliberation: the lowest effort keeps it quick and cheap
        output_config: { effort: "low" },
        system,
        tools: TOOLS,
        messages,
      },
      { signal },
    )
    let turnText = ""
    stream.on("text", (delta) => {
      // a new model turn after a tool call continues the same chat bubble: separate it from what came before
      if (!turnText && out.text && !/\s$/.test(out.text)) { out.text += "\n\n"; emit({ type: "text", text: "\n\n" }) }
      turnText += delta
      out.text += delta
      emit({ type: "text", text: delta })
    })
    const msg = await stream.finalMessage()
    out.inputTokens += msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0)
    out.outputTokens += msg.usage.output_tokens
    out.cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0

    if (msg.stop_reason === "refusal") {
      out.refused = true
      if (!out.text) { out.text = REFUSAL_TEXT; emit({ type: "text", text: REFUSAL_TEXT }) }
      return out
    }
    if (msg.stop_reason !== "tool_use") return out

    // the assistant turn goes back unchanged (thinking blocks included), followed by every tool result in ONE user message
    messages.push({ role: "assistant", content: msg.content })
    const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
    emit({ type: "status", label: TOOL_STATUS[calls[0]?.name] ?? "Bilgi toplanıyor…" })
    const results = await Promise.all(
      calls.map(async (c) => {
        out.tools.push(c.name)
        const r = await runTool(c.name, c.input, ctx)
        if (r.cards?.length) {
          const fresh = r.cards.filter((card) => !cardKeys.has(card.href) && cardKeys.add(card.href))
          if (fresh.length) emit({ type: "cards", cards: fresh })
        }
        if (r.action) emit({ type: "action", action: r.action })
        const block: Anthropic.Beta.BetaToolResultBlockParam = { type: "tool_result", tool_use_id: c.id, content: JSON.stringify(r.result), ...(r.isError ? { is_error: true } : {}) }
        return block
      }),
    )
    messages.push({ role: "user", content: results })
  }
  out.exhausted = true
  const more = "\n\nBunu daha fazla araştıramadım; istersen soruyu biraz daha açık yazar mısın?"
  out.text += more
  emit({ type: "text", text: more })
  return out
}
