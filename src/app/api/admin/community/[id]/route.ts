import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { notify } from "@/lib/notifications"

// POST /api/admin/community/:id { action: approve | reject | remove | restore, reason? }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || "")
  const reason = cleanReason(body.reason, 300)
  const post = await db.post.findUnique({ where: { id: params.id } })
  if (!post) return NextResponse.json({ error: "Gönderi bulunamadı" }, { status: 404 })
  const now = new Date()

  if (action === "approve") {
    if (post.status !== "PENDING") return NextResponse.json({ error: "Gönderi onay beklemiyor." }, { status: 409 })
    await db.post.update({ where: { id: post.id }, data: { status: "VISIBLE", reviewedById: g.admin.id, reviewedAt: now, removedReason: null } })
    await notify({ userId: post.authorId, type: "POST_APPROVED", title: "Fotoğrafın yayında!", body: "Paylaşımın onaylandı ve toplulukta görünüyor.", href: `/community/${post.id}` })
  } else if (action === "reject" || action === "remove") {
    if (post.status === "REMOVED") return NextResponse.json({ error: "Gönderi zaten kaldırılmış." }, { status: 409 })
    if (reason.length < 3) return NextResponse.json({ error: "Neden gerekli." }, { status: 400 })
    await db.post.update({ where: { id: post.id }, data: { status: "REMOVED", removedReason: reason, reviewedById: g.admin.id, reviewedAt: now } })
    await notify({ userId: post.authorId, type: "POST_REMOVED", title: action === "reject" ? "Fotoğrafın yayınlanmadı" : "Fotoğrafın kaldırıldı", body: reason, href: "/community/rules" })
  } else if (action === "restore") {
    if (post.status !== "REMOVED") return NextResponse.json({ error: "Gönderi kaldırılmış değil." }, { status: 409 })
    await db.post.update({ where: { id: post.id }, data: { status: "VISIBLE", removedReason: null, reviewedById: g.admin.id, reviewedAt: now } })
    await notify({ userId: post.authorId, type: "POST_APPROVED", title: "Fotoğrafın geri yüklendi", href: `/community/${post.id}` })
  } else return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })

  await db.auditLog.create({ data: { actorId: g.admin.id, action: `POST_${action.toUpperCase()}`, targetId: post.id, reason: reason || null } })
  return NextResponse.json({ success: true })
}
