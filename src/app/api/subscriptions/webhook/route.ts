import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { handleSubscriptionWebhook } from "@/lib/subscription-server"

export const dynamic = "force-dynamic"

/**
 * POST /api/subscriptions/webhook — iyzico's subscription notifications (renewal paid / failed, cancelled …).
 * Set this address in the iyzico merchant panel (Ayarlar → Bildirimler). The body is not trusted: only the
 * subscription reference is taken from it, and the actual state is fetched from iyzico's API with our keys.
 */
export async function POST(req: Request) {
  if (!rateLimit(`sub-webhook:${extractIp(req)}`, { maxRequests: 120, windowMs: 60_000 }).allowed) return NextResponse.json({ ok: false }, { status: 429 })
  const body = await req.json().catch(() => null)
  try {
    await handleSubscriptionWebhook(body)
  } catch (e) {
    console.error("[SUB_WEBHOOK]", e)
    // iyzico retries on non-2xx; a failed fetch here is worth a retry
    return NextResponse.json({ ok: false }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
