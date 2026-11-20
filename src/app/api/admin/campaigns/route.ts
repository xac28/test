import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { validateCampaignInput } from "@/lib/discounts"

export const dynamic = "force-dynamic"

// GET /api/admin/campaigns — all scheduled/active/past campaigns, most recent first
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const campaigns = await db.campaign.findMany({ orderBy: { startsAt: "desc" }, take: 100 })
  return NextResponse.json({ campaigns })
}

// POST /api/admin/campaigns { name, discountPct, scope, bannerMessage?, startsAt, endsAt } — schedule a campaign
export async function POST(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const v = validateCampaignInput(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const campaign = await db.campaign.create({
    data: { name: v.name, discountPct: v.discountPct, scope: v.scope, bannerMessage: v.bannerMessage, startsAt: v.startsAt, endsAt: v.endsAt, createdById: g.admin.id },
  })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "CAMPAIGN_CREATE", targetId: campaign.id, reason: `${v.name}: %${v.discountPct} (${v.scope})` } })
  return NextResponse.json({ success: true, campaign })
}
