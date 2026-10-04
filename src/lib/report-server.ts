import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { notify } from "@/lib/notifications"
import { applyFullBan } from "@/lib/ban-engine"
import { endLiveRoom } from "@/lib/live-rooms"
import { decideTrial } from "@/lib/trial-server"
import {
  ADMIN_ACTION_LABEL_TR,
  AdminAction,
  CATEGORY_LABEL_TR,
  DUPLICATE_WINDOW_HOURS,
  ESCALATION_THRESHOLD,
  ESCALATION_WINDOW_DAYS,
  PRIORITY_RANK,
  ReportInput,
  TARGET_LABEL_TR,
  computePriority,
  sanitizeReportText,
  validateReportInput,
  withinRateLimit,
  OPEN_STATUSES,
} from "@/lib/reports"

const HOUR = 3_600_000
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const baseUrl = () => process.env.NEXTAUTH_URL || "http://localhost:3000"

type Err = { ok: false; status: number; error: string; code?: string }

/** Emails every admin (best effort; never blocks the request). */
export async function notifyAdmins(subject: string, html: string) {
  try {
    const admins = await db.user.findMany({ where: { role: "ADMIN", banned: false, email: { not: null } }, select: { email: true } })
    for (const a of admins) if (a.email) sendEmail({ to: a.email, subject, html }).catch(() => {})
  } catch {}
}

interface Resolved {
  ok: true
  reportedId: string | null
  evidence: Record<string, unknown>
}

/** Work out who is being reported, check the reporter is allowed to report it, and snapshot the context. */
async function resolveTarget(
  user: { id: string },
  data: { targetType: string; targetId: string; message: { text: string; senderIdentity: string; senderName: string; sentAt: number } | null }
): Promise<Resolved | Err> {
  const notFound: Err = { ok: false, status: 404, error: "Bildirilmek istenen içerik bulunamadı." }
  switch (data.targetType) {
    case "TEACHER": {
      let t = await db.teacher.findFirst({ where: { OR: [{ id: data.targetId }, { userId: data.targetId }] }, include: { user: { select: { id: true, name: true } } } })
      if (!t) {
        // public profile pages are addressed by a name slug ("ayse-yilmaz")
        const wanted = data.targetId.toLowerCase().replace(/-/g, " ")
        const all = await db.teacher.findMany({ include: { user: { select: { id: true, name: true } } } })
        t = all.find((x) => x.user.name?.toLowerCase().replace(/-/g, " ") === wanted) ?? null
      }
      if (!t) return notFound
      return { ok: true, reportedId: t.userId, evidence: { label: t.user.name, kind: "Eğitmen profili", teacherId: t.id, approved: !t.isTrialMode } }
    }
    case "LIVE_ROOM": {
      const r = await db.liveRoom.findUnique({ where: { id: data.targetId }, include: { teacher: { include: { user: { select: { id: true, name: true } } } } } })
      if (!r) return notFound
      return { ok: true, reportedId: r.teacher.userId, evidence: { label: r.title, teacher: r.teacher.user.name, startedAt: r.createdAt, endedAt: r.endedAt, active: r.isActive, workshopId: r.workshopId } }
    }
    case "WORKSHOP": {
      const w = await db.workshop.findUnique({ where: { id: data.targetId }, include: { teacher: true } })
      if (!w) return notFound
      return { ok: true, reportedId: w.teacher.userId, evidence: { label: w.title, slug: w.slug, status: w.status, mode: w.mode, startsAt: w.startsAt } }
    }
    case "BOOKING": {
      const b = await db.booking.findUnique({ where: { id: data.targetId }, include: { teacher: true } })
      if (!b) return notFound
      const isStudent = b.studentId === user.id
      const isTeacher = b.teacher.userId === user.id
      if (!isStudent && !isTeacher) return { ok: false, status: 403, error: "Yalnızca katıldığınız dersleri bildirebilirsiniz." }
      return {
        ok: true,
        reportedId: isStudent ? b.teacher.userId : b.studentId,
        evidence: { label: `Ders ${b.startTime.toISOString()}`, status: b.status, startTime: b.startTime, endTime: b.endTime, reporterRole: isStudent ? "student" : "teacher" },
      }
    }
    case "CHAT_MESSAGE": {
      const r = await db.liveRoom.findUnique({ where: { id: data.targetId }, select: { id: true, title: true, teacherId: true } })
      if (!r || !data.message) return notFound
      const sender = await db.user.findUnique({ where: { id: data.message.senderIdentity }, select: { id: true, name: true } })
      return {
        ok: true,
        reportedId: sender?.id ?? null,
        evidence: { label: `Sohbet · ${r.title}`, roomId: r.id, message: data.message, reporterSupplied: true, senderKnown: !!sender },
      }
    }
    case "POST": {
      const post = await db.post.findUnique({ where: { id: data.targetId }, include: { author: { select: { id: true, name: true } } } })
      if (!post || post.status === "REMOVED") return notFound
      return { ok: true, reportedId: post.authorId, evidence: { label: `Fotoğraf · ${post.author.name ?? ""}`, postId: post.id, caption: post.content.slice(0, 300), image: post.image, status: post.status } }
    }
    case "COMMENT": {
      const c = await db.comment.findUnique({ where: { id: data.targetId }, include: { author: { select: { id: true, name: true } } } })
      if (!c || c.status === "REMOVED") return notFound
      return { ok: true, reportedId: c.authorId, evidence: { label: `Yorum · ${c.author.name ?? ""}`, postId: c.postId, commentText: c.content.slice(0, 300), status: c.status } }
    }
  }
  return notFound
}

