import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { isCampaignActive } from "@/lib/discounts"

export const dynamic = "force-dynamic"

// GET /api/campaigns/active — the best currently-running campaign, for the site-wide banner (no auth: public)
export async function GET() {
  const now = new Date()
  const campaigns = await db.campaign.findMany({ where: { startsAt: { lte: now }, endsAt: { gte: now } } })
  const best = campaigns.filter((c) => isCampaignActive(c, now)).sort((a, b) => b.discountPct - a.discountPct)[0]
  if (!best) return NextResponse.json({ active: false })
  return NextResponse.json({ active: true, id: best.id, name: best.name, discountPct: best.discountPct, scope: best.scope, bannerMessage: best.bannerMessage })
}
