import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"

// POST /api/admin/workshops/:id/unpublish { reason } — back to draft (the teacher can fix and re-publish)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const reason = cleanReason(body.reason)
  if (reason.length < 3) return NextResponse.json({ error: "Neden gerekli." }, { status: 400 })
  const w = await db.workshop.findUnique({ where: { id: params.id } })
  if (!w) return NextResponse.json({ error: "Atölye bulunamadı" }, { status: 404 })
  if (w.status !== "PUBLISHED") return NextResponse.json({ error: "Atölye zaten yayında değil." }, { status: 409 })
  await db.workshop.update({ where: { id: w.id }, data: { status: "DRAFT" } })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "UNPUBLISH_WORKSHOP", targetId: w.id, reason: `${w.title}: ${reason}` } })
  return NextResponse.json({ success: true })
}
