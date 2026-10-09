import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AI, rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { resolveUser } from "@/lib/auth-utils"
import { isCrisis } from "@/lib/ai-knowledge"
import { wantsHuman, normalize } from "@/lib/ai-guide"
import { redactForLog } from "@/lib/ai-learning"
import { AI_LIMITS, aiEnabled, makeClient } from "@/lib/ai/config"
import { runAgent, AgentEvent } from "@/lib/ai/agent"
import { cleanHistory, cleanPage } from "@/lib/ai/history"
import { recordUsage, withinBudget } from "@/lib/ai/usage"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const fallback = (reason: string) => NextResponse.json({ fallback: reason })

/**
 * POST /api/ai/chat { messages: [{role, content}], page? }
 * Streams the guide's answer as server-sent events: text deltas, tool status, result cards, a final "done".
 * Answers with JSON { fallback } instead whenever the rule-based guide should reply (AI off, crisis, human wanted,
 * daily limit, budget spent, API trouble), so the visitor always gets an answer.
 */
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AI)
  if (blocked) return blocked

  const body = await req.json().catch(() => ({}))
  const history = cleanHistory(body?.messages)
  if (!history) return NextResponse.json({ error: "Message is required" }, { status: 400 })
  const last = history[history.length - 1].content

  if (!aiEnabled()) return fallback("disabled")
  // sensitive moments keep their carefully written, deterministic answers
  if (isCrisis(last) || wantsHuman(last)) return fallback("rules")

  const user = await resolveUser(req).catch(() => null)
  const who = user ? `u:${user.id}` : `ip:${extractIp(req)}`
  const cap = user ? AI_LIMITS.perUserDay : AI_LIMITS.perVisitorDay
  if (!rateLimit(`ai-day:${who}`, { maxRequests: cap, windowMs: 86_400_000 }).allowed) {
    await recordUsage({ fallback: true })
    return fallback("limit")
  }
  if (!(await withinBudget())) {
    await recordUsage({ fallback: true })
    return fallback("budget")
  }

  const enc = new TextEncoder()
  const page = cleanPage(body?.page)
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)) } catch { /* the visitor left */ }
      }
      let wrote = false
      try {
        const result = await runAgent({
          client: makeClient(), history, ctx: { user }, page, signal: req.signal,
          emit: (e: AgentEvent) => { if (e.type === "text") wrote = true; send(e) },
        })
        await recordUsage({ request: true, inputTokens: result.inputTokens, outputTokens: result.outputTokens, cacheReadTokens: result.cacheReadTokens })
        let interactionId: string | null = null
        try {
          const msg = redactForLog(last)
          const row = await db.aiInteraction.create({
            data: {
              userId: user?.id ?? null, message: msg.slice(0, 500), norm: normalize(msg).slice(0, 500), intent: "llm", kind: "llm",
              reply: result.text.slice(0, 4000), tools: [...new Set(result.tools)].join(",").slice(0, 200) || null, tokensIn: result.inputTokens, tokensOut: result.outputTokens,
            },
            select: { id: true },
          })
          interactionId = row.id
        } catch { /* logging must never break the answer */ }
        send({ type: "done", interactionId, askFeedback: !!interactionId && !result.refused, refused: result.refused })
      } catch (e) {
        if (req.signal.aborted) return
        const kind = e instanceof Anthropic.RateLimitError ? "rate_limit" : e instanceof Anthropic.AuthenticationError ? "auth" : e instanceof Anthropic.APIError ? `api_${e.status}` : "error"
        console.error("[AI_CHAT]", kind, e instanceof Error ? e.message : e)
        await recordUsage({ fallback: true })
        // nothing shown yet → the rule-based guide answers instead; otherwise say that the answer broke off
        send(wrote ? { type: "error", message: "Yanıt yarıda kesildi. Lütfen soruyu tekrar gönder." } : { type: "fallback", reason: kind })
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } })
}