export type CreateResult = { ok: true; id: string; priority: string } | Err

export async function createReport(user: { id: string; name: string | null }, input: ReportInput): Promise<CreateResult> {
  const v = validateReportInput(input)
  if (!v.ok) return { ok: false, status: 400, error: v.error }
  const { targetType, targetId, category, description, message } = v.data

  const now = Date.now()
  const [lastHour, lastDay] = await Promise.all([
    db.report.count({ where: { reporterId: user.id, createdAt: { gte: new Date(now - HOUR) } } }),
    db.report.count({ where: { reporterId: user.id, createdAt: { gte: new Date(now - 24 * HOUR) } } }),
  ])
  const rate = withinRateLimit({ lastHour, lastDay })
  if (!rate.ok) return { ok: false, status: 429, error: rate.error, code: "RATE_LIMIT" }

  const target = await resolveTarget(user, { targetType, targetId, message })
  if (!target.ok) return target
  if (target.reportedId === user.id) return { ok: false, status: 400, error: "Kendinizi bildiremezsiniz.", code: "SELF" }

  // one open report per reporter and target (a chat message is identified by its text and sender)
  const dupWhere: Record<string, unknown> = {
    reporterId: user.id, targetType, targetId,
    status: { in: OPEN_STATUSES },
    createdAt: { gte: new Date(now - DUPLICATE_WINDOW_HOURS * HOUR) },
  }
  const dupes = await db.report.findMany({ where: dupWhere as any, select: { evidence: true } })
  const isDuplicate =
    targetType === "CHAT_MESSAGE"
      ? dupes.some((d) => {
          try {
            const m = JSON.parse(d.evidence || "{}").message
            return m?.text === message!.text && m?.senderIdentity === message!.senderIdentity
          } catch {
            return false
          }
        })
      : dupes.length > 0
  if (isDuplicate) return { ok: false, status: 409, error: "Bu içeriği zaten bildirdiniz; bildiriminiz inceleniyor.", code: "DUPLICATE" }

  // how many different people have reported this user lately (including this reporter)?
  let distinct = 1
  if (target.reportedId) {
    const since = new Date(now - ESCALATION_WINDOW_DAYS * 24 * HOUR)
    const others = await db.report.findMany({
      where: { reportedId: target.reportedId, status: { not: "DISMISSED" }, createdAt: { gte: since } },
      select: { reporterId: true },
      distinct: ["reporterId"],
    })
    const set = new Set(others.map((o) => o.reporterId))
    set.add(user.id)
    distinct = set.size
  }
  const priority = computePriority(category, distinct)

  const report = await db.report.create({
    data: {
      reporterId: user.id,
      reportedId: target.reportedId,
      category,
      targetType,
      targetId,
      priority,
      reason: description,
      evidence: JSON.stringify(target.evidence),
    },
  })

  // Several different people → every open report about this user becomes urgent, once
  if (target.reportedId && distinct >= ESCALATION_THRESHOLD) {
    const raised = await db.report.updateMany({
      where: { reportedId: target.reportedId, status: { in: OPEN_STATUSES }, priority: { not: "URGENT" } },
      data: { priority: "URGENT" },
    })
    if (raised.count > 0) {
      await db.auditLog.create({
        data: { actorId: user.id, action: "REPORT_ESCALATED", targetId: target.reportedId, reason: `${distinct} farklı kullanıcı son ${ESCALATION_WINDOW_DAYS} günde bildirdi → acil` },
      })
    }
  }

  if (PRIORITY_RANK[priority] >= PRIORITY_RANK.HIGH) {
    const reported = target.reportedId ? await db.user.findUnique({ where: { id: target.reportedId }, select: { name: true } }) : null
    notifyAdmins(
      `AYA: ${priority === "URGENT" ? "ACİL " : ""}yeni bildirim — ${CATEGORY_LABEL_TR(category)}`,
      `<p><b>${esc(TARGET_LABEL_TR[targetType])}</b> hakkında yeni bir bildirim var.</p>
       <p>Kategori: ${esc(CATEGORY_LABEL_TR(category))}<br/>Bildirilen: ${esc(reported?.name ?? "—")}<br/>Öncelik: ${priority}${distinct >= ESCALATION_THRESHOLD ? ` (${distinct} farklı bildirimci)` : ""}</p>
       <blockquote>${esc(description.slice(0, 400))}</blockquote>
       <p><a href="${baseUrl()}/admin?tab=reports">Raporlara git</a></p>`
    )
  }

  return { ok: true, id: report.id, priority }
}

