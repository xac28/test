import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { validateCampaignInput } from "@/lib/discounts"

export const dynamic = "force-dynamic"

// PATCH /api/admin/campaigns/:id — edit a campaign, or end it early by passing endsAt: now
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const existing = await db.campaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Kampanya bulunamadı." }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const v = validateCampaignInput({ ...existing, ...body })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const campaign = await db.campaign.update({
    where: { id }, data: { name: v.name, discountPct: v.discountPct, scope: v.scope, bannerMessage: v.bannerMessage, startsAt: v.startsAt, endsAt: v.endsAt },
  })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "CAMPAIGN_UPDATE", targetId: id, reason: `${v.name}: %${v.discountPct} (${v.scope})` } })
  return NextResponse.json({ success: true, campaign })
}

// DELETE /api/admin/campaigns/:id — remove a campaign entirely (e.g. one scheduled by mistake)
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const existing = await db.campaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Kampanya bulunamadı." }, { status: 404 })

  await db.campaign.delete({ where: { id } })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "CAMPAIGN_DELETE", targetId: id, reason: existing.name } })
  return NextResponse.json({ success: true })
}
