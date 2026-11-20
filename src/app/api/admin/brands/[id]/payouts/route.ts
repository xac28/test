import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { computeBrandAvailableKurus, computeBrandClaimedKurus, computeBrandEarnedKurus, validateBrandPayoutInput } from "@/lib/brands"

export const dynamic = "force-dynamic"

// POST /api/admin/brands/:id/payouts — record a bank transfer already sent to this brand
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const brand = await db.brand.findUnique({ where: { id: params.id } })
  if (!brand) return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const result = await db.$transaction(async (tx) => {
    const [items, payouts] = await Promise.all([
      tx.orderItem.findMany({ where: { brandId: brand.id }, select: { unitKurus: true, quantity: true, brandCommissionRate: true, order: { select: { status: true } } } }),
      tx.brandPayout.findMany({ where: { brandId: brand.id }, select: { amountKurus: true } }),
    ])
    const available = computeBrandAvailableKurus(computeBrandEarnedKurus(items), computeBrandClaimedKurus(payouts))
    const v = validateBrandPayoutInput(body, available)
    if (!v.ok) return { error: v.error }
    const payout = await tx.brandPayout.create({ data: { brandId: brand.id, amountKurus: v.amountKurus, note: v.note, paidById: a.admin.id } })
    return { payout }
  })

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
  await db.auditLog.create({ data: { actorId: a.admin.id, action: "BRAND_PAYOUT", targetId: brand.id, reason: `${brand.name}: ₺${(result.payout!.amountKurus / 100).toFixed(2)} ödendi${result.payout!.note ? ` — ${result.payout!.note}` : ""}` } })
  return NextResponse.json({ success: true, payout: result.payout })
}
