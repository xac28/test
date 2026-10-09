import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { notify } from "@/lib/notifications"

// POST /api/community/:id/like — toggles the like; returns the new state and count
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, { maxRequests: 60, windowMs: 60_000 })
  if (blocked) return blocked
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Beğenmek için giriş yapın." }, { status: 401 })
    const gate = termsGate(user)
    if (gate) return gate
    const post = await db.post.findUnique({ where: { id: params.id }, select: { id: true, status: true, authorId: true, author: { select: { name: true } } } })
    if (!post || post.status !== "VISIBLE") return NextResponse.json({ error: "Gönderi bulunamadı." }, { status: 404 })

    const existing = await db.like.findUnique({ where: { postId_userId: { postId: post.id, userId: user.id } } })
    if (existing) {
      const [, p] = await db.$transaction([
        db.like.delete({ where: { id: existing.id } }),
        db.post.update({ where: { id: post.id }, data: { likeCount: { decrement: 1 } }, select: { likeCount: true } }),
      ])
      return NextResponse.json({ liked: false, likeCount: Math.max(0, p.likeCount) })
    }
    let likeCount: number
    try {
      const [, p] = await db.$transaction([
        db.like.create({ data: { postId: post.id, userId: user.id } }),
        db.post.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } }, select: { likeCount: true } }),
      ])
      likeCount = p.likeCount
    } catch {
      // two taps at once: the unique index made the second one fail, the like exists
      const p = await db.post.findUnique({ where: { id: post.id }, select: { likeCount: true } })
      return NextResponse.json({ liked: true, likeCount: p?.likeCount ?? 0 })
    }
    await notify({
      userId: post.authorId, type: "POST_LIKE", actorId: user.id, groupKey: `like:${post.id}`, href: `/community/${post.id}`,
      title: `${user.name ?? "Biri"} fotoğrafını beğendi`,
      groupTitle: (n) => `${user.name ?? "Biri"} ve ${n - 1} kişi daha fotoğrafını beğendi`,
    })
    return NextResponse.json({ liked: true, likeCount })
  } catch (error) {
    console.error("[COMMUNITY_LIKE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
