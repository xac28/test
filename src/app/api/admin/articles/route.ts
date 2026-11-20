import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { validateArticleInput } from "@/lib/articles"
import { notifyNewContent } from "@/lib/content-notify"
import { uniqueSlug } from "@/lib/slug"
import { scheduleData } from "@/lib/schedule"

export const dynamic = "force-dynamic"

async function adminOnly(req: Request) {
  const user = await resolveUser(req)
  return user && user.role === "ADMIN" ? user : null
}

// GET /api/admin/articles — everything, drafts included
export async function GET(req: Request) {
  try {
    if (!(await adminOnly(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const articles = await db.article.findMany({
      select: { id: true, slug: true, title: true, excerpt: true, category: true, status: true, publishedAt: true, scheduledAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    })
    return NextResponse.json({ articles })
  } catch (error) {
    console.error("[ADMIN_ARTICLES_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// POST /api/admin/articles
export async function POST(req: Request) {
  try {
    const admin = await adminOnly(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const input = await req.json().catch(() => ({}))
    const v = validateArticleInput(input)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const sch = scheduleData(input, v.data.status)
    if (!sch.ok) return NextResponse.json({ error: sch.error }, { status: 400 })
    const article = await db.article.create({
      data: {
        ...v.data,
        ...sch.data,
        slug: uniqueSlug(v.data.title),
        authorId: admin.id,
        publishedAt: v.data.status === "PUBLISHED" ? new Date() : null,
      },
    })
    const newsletter = input?.notify === true && article.status === "PUBLISHED" ? await notifyNewContent("article", article.id, admin.id).catch((e) => (console.error("[ARTICLE_NOTIFY]", e), null)) : null
    return NextResponse.json({ success: true, article, newsletter })
  } catch (error) {
    console.error("[ADMIN_ARTICLE_CREATE_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
