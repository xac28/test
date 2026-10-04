import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { COMMENT_MAX } from "@/lib/community"
import { moderateText, strikeHint } from "@/lib/moderation"
import { notify } from "@/lib/notifications"

// POST /api/community/:id/comments { content } — every comment passes the automatic moderation first
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Yorum yapmak için giriş yapın." }, { status: 401 })
    const gate = termsGate(user)
    if (gate) return gate
    const post = await db.post.findUnique({ where: { id: params.id }, select: { id: true, status: true, authorId: true } })
    if (!post || post.status !== "VISIBLE") return NextResponse.json({ error: "Gönderi bulunamadı." }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const text = await moderateText(user, body.content, "COMMENT", { max: COMMENT_MAX, min: 1 })
    if (!text.ok) return NextResponse.json({ error: text.error, code: text.code, hint: strikeHint(text) }, { status: text.status })

    const [comment] = await db.$transaction([
      db.comment.create({ data: { postId: post.id, authorId: user.id, content: text.text }, include: { author: { select: { id: true, name: true, image: true, role: true } } } }),
      db.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } }),
    ])
    await notify({
      userId: post.authorId, type: "POST_COMMENT", actorId: user.id, href: `/community/${post.id}`,
      title: `${user.name ?? "Biri"} fotoğrafına yorum yaptı`, body: text.text.slice(0, 140),
    })
    return NextResponse.json({
      success: true,
      comment: { id: comment.id, content: comment.content, createdAt: comment.createdAt, mine: true, canDelete: true, author: { id: user.id, name: comment.author.name, image: comment.author.image, isTeacher: comment.author.role === "TEACHER" } },
    })
  } catch (error) {
    console.error("[COMMUNITY_COMMENT_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
