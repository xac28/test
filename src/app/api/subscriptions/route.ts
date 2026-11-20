import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { iyzicoMode } from "@/lib/iyzico"
import { INTERVALS, PAID_PLANS, PLAN_FEATURES, PLAN_LABEL, planPriceKurus } from "@/lib/subscriptions"
import { SubscriptionError, cancelSubscription, membershipSummary } from "@/lib/subscription-server"

export const dynamic = "force-dynamic"

const prices = () => Object.fromEntries(PAID_PLANS.map((p) => [p, Object.fromEntries(INTERVALS.map((i) => [i, planPriceKurus(p, i)]))]))

// GET /api/subscriptions — plans and prices (everyone) + the caller's membership (signed in)
export async function GET(req: Request) {
  const user = await resolveUser(req).catch(() => null)
  return NextResponse.json({
    available: iyzicoMode() !== "off",
    plans: (["FREE", ...PAID_PLANS] as const).map((id) => ({ id, name: PLAN_LABEL[id], features: PLAN_FEATURES[id] })),
    prices: prices(),
    membership: user ? await membershipSummary(user.id) : null,
  })
}

// DELETE /api/subscriptions — cancel: no further charges, the paid period stays usable
export async function DELETE(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const r = await cancelSubscription(user.id)
    return NextResponse.json({ success: true, until: r.until })
  } catch (e) {
    if (e instanceof SubscriptionError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    console.error("[SUB_CANCEL]", e)
    return NextResponse.json({ error: "Abonelik iptal edilemedi, lütfen tekrar deneyin." }, { status: 500 })
  }
}
