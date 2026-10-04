import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf, cleanReason } from "@/lib/admin-api"
import { keysFromInput, keysFromQuestion, parseKeys, safeHref } from "@/lib/ai-learning"
import { normalize } from "@/lib/ai-guide"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

// GET /api/admin/ai?view=overview|unknown|unhelpful|taught&page=&q=
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const view = url.searchParams.get("view") || "overview"
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const { page, size, skip } = pageOf(url, 15)
  const week = new Date(Date.now() - 7 * 86_400_000)

  if (view === "overview") {
    const [asked7, unknownOpen, good, bad, byKind, handoffs, topUnknown] = await Promise.all([
      db.aiInteraction.count({ where: { createdAt: { gte: week } } }),
      db.aiInteraction.count({ where: { kind: "unknown", taught: false, dismissed: false } }),
      db.aiInteraction.count({ where: { helpful: true, createdAt: { gte: week } } }),
      db.aiInteraction.count({ where: { helpful: false, createdAt: { gte: week } } }),
      db.aiInteraction.groupBy({ by: ["kind"], where: { createdAt: { gte: week } }, _count: { _all: true } }),
      db.supportTicket.count({ where: { source: { in: ["AI_UNHELPFUL", "AI_REQUEST"] }, createdAt: { gte: week } } }),
      db.aiInteraction.groupBy({ by: ["norm"], where: { kind: "unknown", taught: false, dismissed: false }, _count: { _all: true }, orderBy: { _count: { norm: "desc" } }, take: 5 }),
    ])
    const rated = good + bad
    return NextResponse.json({
      asked7, unknownOpen, good, bad, handoffs,
      helpfulRate: rated ? Math.round((good / rated) * 100) : null,
      unknownRate: asked7 ? Math.round(((byKind.find((k) => k.kind === "unknown")?._count._all ?? 0) / asked7) * 100) : 0,
      byKind: Object.fromEntries(byKind.map((k) => [k.kind, k._count._all])),
      topUnknown: topUnknown.map((t) => ({ norm: t.norm, count: t._count._all })),
      taughtCount: await db.aiTaughtAnswer.count({ where: { active: true } }),
    })
  }

  if (view === "unknown") {
    const where: any = { kind: "unknown", taught: false, dismissed: false, ...(q ? { norm: { contains: normalize(q) } } : {}) }
    const groups = await db.aiInteraction.groupBy({ by: ["norm"], where, _count: { _all: true }, _max: { createdAt: true }, orderBy: [{ _count: { norm: "desc" } }, { norm: "asc" }], skip, take: size })
    const totalGroups = (await db.aiInteraction.groupBy({ by: ["norm"], where })).length
    const samples = groups.length ? await db.aiInteraction.findMany({ where: { ...where, norm: { in: groups.map((x) => x.norm) } }, orderBy: { createdAt: "desc" }, select: { norm: true, message: true, userId: true } }) : []
    const first = new Map<string, { message: string; users: Set<string> }>()
    for (const s of samples) {
      const e = first.get(s.norm) ?? { message: s.message, users: new Set<string>() }
      if (s.userId) e.users.add(s.userId)
      first.set(s.norm, e)
    }
    return NextResponse.json({
      items: groups.map((x) => ({ norm: x.norm, count: x._count._all, lastAt: x._max.createdAt, sample: first.get(x.norm)?.message ?? x.norm, askers: first.get(x.norm)?.users.size ?? 0 })),
      total: totalGroups, page, pageSize: size,
    })
  }

  if (view === "unhelpful") {
    const where: any = { helpful: false, ...(q ? { norm: { contains: normalize(q) } } : {}) }
    const [rows, total] = await Promise.all([
      db.aiInteraction.findMany({ where, orderBy: { feedbackAt: "desc" }, skip, take: size }),
      db.aiInteraction.count({ where }),
    ])
    const ids = rows.map((r) => r.matchedId).filter((x): x is string => !!x)
    const taught = ids.length ? await db.aiTaughtAnswer.findMany({ where: { id: { in: ids } }, select: { id: true, question: true } }) : []
    const tq = new Map(taught.map((t) => [t.id, t.question]))
    return NextResponse.json({
      items: rows.map((r) => ({ id: r.id, message: r.message, norm: r.norm, kind: r.kind, intent: r.intent, matched: r.matchedId ? tq.get(r.matchedId) ?? null : null, taught: r.taught, at: r.feedbackAt ?? r.createdAt })),
      total, page, pageSize: size,
    })
  }

  if (view === "taught") {
    const where: any = q ? { OR: [{ question: { contains: q } }, { answer: { contains: q } }] } : {}
    const [rows, total] = await Promise.all([
      db.aiTaughtAnswer.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take: size }),
      db.aiTaughtAnswer.count({ where }),
    ])
    return NextResponse.json({
      items: rows.map((r) => ({ id: r.id, question: r.question, keys: parseKeys(r.keys), answer: r.answer, linkLabel: r.linkLabel, linkHref: r.linkHref, active: r.active, hits: r.hits, helpful: r.helpful, unhelpful: r.unhelpful, updatedAt: r.updatedAt })),
      total, page, pageSize: size,
    })
  }
  return NextResponse.json({ error: "Geçersiz görünüm" }, { status: 400 })
}

