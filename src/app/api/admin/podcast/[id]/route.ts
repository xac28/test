import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { validatePodcastInput } from "@/lib/podcast"
import { notifyNewContent } from "@/lib/content-notify"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const episode = await db.podcastEpisode.findUnique({ where: { id: params.id } })
  return episode ? NextResponse.json({ episode }) : NextResponse.json({ error: "Bölüm bulunamadı" }, { status: 404 })
}

// PATCH — edit, publish, unpublish
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const existing = await db.podcastEpisode.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: "Bölüm bulunamadı" }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const v = validatePodcastInput({ ...existing, ...body })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const publishing = v.data.status === "PUBLISHED" && existing.status !== "PUBLISHED"
  const episode = await db.podcastEpisode.update({
    where: { id: params.id },
    data: { ...v.data, ...(publishing ? { publishedAt: new Date() } : {}), ...(v.data.status === "DRAFT" ? { publishedAt: null } : {}) },
  })
  let newsletter = null
  if (v.notify && episode.status === "PUBLISHED") newsletter = await notifyNewContent("podcast", episode.id, a.admin.id).catch((e) => (console.error("[PODCAST_NOTIFY]", e), null))
  return NextResponse.json({ success: true, episode, newsletter })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  await db.podcastEpisode.deleteMany({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
