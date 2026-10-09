import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { SITE_URL } from "@/lib/site"
import { formatKurus } from "@/lib/shop"
import { NEWS_CATEGORIES, NON_EDITORIAL_CATEGORIES } from "@/lib/articles"
import { checkArticle, draftNewsletter, summarize, titleIdeas } from "@/lib/writing"

export const dynamic = "force-dynamic"

const DAY = 86_400_000

// GET /api/admin/writing?draft=newsletter&days=7 — a newsletter text from what was published lately (the editor can change everything)
export async function GET(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const url = new URL(req.url)
  if (url.searchParams.get("draft") !== "newsletter") return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 })
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get("days")) || 7))
  const now = new Date()
  const since = new Date(now.getTime() - days * DAY)
  const [articles, news, episodes, products, workshops] = await Promise.all([
    db.article.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since }, category: { notIn: NON_EDITORIAL_CATEGORIES } }, select: { title: true, excerpt: true, slug: true }, orderBy: { publishedAt: "desc" }, take: 5 }),
    db.article.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since }, category: { in: [...NEWS_CATEGORIES] } }, select: { title: true, excerpt: true, slug: true }, orderBy: { publishedAt: "desc" }, take: 5 }),
    db.podcastEpisode.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since } }, select: { title: true, guest: true, slug: true }, orderBy: { publishedAt: "desc" }, take: 3 }),
    db.product.findMany({ where: { status: "PUBLISHED", stock: { gt: 0 }, createdAt: { gte: since } }, select: { name: true, slug: true, priceKurus: true }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.workshop.findMany({ where: { status: "PUBLISHED", mode: "LIVE", startsAt: { gt: now, lte: new Date(now.getTime() + 14 * DAY) } }, select: { title: true, slug: true, startsAt: true }, orderBy: { startsAt: "asc" }, take: 4 }),
  ])
  const draft = draftNewsletter({
    articles: articles.map((x) => ({ title: x.title, excerpt: x.excerpt, url: `${SITE_URL}/icerikler/${x.slug}` })),
    news: news.map((x) => ({ title: x.title, excerpt: x.excerpt, url: `${SITE_URL}/icerikler/${x.slug}` })),
    episodes: episodes.map((x) => ({ title: x.title, guest: x.guest, url: `${SITE_URL}/podcast/${x.slug}` })),
    products: products.map((x) => ({ name: x.name, price: formatKurus(x.priceKurus), url: `${SITE_URL}/shop/urun/${x.slug}` })),
    workshops: workshops.map((x) => ({ title: x.title, when: x.startsAt!.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" }), url: `${SITE_URL}/atolyeler/${x.slug}` })),
  }, { site: SITE_URL })
  return NextResponse.json({ ...draft, days })
}

// POST /api/admin/writing { action: "summary" | "titles" | "check", title?, excerpt?, body, coverUrl?, max? } — the same helpers the editors use in the browser
export async function POST(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const b = await req.json().catch(() => ({}))
  const body = typeof b.body === "string" ? b.body.slice(0, 120_000) : ""
  if (!body.trim()) return NextResponse.json({ error: "Önce yazıyı yaz." }, { status: 400 })
  if (b.action === "summary") return NextResponse.json({ summary: summarize(body, { max: Math.min(400, Math.max(60, Number(b.max) || 200)) }) })
  if (b.action === "titles") return NextResponse.json({ titles: titleIdeas(body, typeof b.title === "string" ? b.title : "") })
  if (b.action === "check") return NextResponse.json(checkArticle({ title: String(b.title ?? ""), excerpt: String(b.excerpt ?? ""), body, coverUrl: b.coverUrl ?? null }))
  return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 })
}
