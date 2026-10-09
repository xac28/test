import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { notify } from "@/lib/notifications"

// POST /api/admin/community/comments/:id { action: remove | restore, reason? }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || "")
  const reason = cleanReason(body.reason, 300)
  const c = await db.comment.findUnique({ where: { id: params.id } })
  if (!c) return NextResponse.json({ error: "Yorum bulunamadı" }, { status: 404 })
  if (action === "remove") {
    if (c.status === "REMOVED") return NextResponse.json({ error: "Yorum zaten kaldırılmış." }, { status: 409 })
    if (reason.length < 3) return NextResponse.json({ error: "Neden gerekli." }, { status: 400 })
    await db.$transaction([
      db.comment.update({ where: { id: c.id }, data: { status: "REMOVED", removedById: g.admin.id, removedReason: reason } }),
      db.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } }),
    ])
    await notify({ userId: c.authorId, type: "COMMENT_REMOVED", title: "Yorumun kaldırıldı", body: reason, href: "/community/rules" })
  } else if (action === "restore") {
    if (c.status !== "REMOVED") return NextResponse.json({ error: "Yorum kaldırılmış değil." }, { status: 409 })
    await db.$transaction([
      db.comment.update({ where: { id: c.id }, data: { status: "VISIBLE", removedById: null, removedReason: null } }),
      db.post.update({ where: { id: c.postId }, data: { commentCount: { increment: 1 } } }),
    ])
  } else return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: `COMMENT_${action.toUpperCase()}`, targetId: c.id, reason: reason || null } })
  return NextResponse.json({ success: true })
}
