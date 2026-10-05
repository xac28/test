import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf, cleanReason, wantsCsv, CSV_LIMIT } from "@/lib/admin-api"
import { csvResponse, toCsv } from "@/lib/csv"
import { PoachKind, scanPoaching } from "@/lib/poaching"
import { SUSPEND_DAYS, activeStrikes, recordViolation } from "@/lib/policy"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

// GET /api/admin/policy?view=violations|users|scan&q=&page=&format=csv
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const view = url.searchParams.get("view") || "violations"
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const csv = wantsCsv(url)
  const { page, size, skip } = pageOf(url, 20)
  const now = new Date()

  if (view === "violations") {
    const where: any = {}
    if (q) {
      const users = await db.user.findMany({ where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] }, select: { id: true }, take: 50 })
      where.OR = [{ excerpt: { contains: q } }, { userId: q }, ...(users.length ? [{ userId: { in: users.map((u) => u.id) } }] : [])]
    }
    const [rows, total, d1, d7, suspended, bannedByPolicy, byKindRows] = await Promise.all([
      db.policyViolation.findMany({ where, orderBy: { createdAt: "desc" }, skip: csv ? 0 : skip, take: csv ? CSV_LIMIT : size }),
      db.policyViolation.count({ where }),
      db.policyViolation.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      db.policyViolation.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
      db.user.count({ where: { suspendedUntil: { gt: now } } }),
      db.policyViolation.count({ where: { action: "BANNED" } }),
      db.policyViolation.findMany({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, select: { kinds: true }, take: 5000 }),
    ])
    const ids = Array.from(new Set(rows.map((r) => r.userId)))
    const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, banned: true, suspendedUntil: true } }) : []
    const u = new Map(users.map((x) => [x.id, x]))
    if (csv) {
      return csvResponse("politika-ihlalleri", toCsv(["Zaman", "Eğitmen", "E-posta", "Yer", "Tür", "Sayıldı", "Affedildi", "İhlal no", "Sonuç", "Metin"], rows.map((r) => [r.createdAt, u.get(r.userId)?.name, u.get(r.userId)?.email, r.surface, r.kinds, r.counted ? "evet" : "hayır", r.forgiven ? "evet" : "hayır", r.strike, r.action, r.excerpt])))
    }
    const byKind: Record<string, number> = {}
    for (const r of byKindRows) for (const k of r.kinds.split(",").filter(Boolean)) byKind[k] = (byKind[k] ?? 0) + 1
    return NextResponse.json({
      violations: rows.map((r) => ({
        id: r.id, surface: r.surface, kinds: r.kinds.split(",").filter(Boolean), excerpt: r.excerpt, counted: r.counted, forgiven: r.forgiven, strike: r.strike, action: r.action, createdAt: r.createdAt,
        user: u.get(r.userId) ?? { id: r.userId, name: null, email: null, banned: false, suspendedUntil: null },
      })),
      total, page, pageSize: size,
      stats: { last24h: d1, last7d: d7, suspendedNow: suspended, bannedByPolicy, byKind, suspendDays: SUSPEND_DAYS },
    })
  }

  if (view === "users") {
    let userIds: string[] | null = null
    if (q) userIds = (await db.user.findMany({ where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] }, select: { id: true }, take: 200 })).map((x) => x.id)
    const where = { counted: true, forgiven: false, ...(userIds ? { userId: { in: userIds } } : {}) }
    const groups = await db.policyViolation.groupBy({ by: ["userId"], where, _count: { _all: true }, _max: { createdAt: true }, orderBy: [{ _count: { userId: "desc" } }, { _max: { createdAt: "desc" } }], skip, take: size })
    const total = (await db.policyViolation.groupBy({ by: ["userId"], where })).length
    const users = groups.length ? await db.user.findMany({ where: { id: { in: groups.map((x) => x.userId) } }, select: { id: true, name: true, email: true, banned: true, suspendedUntil: true, suspensionReason: true } }) : []
    const u = new Map(users.map((x) => [x.id, x]))
    return NextResponse.json({
      items: groups.map((x) => ({ strikes: x._count._all, lastAt: x._max.createdAt, user: u.get(x.userId) ?? { id: x.userId, name: null, email: null, banned: false, suspendedUntil: null, suspensionReason: null } })),
      total, page, pageSize: size,
    })
  }

  if (view === "scan") {
    // existing public texts of teachers that already contain off-platform pointers
    const hits: { owner: { id: string; name: string | null; email: string | null }; field: string; where: string; text: string; kinds: PoachKind[]; matches: string[] }[] = []
    const [teachers, workshops, videos] = await Promise.all([
      db.teacher.findMany({ where: { bio: { not: null } }, select: { bio: true, user: { select: { id: true, name: true, email: true } } }, take: 3000 }),
      db.workshop.findMany({ where: { status: "PUBLISHED" }, select: { title: true, subtitle: true, description: true, slug: true, teacher: { select: { user: { select: { id: true, name: true, email: true } } } } }, take: 3000 }),
      db.teacherVideo.findMany({ select: { title: true, description: true, teacher: { select: { user: { select: { id: true, name: true, email: true } } } } }, take: 3000 }),
    ])
    const push = (owner: any, field: string, where: string, text: string | null | undefined) => {
      if (!text) return
      const r = scanPoaching(text, { teacher: true })
      if (!r.clean) hits.push({ owner, field, where, text: text.replace(/\s+/g, " ").slice(0, 240), kinds: r.kinds, matches: r.matches })
    }
    for (const t of teachers) push(t.user, "Profil metni", "/teachers", t.bio)
    for (const w of workshops) { push(w.teacher.user, "Atölye başlığı", `/atolyeler/${w.slug}`, `${w.title} ${w.subtitle ?? ""}`); push(w.teacher.user, "Atölye açıklaması", `/atolyeler/${w.slug}`, w.description) }
    for (const v of videos) push(v.teacher.user, "Video", "/teachers", `${v.title} ${v.description ?? ""}`)
    const filtered = q ? hits.filter((h) => (h.owner.name ?? "").toLowerCase().includes(q.toLowerCase()) || (h.owner.email ?? "").toLowerCase().includes(q.toLowerCase())) : hits
    return NextResponse.json({ hits: filtered.slice(skip, skip + size), total: filtered.length, page, pageSize: size })
  }
  return NextResponse.json({ error: "Geçersiz görünüm" }, { status: 400 })
}

