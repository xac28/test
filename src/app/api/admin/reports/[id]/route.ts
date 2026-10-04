import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { canTransition, ESCALATION_WINDOW_DAYS, sanitizeReportText } from "@/lib/reports"
import { notifyReporterOnce } from "@/lib/report-server"

export const dynamic = "force-dynamic"


// GET /api/admin/reports/:id — everything an admin needs to decide
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response
    const r = await db.report.findUnique({
      where: { id: params.id },
      include: {
        reporter: { select: { id: true, name: true, email: true, createdAt: true } },
        reported: { select: { id: true, name: true, email: true, role: true, banned: true, banReason: true, createdAt: true } },
      },
    })
    if (!r) return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 })

    const since = new Date(Date.now() - ESCALATION_WINDOW_DAYS * 86_400_000)
    const [reporterTotal, reporterDismissed, siblings, distinct, warnings, teacher, audit, handledBy] = await Promise.all([
      db.report.count({ where: { reporterId: r.reporterId } }),
      db.report.count({ where: { reporterId: r.reporterId, status: "DISMISSED" } }),
      r.reportedId
        ? db.report.findMany({
            where: { reportedId: r.reportedId, id: { not: r.id } },
            orderBy: { createdAt: "desc" },
            take: 15,
            select: { id: true, category: true, targetType: true, status: true, priority: true, createdAt: true, reporter: { select: { name: true } } },
          })
        : [],
      r.reportedId
        ? db.report.findMany({ where: { reportedId: r.reportedId, status: { not: "DISMISSED" }, createdAt: { gte: since } }, select: { reporterId: true }, distinct: ["reporterId"] })
        : [],
      r.reportedId ? db.userWarning.count({ where: { userId: r.reportedId } }) : 0,
      r.reportedId ? db.teacher.findUnique({ where: { userId: r.reportedId }, select: { id: true, isTrialMode: true } }) : null,
      db.auditLog.findMany({ where: { targetId: r.id }, orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } }, take: 50 }),
      r.handledById ? db.user.findUnique({ where: { id: r.handledById }, select: { name: true } }) : null,
    ])

    // current state of what was reported (so the admin can see whether it is still live)
    let target: Record<string, unknown> | null = null
    if (r.targetId) {
      if (r.targetType === "LIVE_ROOM" || r.targetType === "CHAT_MESSAGE") {
        const room = await db.liveRoom.findUnique({ where: { id: r.targetId }, select: { id: true, title: true, isActive: true, endedAt: true } })
        target = room && { kind: "live", ...room }
      } else if (r.targetType === "WORKSHOP") {
        const w = await db.workshop.findUnique({ where: { id: r.targetId }, select: { id: true, slug: true, title: true, status: true } })
        target = w && { kind: "workshop", ...w }
      } else if (r.targetType === "POST") {
        const post = await db.post.findUnique({ where: { id: r.targetId }, select: { id: true, status: true, image: true, content: true } })
        target = post && { kind: "post", ...post }
      } else if (r.targetType === "COMMENT") {
        const c = await db.comment.findUnique({ where: { id: r.targetId }, select: { id: true, status: true, content: true, postId: true } })
        target = c && { kind: "comment", ...c }
      }
    }

    let evidence: unknown = null
    try {
      evidence = r.evidence ? JSON.parse(r.evidence) : null
    } catch {}

    return NextResponse.json({
      report: { ...r, evidence },
      handledByName: handledBy?.name ?? null,
      reporter: { ...r.reporter, totalReports: reporterTotal, dismissedReports: reporterDismissed },
      reported: r.reported && {
        ...r.reported,
        warnings,
        distinctReporters: distinct.length,
        teacher,
      },
      siblings,
      target,
      timeline: audit.map((a) => ({ id: a.id, action: a.action, reason: a.reason, actor: a.actor?.name ?? "Sistem", createdAt: a.createdAt })),
    })
  } catch (error) {
    console.error("[ADMIN_REPORT_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// PATCH /api/admin/reports/:id { status?, adminNote?, priority? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response
    const a = g.admin
    const existing = await db.report.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    const log: string[] = []

    if (body.status !== undefined) {
      if (!canTransition(existing.status, body.status)) return NextResponse.json({ error: "Geçersiz durum değişikliği." }, { status: 400 })
      data.status = body.status
      if (body.status === "RESOLVED" || body.status === "DISMISSED") {
        data.handledById = a.id
        data.handledAt = new Date()
      } else {
        data.handledById = null
        data.handledAt = null
      }
      log.push(`durum: ${existing.status} → ${body.status}`)
    }
    if (body.adminNote !== undefined) {
      data.adminNote = sanitizeReportText(body.adminNote, 2000) || null
      log.push("not güncellendi")
    }
    if (body.priority !== undefined) {
      if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(body.priority)) return NextResponse.json({ error: "Geçersiz öncelik." }, { status: 400 })
      data.priority = body.priority
      log.push(`öncelik: ${body.priority}`)
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Değişiklik yok" }, { status: 400 })

    const report = await db.report.update({ where: { id: existing.id }, data })
    await db.auditLog.create({ data: { actorId: a.id, action: "REPORT_UPDATE", targetId: existing.id, reason: log.join(" · ") } })
    if (data.status === "RESOLVED" || data.status === "DISMISSED") notifyReporterOnce(existing.id).catch(() => {})
    return NextResponse.json({ success: true, report })
  } catch (error) {
    console.error("[ADMIN_REPORT_PATCH_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
