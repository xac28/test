import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/articles?category=Nefes — published articles, newest first (public)
export async function GET(req: Request) {
  try {
    const category = new URL(req.url).searchParams.get("category")
    const rows = await db.article.findMany({
      where: { status: "PUBLISHED", ...(category ? { category } : {}) },
      select: { id: true, slug: true, title: true, excerpt: true, category: true, coverUrl: true, publishedAt: true, author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      take: 100,
    })
    return NextResponse.json({ articles: rows })
  } catch (error) {
    console.error("[ARTICLES_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
