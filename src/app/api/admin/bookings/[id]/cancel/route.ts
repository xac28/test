import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"

// POST /api/admin/bookings/:id/cancel { reason }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const reason = cleanReason(body.reason)
  if (reason.length < 3) return NextResponse.json({ error: "İptal nedeni gerekli." }, { status: 400 })
  const b = await db.booking.findUnique({ where: { id: params.id } })
  if (!b) return NextResponse.json({ error: "Rezervasyon bulunamadı" }, { status: 404 })
  if (b.status === "CANCELLED" || b.status === "COMPLETED") return NextResponse.json({ error: "Bu rezervasyon artık iptal edilemez." }, { status: 409 })
  await db.booking.update({ where: { id: b.id }, data: { status: "CANCELLED" } })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "CANCEL_BOOKING", targetId: b.id, reason: `${reason} (önceki durum: ${b.status}, ücret: ${b.price})` } })
  return NextResponse.json({ success: true })
}
