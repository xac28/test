import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// DELETE /api/admin/discounts/:userId — cancel a personal discount
export async function DELETE(req: Request, props: { params: Promise<{ userId: string }> }) {
  const { userId } = await props.params
  const g = await requireAdmin(req)
  if ("response" in g) return g.response

  const existing = await db.personalDiscount.findUnique({ where: { userId }, include: { user: { select: { name: true } } } })
  if (!existing) return NextResponse.json({ error: "Bu kullanıcıya tanımlı bir indirim yok." }, { status: 404 })

  await db.personalDiscount.delete({ where: { userId } })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "PERSONAL_DISCOUNT_CANCEL", targetId: userId, reason: `${existing.user.name ?? userId}: %${existing.discountPct} indirim iptal edildi` } })
  return NextResponse.json({ success: true })
}
