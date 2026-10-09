import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AI, rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { resolveUser } from "@/lib/auth-utils"
import { normalize } from "@/lib/ai-guide"
import { redactForLog } from "@/lib/ai-learning"
import { logEvent } from "@/lib/event-log"
import { runAgent, AgentEvent } from "@/lib/ai/agent"
import { AI_LIMITS, cleanHistory, cleanPage } from "@/lib/ai/history"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/ai/chat { messages: [{role, content}], page? }
 * AYA Rehber, streamed as server-sent events: a status line while data is looked up, result cards, the answer text,
 * links, follow-up chips and a final "done". The engine is our own (src/lib/ai/brain); nothing leaves the server.
 */
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AI)
  if (blocked) return blocked

  const body = await req.json().catch(() => ({}))
  const history = cleanHistory(body?.messages)
  if (!history) return NextResponse.json({ error: "Message is required" }, { status: 400 })
  const last = history[history.length - 1].content

  const user = await resolveUser(req).catch(() => null)
  const who = user ? `u:${user.id}` : `ip:${extractIp(req)}`
  const cap = user ? AI_LIMITS.perUserDay : AI_LIMITS.perVisitorDay
  if (!rateLimit(`ai-day:${who}`, { maxRequests: cap, windowMs: 86_400_000 }).allowed) {
    return NextResponse.json({ error: "Bugünlük soru sınırına ulaştın; yarın tekrar dene ya da canlı destekle yaz." }, { status: 429 })
  }

  const enc = new TextEncoder()
  const page = cleanPage(body?.page)
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)) } catch { /* the visitor left */ }
      }
      try {
        const result = await runAgent({ history, ctx: { user }, page, signal: req.signal, emit: (e: AgentEvent) => send(e) })
        let interactionId: string | null = null
        try {
          const msg = redactForLog(last)
          const row = await db.aiInteraction.create({
            data: {
              userId: user?.id ?? null, message: msg.slice(0, 500), norm: normalize(msg).slice(0, 500), intent: result.intent.slice(0, 40), kind: result.kind,
              matchedId: result.matchedId ?? null, reply: result.text.slice(0, 4000), tools: [...new Set(result.tools)].join(",").slice(0, 200) || null, confidence: result.confidence,
            },
            select: { id: true },
          })
          interactionId = row.id
          if (result.kind === "unknown") logEvent({ type: "AI_UNKNOWN", level: "info", message: `Rehber bilmediği soru: ${msg.slice(0, 200)}`, userId: user?.id })
        } catch { /* logging must never break the answer */ }
        send({ type: "done", interactionId, askFeedback: !!interactionId && result.rate, kind: result.kind })
      } catch (e) {
        if (req.signal.aborted) return
        console.error("[AI_CHAT]", e instanceof Error ? e.message : e)
        send({ type: "error", message: "Şu an yanıt veremiyorum. Lütfen tekrar dene ya da canlı destekle yaz." })
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } })
}
