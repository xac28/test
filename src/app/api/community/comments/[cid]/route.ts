import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { notify } from "@/lib/notifications"
import { cleanReason } from "@/lib/admin-api"

// DELETE /api/community/comments/:cid { reason? } — the author, the owner of the photo, or an admin may remove a comment
export async function DELETE(req: Request, { params }: { params: { cid: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const c = await db.comment.findUnique({ where: { id: params.cid }, include: { post: { select: { id: true, authorId: true } } } })
    if (!c || c.status === "REMOVED") return NextResponse.json({ error: "Yorum bulunamadı." }, { status: 404 })
    const isAuthor = c.authorId === user.id
    const isPostOwner = c.post.authorId === user.id
    if (!isAuthor && !isPostOwner && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const reason = cleanReason(body.reason, 300)
    if (user.role === "ADMIN" && !isAuthor && !isPostOwner && reason.length < 3) return NextResponse.json({ error: "Kaldırma nedeni gerekli." }, { status: 400 })

    await db.$transaction([
      db.comment.update({ where: { id: c.id }, data: { status: "REMOVED", removedById: isAuthor ? null : user.id, removedReason: isAuthor ? "Yazar tarafından silindi" : reason || "Gönderi sahibi tarafından kaldırıldı" } }),
      db.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } }),
    ])
    if (!isAuthor) {
      if (user.role === "ADMIN") await db.auditLog.create({ data: { actorId: user.id, action: "REMOVE_COMMENT", targetId: c.id, reason } })
      await notify({ userId: c.authorId, type: "COMMENT_REMOVED", title: "Yorumun kaldırıldı", body: "Yorumun topluluk kurallarına uymadığı için kaldırıldı.", href: "/community/rules" })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[COMMENT_DELETE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
