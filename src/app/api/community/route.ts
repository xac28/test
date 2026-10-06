import { db } from "@/lib/db"
import { emailGate } from "@/lib/email-verification"
import { suspensionGate } from "@/lib/policy"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_API, RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { MAX_POSTS_PER_HOUR, PAGE_SIZE, POST_MAX, isOwnUpload, likedSet, optionalUser, postInclude, serializePost, statusForNewPost } from "@/lib/community"
import { moderateText, strikeHint } from "@/lib/moderation"
import { notifyAdminsInApp } from "@/lib/notifications"

export const dynamic = "force-dynamic"

// GET /api/community?cursor=<postId>&author=<userId>&mine=1&teachers=1 — the photo feed (public); `mine` also lists own pending/removed posts
export async function GET(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_API)
  if (blocked) return blocked
  try {
    const viewer = await optionalUser(req)
    const url = new URL(req.url)
    const cursor = url.searchParams.get("cursor")
    const author = url.searchParams.get("author")
    const mine = url.searchParams.get("mine") === "1" && viewer
    const teachers = url.searchParams.get("teachers") === "1"
    const where: any = mine
      ? { authorId: viewer!.id }
      : { status: "VISIBLE", ...(author ? { authorId: author } : {}), author: { banned: false, ...(teachers ? { role: "TEACHER" } : {}) } }
    const rows = await db.post.findMany({
      where, include: postInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const page = rows.slice(0, PAGE_SIZE)
    const liked = await likedSet(viewer?.id, page.map((p) => p.id))
    return NextResponse.json({ posts: page.map((p) => serializePost(p, viewer, liked)), nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null })
  } catch (error) {
    console.error("[COMMUNITY_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

// POST /api/community { content, image, title? } — share a photo
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Paylaşım yapmak için giriş yapın." }, { status: 401 })
    const gate = termsGate(user)
    if (gate) return gate
    const verifyBlock = await emailGate(user.id)
    if (verifyBlock) return verifyBlock
    const susp = await suspensionGate(user.id)
    if (susp) return susp

    const body = await req.json().catch(() => ({}))
    if (!(await isOwnUpload(body.image, user.id))) return NextResponse.json({ error: "Önce bir fotoğraf yükleyin.", code: "NO_PHOTO" }, { status: 400 })

    const lastHour = await db.post.count({ where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } } })
    if (lastHour >= MAX_POSTS_PER_HOUR) return NextResponse.json({ error: "Saatte en fazla 5 fotoğraf paylaşabilirsin.", code: "RATE_LIMIT" }, { status: 429 })

    const text = await moderateText(user, body.content, "POST", { max: POST_MAX, min: 3 })
    if (!text.ok) return NextResponse.json({ error: text.error, code: text.code, hint: strikeHint(text), policy: text.policy ? { strike: text.policy.strike, action: text.policy.action } : undefined }, { status: text.status })
    let title: string | null = null
    if (typeof body.title === "string" && body.title.trim()) {
      const t = await moderateText(user, body.title, "POST", { max: 120, min: 2 })
      if (!t.ok) return NextResponse.json({ error: t.error, code: t.code, hint: strikeHint(t) }, { status: t.status })
      title = t.text
    }

    const status = await statusForNewPost(user)
    const post = await db.post.create({
      data: { authorId: user.id, content: text.text, title, image: body.image, mediaType: "image", status },
      include: postInclude,
    })
    if (status === "PENDING") await notifyAdminsInApp("Onay bekleyen fotoğraf", `${post.author.name ?? "Bir üye"} yeni bir fotoğraf paylaştı.`, "/admin?tab=community")
    return NextResponse.json({ success: true, post: serializePost(post, user, new Set()), pending: status === "PENDING" })
  } catch (error) {
    console.error("[COMMUNITY_CREATE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