// ── admin side ────────────────────────────────────────────────────────────

/** Tells the reporter (once) that their report has been dealt with — generic, no internal notes. */
export async function notifyReporterOnce(reportId: string) {
  const r = await db.report.findUnique({ where: { id: reportId }, include: { reporter: { select: { email: true, name: true } } } })
  if (!r || r.reporterNotified) return
  const updated = await db.report.updateMany({ where: { id: reportId, reporterNotified: false }, data: { reporterNotified: true } })
  if (updated.count === 0) return
  const dismissed = r.status === "DISMISSED"
  await notify({
    userId: r.reporterId, type: "REPORT_UPDATE", href: "/dashboard/reports",
    title: dismissed ? "Bildirimin incelendi" : "Bildirimin için gerekli işlem yapıldı",
    body: dismissed ? "Mevcut bilgilerle bir ihlal tespit edilemedi." : "Teşekkürler: bildirdiğin içerik için işlem yapıldı.",
  })
  if (!r.reporter.email) return
  sendEmail({
    to: r.reporter.email,
    subject: "AYA: Bildiriminiz değerlendirildi",
    html: `<p>Merhaba ${esc(r.reporter.name ?? "")},</p>
      <p>${esc(CATEGORY_LABEL_TR(r.category))} kategorisindeki bildiriminiz incelendi. ${
        dismissed ? "Mevcut bilgilerle bir ihlal tespit edemedik; yeni bir gelişme olursa yeniden bildirebilirsiniz." : "Gerekli işlem yapıldı."
      }</p><p>Platformu daha güvenli kılmamıza yardım ettiğiniz için teşekkür ederiz.<br/>AYA Ekibi</p>`,
  }).catch(() => {})
}