// POST /api/admin/policy { action: forgive | lift | suspend | record, … }
export async function POST(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))

  if (body.action === "forgive") {
    const v = await db.policyViolation.findUnique({ where: { id: String(body.id ?? "") } })
    if (!v) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
    if (v.forgiven) return NextResponse.json({ error: "Zaten affedilmiş." }, { status: 409 })
    await db.policyViolation.update({ where: { id: v.id }, data: { forgiven: true, forgivenById: g.admin.id } })
    const left = await activeStrikes(v.userId)
    let lifted = false
    // a forgiven false positive must not leave the teacher suspended
    if (left < 2) {
      const u = await db.user.findUnique({ where: { id: v.userId }, select: { suspendedUntil: true, banned: true, banReason: true } })
      if (u?.suspendedUntil && u.suspendedUntil.getTime() > Date.now()) { await db.user.update({ where: { id: v.userId }, data: { suspendedUntil: null, suspensionReason: null } }); lifted = true }
      if (u?.banned && u.banReason?.startsWith("Otomatik: platform dışına yönlendirme") && left < 3) {
        const { applyFullUnban } = await import("@/lib/ban-engine")
        await applyFullUnban(v.userId, g.admin.id).catch(() => {})
        lifted = true
      }
    }
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "POLICY_FORGIVE", targetId: v.userId, reason: `İhlal affedildi (${v.surface}): ${cleanReason(body.reason, 200) || v.excerpt.slice(0, 120)}` } })
    return NextResponse.json({ success: true, strikesLeft: left, lifted })
  }

  if (body.action === "lift") {
    const userId = String(body.userId ?? "")
    const u = await db.user.findUnique({ where: { id: userId }, select: { suspendedUntil: true } })
    if (!u?.suspendedUntil || u.suspendedUntil.getTime() <= Date.now()) return NextResponse.json({ error: "Kullanıcı uzaklaştırılmış değil." }, { status: 409 })
    await db.user.update({ where: { id: userId }, data: { suspendedUntil: null, suspensionReason: null } })
    await notify({ userId, type: "SYSTEM", title: "Uzaklaştırman kaldırıldı", body: "Yeniden ders, yayın ve paylaşım yapabilirsin. Lütfen platform kurallarına dikkat et.", href: "/dashboard", push: false })
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "POLICY_LIFT", targetId: userId, reason: cleanReason(body.reason, 200) || "Uzaklaştırma kaldırıldı" } })
    return NextResponse.json({ success: true })
  }

  if (body.action === "suspend") {
    const userId = String(body.userId ?? "")
    const reason = cleanReason(body.reason, 280)
    const days = Math.min(90, Math.max(1, parseInt(body.days) || SUSPEND_DAYS))
    if (reason.length < 5) return NextResponse.json({ error: "Gerekçe yazın (en az 5 karakter)." }, { status: 400 })
    const u = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (!u || u.role === "ADMIN") return NextResponse.json({ error: "Bu kullanıcı uzaklaştırılamaz." }, { status: 400 })
    const until = new Date(Date.now() + days * 86_400_000)
    await db.user.update({ where: { id: userId }, data: { suspendedUntil: until, suspensionReason: reason } })
    await notify({ userId, type: "WARNING", title: `${days} gün uzaklaştırıldın`, body: reason, href: "/dashboard" })
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "POLICY_SUSPEND", targetId: userId, reason: `${days} gün: ${reason}` } })
    return NextResponse.json({ success: true, until })
  }

  if (body.action === "record") {
    // turn a hit from the content scan into a counted violation (warning / suspension / ban ladder)
    const userId = String(body.userId ?? "")
    const text = typeof body.text === "string" ? body.text : ""
    const poach = scanPoaching(text, { teacher: true })
    if (poach.clean) return NextResponse.json({ error: "Metinde ihlal bulunamadı." }, { status: 400 })
    const out = await recordViolation({ userId, surface: "SCAN", poach, text })
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "POLICY_RECORD", targetId: userId, reason: `${out.strike}. ihlal olarak kaydedildi (${out.action})` } })
    return NextResponse.json({ success: true, outcome: { strike: out.strike, action: out.action } })
  }
  return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
}

