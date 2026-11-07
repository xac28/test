import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { scanText, findContact, findSpamShape, maskText } from "@/lib/profanity"
import { blockedWords, clearWordCache } from "@/lib/moderation"
import { fold } from "@/lib/profanity"

export const dynamic = "force-dynamic"

// GET /api/admin/moderation — what the automatic filter did, who keeps tripping it, and the extra word list
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const day = new Date(Date.now() - 86_400_000)
  const week = new Date(Date.now() - 7 * 86_400_000)
  const [byKind, total24, total7, recent, offenders, words, mutes] = await Promise.all([
    db.moderationEvent.groupBy({ by: ["kind"], where: { createdAt: { gte: week } }, _count: { _all: true } }),
    db.moderationEvent.count({ where: { createdAt: { gte: day } } }),
    db.moderationEvent.count({ where: { createdAt: { gte: week } } }),
    db.moderationEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { id: true, name: true } } } }),
    db.moderationEvent.groupBy({ by: ["userId"], where: { createdAt: { gte: week } }, _count: { _all: true }, orderBy: { _count: { userId: "desc" } }, take: 8 }),
    db.blockedWord.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    db.communityMute.findMany({ where: { until: { gt: new Date() } }, orderBy: { until: "desc" }, take: 50 }),
  ])
  const ids = Array.from(new Set([...offenders.map((o) => o.userId), ...mutes.map((m) => m.userId)]))
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : []
  const name = new Map(users.map((u) => [u.id, u]))
  return NextResponse.json({
    stats: { last24h: total24, last7d: total7, byKind: Object.fromEntries(byKind.map((k) => [k.kind, k._count._all])) },
    recent: recent.map((e) => ({ id: e.id, kind: e.kind, surface: e.surface, excerpt: e.excerpt, createdAt: e.createdAt, user: e.user })),
    offenders: offenders.map((o) => ({ user: name.get(o.userId) ?? { id: o.userId, name: null, email: null }, count: o._count._all })),
    mutes: mutes.map((m) => ({ id: m.id, until: m.until, reason: m.reason, user: name.get(m.userId) ?? { id: m.userId, name: null, email: null } })),
    words: words.map((w) => ({ id: w.id, word: w.word, createdAt: w.createdAt })),
  })
}

// POST /api/admin/moderation { action: "add-word", word } | { action: "test", text } | { action: "unmute", muteId }
export async function POST(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  if (body.action === "test") {
    const text = String(body.text ?? "").slice(0, 1000)
    const extra = await blockedWords()
    const scan = scanText(text, extra)
    return NextResponse.json({ clean: scan.clean, kinds: scan.kinds, masked: maskText(text, extra), contact: findContact(text), spam: findSpamShape(text) })
  }
  if (body.action === "add-word") {
    const word = fold(String(body.word ?? "")).replace(/[^a-z0-9ı ]/g, "").trim()
    if (word.length < 3 || word.length > 40 || word.includes(" ")) return NextResponse.json({ error: "3-40 harflik tek bir kelime girin." }, { status: 400 })
    if (await db.blockedWord.findUnique({ where: { word } })) return NextResponse.json({ error: "Bu kelime zaten listede." }, { status: 409 })
    await db.blockedWord.create({ data: { word, addedById: g.admin.id } })
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "BLOCKED_WORD_ADD", reason: word } })
    clearWordCache()
    return NextResponse.json({ success: true })
  }
  if (body.action === "unmute") {
    const m = await db.communityMute.findUnique({ where: { id: String(body.muteId ?? "") } })
    if (!m) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
    await db.communityMute.update({ where: { id: m.id }, data: { until: new Date() } })
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "UNMUTE_USER", targetId: m.userId } })
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
}

// DELETE /api/admin/moderation { id } — remove an extra blocked word
export async function DELETE(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const { id } = await req.json().catch(() => ({}))
  const w = await db.blockedWord.findUnique({ where: { id: String(id ?? "") } })
  if (!w) return NextResponse.json({ error: "Kelime bulunamadı" }, { status: 404 })
  await db.blockedWord.delete({ where: { id: w.id } })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "BLOCKED_WORD_REMOVE", reason: w.word } })
  clearWordCache()
  return NextResponse.json({ success: true })
}