export async function issueWarning(adminId: string, userId: string, message: string, reportId?: string) {
  const w = await db.userWarning.create({ data: { userId, message, reportId: reportId ?? null, issuedById: adminId } })
  await notify({ userId, type: "WARNING", title: "Yönetimden bir uyarı aldın", body: message.slice(0, 200), href: "/dashboard/reports" })
  await db.auditLog.create({ data: { actorId: adminId, action: "WARN_USER", targetId: userId, reason: message.slice(0, 300) } })
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
  if (u?.email) {
    sendEmail({
      to: u.email,
      subject: "AYA: Yönetimden uyarı",
      html: `<p>Merhaba ${esc(u.name ?? "")},</p><p>Hesabınızla ilgili bir bildirim üzerine yönetimden şu uyarıyı aldınız:</p><blockquote>${esc(message)}</blockquote><p>Tekrarı hâlinde hesabınız kısıtlanabilir.<br/>AYA Ekibi</p>`,
    }).catch(() => {})
  }
  return w
}

export type ActionResult = { ok: true; resolution: string } | Err

/** Perform a moderation action for a report and close it (and, for account-level actions, its siblings). */
export async function executeReportAction(adminId: string, reportId: string, action: AdminAction, note: string): Promise<ActionResult> {
  const report = await db.report.findUnique({ where: { id: reportId }, include: { reported: true } })
  if (!report) return { ok: false, status: 404, error: "Rapor bulunamadı." }
  const cleanNote = sanitizeReportText(note, 500)
  const reported = report.reported
  let resolvesSiblings = false

  switch (action) {
    case "warn": {
      if (!reported) return { ok: false, status: 400, error: "Bu raporda uyarılacak bir kullanıcı yok." }
      if (reported.role === "ADMIN") return { ok: false, status: 403, error: "Yönetici hesapları uyarılamaz." }
      if (cleanNote.length < 10) return { ok: false, status: 400, error: "Uyarı metni en az 10 karakter olmalı." }
      await issueWarning(adminId, reported.id, cleanNote, report.id)
      break
    }
    case "ban": {
      if (!reported) return { ok: false, status: 400, error: "Bu raporda yasaklanacak bir kullanıcı yok." }
      if (reported.role === "ADMIN") return { ok: false, status: 403, error: "Yönetici hesapları yasaklanamaz." }
      if (reported.id === adminId) return { ok: false, status: 400, error: "Kendinizi yasaklayamazsınız." }
      if (cleanNote.length < 5) return { ok: false, status: 400, error: "Yasaklama gerekçesi yazın." }
      if (reported.banned) return { ok: false, status: 409, error: "Kullanıcı zaten yasaklı." }
      await applyFullBan(reported.id, cleanNote, adminId)
      resolvesSiblings = true
      break
    }
    case "revoke_teacher": {
      if (!reported) return { ok: false, status: 400, error: "Bu raporda bir eğitmen yok." }
      const teacher = await db.teacher.findUnique({ where: { userId: reported.id } })
      if (!teacher) return { ok: false, status: 400, error: "Bildirilen kullanıcı bir eğitmen değil." }
      const r = await decideTrial(adminId, teacher.id, "revoke", cleanNote)
      if (!r.ok) return { ok: false, status: r.status, error: r.error }
      resolvesSiblings = true
      break
    }
    case "close_room": {
      const roomId = report.targetType === "LIVE_ROOM" ? report.targetId : report.targetType === "CHAT_MESSAGE" ? report.targetId : null
      const room = roomId ? await db.liveRoom.findUnique({ where: { id: roomId } }) : null
      if (!room) return { ok: false, status: 400, error: "Bu raporda kapatılacak bir yayın yok." }
      if (!room.isActive) return { ok: false, status: 409, error: "Yayın zaten sona ermiş." }
      await endLiveRoom(room.id)
      await db.auditLog.create({ data: { actorId: adminId, action: "CLOSE_ROOM", targetId: room.id, reason: cleanNote || "Rapor üzerine kapatıldı" } })
      break
    }
    case "unpublish_workshop": {
      const w = report.targetType === "WORKSHOP" && report.targetId ? await db.workshop.findUnique({ where: { id: report.targetId } }) : null
      if (!w) return { ok: false, status: 400, error: "Bu raporda kaldırılacak bir atölye yok." }
      if (w.status !== "PUBLISHED") return { ok: false, status: 409, error: "Atölye zaten yayında değil." }
      await db.workshop.update({ where: { id: w.id }, data: { status: "DRAFT" } })
      await db.auditLog.create({ data: { actorId: adminId, action: "UNPUBLISH_WORKSHOP", targetId: w.id, reason: cleanNote || "Rapor üzerine yayından kaldırıldı" } })
      break
    }
    case "remove_content": {
      if (report.targetType === "POST" && report.targetId) {
        const post = await db.post.findUnique({ where: { id: report.targetId } })
        if (!post || post.status === "REMOVED") return { ok: false, status: 409, error: "Gönderi zaten kaldırılmış." }
        await db.post.update({ where: { id: post.id }, data: { status: "REMOVED", removedReason: cleanNote || "Rapor üzerine kaldırıldı", reviewedById: adminId, reviewedAt: new Date() } })
        await notify({ userId: post.authorId, type: "POST_REMOVED", title: "Fotoğrafın kaldırıldı", body: "Bir bildirim üzerine yapılan inceleme sonucunda fotoğrafın topluluk kurallarına uymadığı için kaldırıldı.", href: "/community/rules" })
      } else if (report.targetType === "COMMENT" && report.targetId) {
        const c = await db.comment.findUnique({ where: { id: report.targetId } })
        if (!c || c.status === "REMOVED") return { ok: false, status: 409, error: "Yorum zaten kaldırılmış." }
        await db.$transaction([
          db.comment.update({ where: { id: c.id }, data: { status: "REMOVED", removedById: adminId, removedReason: cleanNote || "Rapor üzerine kaldırıldı" } }),
          db.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } }),
        ])
        await notify({ userId: c.authorId, type: "COMMENT_REMOVED", title: "Yorumun kaldırıldı", body: "Bir bildirim üzerine yapılan inceleme sonucunda yorumun topluluk kurallarına uymadığı için kaldırıldı.", href: "/community/rules" })
      } else return { ok: false, status: 400, error: "Bu raporda kaldırılacak bir içerik yok." }
      await db.auditLog.create({ data: { actorId: adminId, action: "REMOVE_CONTENT", targetId: report.targetId, reason: cleanNote || "Rapor üzerine kaldırıldı" } })
      break
    }
    default:
      return { ok: false, status: 400, error: "Geçersiz işlem." }
  }

  const resolution = `${ADMIN_ACTION_LABEL_TR[action]}${cleanNote ? ` — ${cleanNote}` : ""}`
  const now = new Date()
  await db.report.update({
    where: { id: report.id },
    data: { status: "RESOLVED", resolution, handledById: adminId, handledAt: now },
  })
  await db.auditLog.create({ data: { actorId: adminId, action: `REPORT_${action.toUpperCase()}`, targetId: report.id, reason: resolution.slice(0, 480) } })
  notifyReporterOnce(report.id).catch(() => {})

  if (resolvesSiblings && reported) {
    const siblings = await db.report.findMany({ where: { reportedId: reported.id, status: { in: OPEN_STATUSES }, id: { not: report.id } }, select: { id: true } })
    if (siblings.length) {
      await db.report.updateMany({
        where: { id: { in: siblings.map((s) => s.id) } },
        data: { status: "RESOLVED", resolution: `${resolution} (aynı kullanıcıya ait başka bir rapor üzerinden)`, handledById: adminId, handledAt: now },
      })
      for (const s of siblings) notifyReporterOnce(s.id).catch(() => {})
    }
  }
  return { ok: true, resolution }
}
