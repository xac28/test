import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { validatePodcastInput } from "@/lib/podcast"
import { uniqueSlug } from "@/lib/slug"
import { notifyNewContent } from "@/lib/content-notify"

export const dynamic = "force-dynamic"

// GET /api/admin/podcast — every episode, drafts included
export async function GET(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const episodes = await db.podcastEpisode.findMany({ orderBy: [{ createdAt: "desc" }], take: 300 })
  const totals = await db.podcastEpisode.aggregate({ _sum: { plays: true }, _count: true })
  return NextResponse.json({ episodes, totalPlays: totals._sum.plays ?? 0, count: totals._count })
}

// POST /api/admin/podcast — create (optionally publish and tell the subscribers)
export async function POST(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const v = validatePodcastInput(await req.json().catch(() => ({})))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const episode = await db.podcastEpisode.create({
    data: { ...v.data, slug: uniqueSlug(v.data.title), publishedAt: v.data.status === "PUBLISHED" ? new Date() : null },
  })
  let newsletter = null
  if (v.notify && episode.status === "PUBLISHED") newsletter = await notifyNewContent("podcast", episode.id, a.admin.id).catch((e) => (console.error("[PODCAST_NOTIFY]", e), null))
  return NextResponse.json({ success: true, episode, newsletter })
}
