import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_API } from "@/lib/rate-limit"
import { likedSet, optionalUser, postInclude, serializePost } from "@/lib/community"
import { notify } from "@/lib/notifications"
import { cleanReason } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// GET /api/community/:id — one post with its comments (non-public posts only for the owner and the admins)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, RATE_LIMIT_API)
  if (blocked) return blocked
  try {
    const viewer = await optionalUser(req)
    const post = await db.post.findUnique({ where: { id: params.id }, include: postInclude })
    const allowed = post && (post.status === "VISIBLE" || viewer?.id === post.authorId || viewer?.role === "ADMIN")
    if (!post || !allowed) return NextResponse.json({ error: "Gönderi bulunamadı." }, { status: 404 })
    const comments = post.status === "VISIBLE"
      ? await db.comment.findMany({ where: { postId: post.id, status: "VISIBLE" }, orderBy: { createdAt: "asc" }, take: 200, include: { author: { select: { id: true, name: true, image: true, role: true } } } })
      : []
    const liked = await likedSet(viewer?.id, [post.id])
    return NextResponse.json({
      post: serializePost(post, viewer, liked),
      comments: comments.map((c) => ({
        id: c.id, content: c.content, createdAt: c.createdAt,
        mine: viewer?.id === c.authorId,
        canDelete: viewer?.id === c.authorId || viewer?.id === post.authorId || viewer?.role === "ADMIN",
        author: { id: c.author.id, name: c.author.name, image: c.author.image, isTeacher: c.author.role === "TEACHER" },
      })),
    })
  } catch (error) {
    console.error("[COMMUNITY_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

// DELETE /api/community/:id { reason? } — the owner takes a post down; an admin must give a reason (the owner is told)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const post = await db.post.findUnique({ where: { id: params.id } })
    if (!post || post.status === "REMOVED") return NextResponse.json({ error: "Gönderi bulunamadı." }, { status: 404 })
    const isOwner = post.authorId === user.id
    if (!isOwner && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const reason = cleanReason(body.reason, 300)
    if (!isOwner && reason.length < 3) return NextResponse.json({ error: "Kaldırma nedeni gerekli." }, { status: 400 })
    await db.post.update({ where: { id: post.id }, data: { status: "REMOVED", removedReason: isOwner ? "Yazar tarafından silindi" : reason, reviewedById: isOwner ? null : user.id, reviewedAt: new Date() } })
    if (!isOwner) {
      await db.auditLog.create({ data: { actorId: user.id, action: "REMOVE_POST", targetId: post.id, reason } })
      await notify({ userId: post.authorId, type: "POST_REMOVED", title: "Fotoğrafın kaldırıldı", body: `Topluluk kurallarına uymadığı için kaldırıldı: ${reason}`, href: "/community/rules" })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[COMMUNITY_DELETE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