// POST /api/admin/ai { action: teach | dismiss }
//   teach:   { question, answer, keywords?, linkLabel?, linkHref?, norm? }  → new taught answer; the matching asked questions are marked done and signed-in askers are told
//   dismiss: { norm }                                                        → "needs no answer" (spam, nonsense)
export async function POST(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))

  if (body.action === "dismiss") {
    const norm = typeof body.norm === "string" ? body.norm.slice(0, 500) : ""
    if (!norm) return NextResponse.json({ error: "Soru gerekli" }, { status: 400 })
    const r = await db.aiInteraction.updateMany({ where: { norm, kind: "unknown" }, data: { dismissed: true } })
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "AI_DISMISS", reason: norm.slice(0, 200) } })
    return NextResponse.json({ success: true, updated: r.count })
  }

  if (body.action === "teach") {
    const question = cleanReason(body.question, 300)
    const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 2000) : ""
    if (question.length < 3) return NextResponse.json({ error: "Soru en az 3 karakter olmalı." }, { status: 400 })
    if (answer.length < 5) return NextResponse.json({ error: "Cevap en az 5 karakter olmalı." }, { status: 400 })
    let keys = keysFromInput(body.keywords)
    if (!keys.length) keys = keysFromQuestion(question)
    if (!keys.length) return NextResponse.json({ error: "Soru çok kısa; anahtar kelimeleri elle girin." }, { status: 400 })
    const href = body.linkHref ? safeHref(body.linkHref) : null
    if (body.linkHref && !href) return NextResponse.json({ error: "Bağlantı '/sayfa' ya da 'https://…' biçiminde olmalı." }, { status: 400 })
    const row = await db.aiTaughtAnswer.create({
      data: { question, keys: JSON.stringify(keys), answer, linkLabel: href ? cleanReason(body.linkLabel, 60) || "Devamı" : null, linkHref: href, createdById: g.admin.id },
    })
    let notified = 0
    const norm = typeof body.norm === "string" && body.norm ? body.norm.slice(0, 500) : normalize(question)
    const askers = await db.aiInteraction.findMany({ where: { norm, kind: "unknown", taught: false }, select: { userId: true } })
    await db.aiInteraction.updateMany({ where: { norm, kind: "unknown" }, data: { taught: true } })
    for (const uid of Array.from(new Set(askers.map((a) => a.userId).filter((x): x is string => !!x))).slice(0, 50)) {
      await notify({ userId: uid, type: "SYSTEM", title: "Sorduğun soruya cevap ekledik", body: "AYA Rehber artık bunu yanıtlayabiliyor; tekrar sorabilirsin.", href: "/", push: false })
      notified++
    }
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "AI_TEACH", targetId: row.id, reason: question.slice(0, 200) } })
    return NextResponse.json({ success: true, id: row.id, notified })
  }
  return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
}
