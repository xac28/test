import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { validateArticleInput } from "@/lib/articles"
import { notifyNewContent } from "@/lib/content-notify"
import { scheduleData } from "@/lib/schedule"

async function adminOnly(req: Request) {
  const user = await resolveUser(req)
  return user && user.role === "ADMIN" ? user : null
}

// GET one (full body) for the editor
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await adminOnly(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const article = await db.article.findUnique({ where: { id: params.id } })
  if (!article) return NextResponse.json({ error: "Yazı bulunamadı" }, { status: 404 })
  return NextResponse.json({ article })
}

// PATCH — edit / publish / unpublish
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await adminOnly(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const existing = await db.article.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: "Yazı bulunamadı" }, { status: 404 })
    const body = await req.json().catch(() => ({}))
    const v = validateArticleInput({ ...existing, ...body })
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const publishing = v.data.status === "PUBLISHED" && existing.status !== "PUBLISHED"
    const sch = scheduleData(body, v.data.status, existing, new Date(), v.data.status === "DRAFT" && existing.status === "PUBLISHED")
    if (!sch.ok) return NextResponse.json({ error: sch.error }, { status: 400 })
    const article = await db.article.update({
      where: { id: params.id },
      data: {
        ...v.data,
        ...sch.data,
        ...(publishing ? { publishedAt: new Date() } : {}),
        ...(v.data.status === "DRAFT" ? { publishedAt: null } : {}),
      },
    })
    const newsletter = body?.notify === true && article.status === "PUBLISHED" ? await notifyNewContent("article", article.id, admin.id).catch((e) => (console.error("[ARTICLE_NOTIFY]", e), null)) : null
    return NextResponse.json({ success: true, article, newsletter })
  } catch (error) {
    console.error("[ADMIN_ARTICLE_PATCH_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await adminOnly(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await db.article.deleteMany({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
