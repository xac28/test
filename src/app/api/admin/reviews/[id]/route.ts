import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { notify } from "@/lib/notifications"

// POST /api/admin/reviews/:id { action: remove | restore, reason? } — a removed review stops counting and showing
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || "")
  const reason = cleanReason(body.reason, 300)
  const r = await db.review.findUnique({ where: { id: params.id }, include: { booking: { select: { studentId: true } } } })
  if (!r) return NextResponse.json({ error: "Değerlendirme bulunamadı" }, { status: 404 })
  if (action === "remove") {
    if (r.status === "REMOVED") return NextResponse.json({ error: "Zaten kaldırılmış." }, { status: 409 })
    if (reason.length < 3) return NextResponse.json({ error: "Neden gerekli." }, { status: 400 })
    await db.review.update({ where: { id: r.id }, data: { status: "REMOVED", removedReason: reason, removedById: g.admin.id, removedAt: new Date() } })
    await notify({ userId: r.booking.studentId, type: "COMMENT_REMOVED", title: "Değerlendirmen kaldırıldı", body: reason, href: "/community/rules" })
  } else if (action === "restore") {
    if (r.status !== "REMOVED") return NextResponse.json({ error: "Kaldırılmış değil." }, { status: 409 })
    await db.review.update({ where: { id: r.id }, data: { status: "VISIBLE", removedReason: null, removedById: null, removedAt: null } })
  } else return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: `REVIEW_${action.toUpperCase()}`, targetId: r.id, reason: reason || null } })
  return NextResponse.json({ success: true })
}
