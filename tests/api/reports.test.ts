import { describe, it, expect, afterAll } from "vitest"
import crypto from "crypto"
import { api, json, makeUser, makeTeacher, makeBooking, db } from "./helpers"

afterAll(() => db.$disconnect())

const tag = () => crypto.randomBytes(3).toString("hex")
const DESC = "Eğitmen ders sırasında uygunsuz ve rahatsız edici ifadeler kullandı."

const report = (user: { token: string } | null, over: Record<string, unknown>) =>
  json("/api/reports", user, "POST", { targetType: "TEACHER", category: "HARASSMENT", description: DESC, ...over })

async function liveRoom(teacherId: string, active = true) {
  return db.liveRoom.create({ data: { teacherId, roomName: `rep-${tag()}`, title: `Yayın ${tag()}`, isActive: active, endedAt: active ? null : new Date() } })
}

describe("filing a report", () => {
  it("needs a signed-in user who accepted the terms", async () => {
    const { teacher } = await makeTeacher()
    expect((await report(null, { targetId: teacher.id })).status).toBe(401)
    const noTerms = await makeUser("STUDENT", { terms: false })
    const res = await report(noTerms, { targetId: teacher.id })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("TERMS_REQUIRED")
  })

  it("validates target, category and description", async () => {
    const { teacher } = await makeTeacher()
    const u = await makeUser("STUDENT")
    expect((await report(u, { targetType: "NOPE", targetId: teacher.id })).status).toBe(400)
    expect((await report(u, { targetId: "" })).status).toBe(400)
    expect((await report(u, { targetId: teacher.id, category: "NO_SHOW" })).status).toBe(400) // NO_SHOW is not valid for a teacher profile
    expect((await report(u, { targetId: teacher.id, category: "MADE_UP" })).status).toBe(400)
    expect((await report(u, { targetId: teacher.id, description: "kısa" })).status).toBe(400)
    expect((await report(u, { targetId: "does-not-exist" })).status).toBe(404)
    expect(await db.report.count({ where: { reporterId: u.id } })).toBe(0)
  })

  it("resolves the reported user on the server and picks the priority from the category", async () => {
    const { user: tUser, teacher } = await makeTeacher()
    const u = await makeUser("STUDENT")
    // a client-supplied reportedId is ignored
    const victim = await makeUser("STUDENT")
    const res = await report(u, { targetId: teacher.id, category: "QUALITY", reportedId: victim.id })
    expect(res.status).toBe(200)
    const row = await db.report.findUniqueOrThrow({ where: { id: (await res.json()).id } })
    expect(row.reportedId).toBe(tUser.id)
    expect(row.priority).toBe("NORMAL")
    expect(row.status).toBe("PENDING")
    expect(JSON.parse(row.evidence!).kind).toBe("Eğitmen profili")

    // base priority of a safety report is HIGH …
    const fresh = await makeTeacher()
    const safety = await report(await makeUser("STUDENT"), { targetId: fresh.teacher.id, category: "SAFETY" })
    expect((await db.report.findUniqueOrThrow({ where: { id: (await safety.json()).id } })).priority).toBe("HIGH")
    // … and a second, different reporter raises it one level
    const second = await report(await makeUser("STUDENT"), { targetId: teacher.id, category: "SAFETY" })
    expect((await db.report.findUniqueOrThrow({ where: { id: (await second.json()).id } })).priority).toBe("URGENT")
  })

  it("accepts the public name slug of a teacher profile", async () => {
    const { user, teacher } = await makeTeacher()
    const slug = user.id // unused; real slug below
    void slug
    const named = await db.user.update({ where: { id: user.id }, data: { name: `Slug Hoca ${tag()}` } })
    const u = await makeUser("STUDENT")
    const res = await report(u, { targetId: named.name!.toLowerCase().replace(/ /g, "-") })
    expect(res.status).toBe(200)
    expect((await db.report.findUniqueOrThrow({ where: { id: (await res.json()).id } })).reportedId).toBe(teacher.userId)
  })

  it("blocks self reports and duplicates", async () => {
    const { user: tUser, teacher } = await makeTeacher()
    const own = await report(tUser, { targetId: teacher.id })
    expect(own.status).toBe(400)
    expect((await own.json()).code).toBe("SELF")

    const u = await makeUser("STUDENT")
    expect((await report(u, { targetId: teacher.id })).status).toBe(200)
    const again = await report(u, { targetId: teacher.id, category: "SAFETY" })
    expect(again.status).toBe(409)
    expect((await again.json()).code).toBe("DUPLICATE")
    expect(await db.report.count({ where: { reporterId: u.id } })).toBe(1)
  })

  it("rate limits a reporter (5 per hour)", async () => {
    const { teacher } = await makeTeacher()
    const u = await makeUser("STUDENT")
    await db.report.createMany({ data: Array.from({ length: 5 }, () => ({ reporterId: u.id, reason: "x".repeat(12), category: "OTHER", targetType: "TEACHER", targetId: `old-${tag()}` })) })
    const res = await report(u, { targetId: teacher.id })
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe("RATE_LIMIT")
  })

  it("lesson reports: only participants, and the counterpart is reported", async () => {
    const { user: tUser, teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    const stranger = await makeUser("STUDENT")
    const booking = await makeBooking(teacher.id, student.id)

    expect((await report(stranger, { targetType: "BOOKING", targetId: booking.id, category: "NO_SHOW" })).status).toBe(403)

    const s = await report(student, { targetType: "BOOKING", targetId: booking.id, category: "NO_SHOW", description: "Eğitmen derse hiç katılmadı, 20 dakika bekledim." })
    expect(s.status).toBe(200)
    expect((await db.report.findUniqueOrThrow({ where: { id: (await s.json()).id } })).reportedId).toBe(tUser.id)

    const t = await report(tUser, { targetType: "BOOKING", targetId: booking.id, category: "NO_SHOW", description: "Öğrenci derse katılmadı ve haber vermedi." })
    expect(t.status).toBe(200)
    expect((await db.report.findUniqueOrThrow({ where: { id: (await t.json()).id } })).reportedId).toBe(student.id)
  })

  it("live stream and chat message reports", async () => {
    const { user: tUser, teacher } = await makeTeacher()
    const viewer = await makeUser("STUDENT")
    const troll = await makeUser("STUDENT")
    const room = await liveRoom(teacher.id)

    const s = await report(viewer, { targetType: "LIVE_ROOM", targetId: room.id, category: "INAPPROPRIATE_CONTENT" })
    expect(s.status).toBe(200)
    expect((await db.report.findUniqueOrThrow({ where: { id: (await s.json()).id } })).reportedId).toBe(tUser.id)

    // a chat report needs the message as evidence …
    expect((await report(viewer, { targetType: "CHAT_MESSAGE", targetId: room.id, category: "SPAM" })).status).toBe(400)
    const message = { text: "Ucuz takipçi için DM atın", senderIdentity: troll.id, senderName: "Troll", sentAt: Date.now() }
    const c = await report(viewer, { targetType: "CHAT_MESSAGE", targetId: room.id, category: "SPAM", message, description: "Sohbette reklam spamı yapıyor." })
    expect(c.status).toBe(200)
    const row = await db.report.findUniqueOrThrow({ where: { id: (await c.json()).id } })
    expect(row.reportedId).toBe(troll.id)
    const ev = JSON.parse(row.evidence!)
    expect(ev.message.text).toBe(message.text)
    expect(ev.reporterSupplied).toBe(true)
    // … and the same message cannot be reported twice, a different one can
    expect((await report(viewer, { targetType: "CHAT_MESSAGE", targetId: room.id, category: "SPAM", message, description: "Aynı mesajı tekrar bildiriyorum." })).status).toBe(409)
    expect((await report(viewer, { targetType: "CHAT_MESSAGE", targetId: room.id, category: "SPAM", message: { ...message, text: "Başka bir spam mesajı" }, description: "Bu da başka bir spam mesajı." })).status).toBe(200)
  })

  it("escalates to URGENT when three different people report the same user", async () => {
    const { user: tUser, teacher } = await makeTeacher()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const r = await report(await makeUser("STUDENT"), { targetId: teacher.id, category: "QUALITY", description: `Ders kalitesi beklentimin çok altındaydı (${i}).` })
      expect(r.status).toBe(200)
      ids.push((await r.json()).id)
    }
    const rows = await db.report.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "asc" } })
    expect(rows.map((r) => r.priority)).toEqual(["URGENT", "URGENT", "URGENT"]) // the earlier ones were raised as well
    const esc = await db.auditLog.count({ where: { action: "REPORT_ESCALATED", targetId: tUser.id } })
    expect(esc).toBeGreaterThan(0)
  })
})

describe("my reports", () => {
  it("lists only my own reports with generic status text and no internal notes", async () => {
    const { teacher } = await makeTeacher()
    const me = await makeUser("STUDENT")
    const other = await makeUser("STUDENT")
    const created = await (await report(me, { targetId: teacher.id })).json()
    await report(other, { targetId: teacher.id })
    await db.report.update({ where: { id: created.id }, data: { adminNote: "GİZLİ İÇ NOT", resolution: "Kullanıcı yasaklandı", status: "RESOLVED" } })

    expect((await api("/api/reports")).status).toBe(401)
    const res = await api("/api/reports", me)
    const body = await res.json()
    expect(body.reports).toHaveLength(1)
    expect(body.reports[0].status).toBe("RESOLVED")
    expect(body.reports[0].message).toMatch(/gerekli işlem yapıldı/)
    expect(JSON.stringify(body)).not.toMatch(/GİZLİ|yasaklandı|reportedId|adminNote/)
  })
})

describe("admin report handling", () => {
  async function setup() {
    const admin = await makeUser("ADMIN")
    const { user: tUser, teacher } = await makeTeacher()
    const reporter = await makeUser("STUDENT")
    const created = await (await report(reporter, { targetId: teacher.id, category: "SAFETY" })).json()
    return { admin, tUser, teacher, reporter, id: created.id as string }
  }

  it("is admin only", async () => {
    const { id, reporter } = await setup()
    for (const path of ["/api/admin/reports", `/api/admin/reports/${id}`]) {
      expect((await api(path)).status).toBe(401)
      expect((await api(path, reporter)).status).toBe(403)
    }
    expect((await json(`/api/admin/reports/${id}/action`, reporter, "POST", { action: "warn", note: "x".repeat(20) })).status).toBe(403)
    expect((await json("/api/admin/reports/bulk", reporter, "POST", { ids: [id], status: "DISMISSED" })).status).toBe(403)
    expect((await json(`/api/admin/reports/${id}`, reporter, "PATCH", { status: "DISMISSED" })).status).toBe(403)
  })

  it("lists with filters and search, urgent first", async () => {
    const { admin, id, tUser } = await setup()
    const list = await (await api("/api/admin/reports?status=open", admin)).json()
    const mine = await (await api(`/api/admin/reports?status=open&q=${id}`, admin)).json()
    expect(mine.reports.map((r: any) => r.id)).toEqual([id])
    expect(list.statusCounts.PENDING).toBeGreaterThan(0)
    const ranks = list.reports.map((r: any) => ({ URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as any)[r.priority])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))

    const byUser = await (await api(`/api/admin/reports?status=all&q=${encodeURIComponent(tUser.email)}`, admin)).json()
    expect(byUser.reports.map((r: any) => r.id)).toContain(id)
    const byCat = await (await api("/api/admin/reports?status=all&category=SAFETY&priority=HIGH", admin)).json()
    expect(byCat.reports.every((r: any) => r.category === "SAFETY" && r.priority === "HIGH")).toBe(true)
    const none = await (await api("/api/admin/reports?status=all&q=zzzz-no-such-thing-zzzz", admin)).json()
    expect(none.reports).toHaveLength(0)
  })

  it("detail shows context; status changes are audited and the reporter is notified once", async () => {
    const { admin, id, reporter } = await setup()
    const d = await (await api(`/api/admin/reports/${id}`, admin)).json()
    expect(d.report.reason).toBe(DESC)
    expect(d.reporter.id).toBe(reporter.id)
    expect(d.reported.teacher).toBeTruthy()

    expect((await json(`/api/admin/reports/${id}`, admin, "PATCH", { status: "NOPE" })).status).toBe(400)
    expect((await json(`/api/admin/reports/${id}`, admin, "PATCH", {})).status).toBe(400)
    expect((await json(`/api/admin/reports/${id}`, admin, "PATCH", { status: "REVIEWED", adminNote: "İnceleniyor" })).status).toBe(200)
    expect((await json(`/api/admin/reports/${id}`, admin, "PATCH", { priority: "LOW" })).status).toBe(200)
    expect((await json(`/api/admin/reports/${id}`, admin, "PATCH", { status: "DISMISSED" })).status).toBe(200)
    const row = await db.report.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe("DISMISSED")
    expect(row.handledById).toBe(admin.id)
    expect(row.adminNote).toBe("İnceleniyor")
    expect(await db.auditLog.count({ where: { targetId: id, action: "REPORT_UPDATE" } })).toBe(3)

    // re-opening clears the handler
    await json(`/api/admin/reports/${id}`, admin, "PATCH", { status: "PENDING" })
    expect((await db.report.findUniqueOrThrow({ where: { id } })).handledById).toBeNull()
    expect((await api("/api/admin/reports/nope-nope", admin)).status).toBe(404)
  })

  it("warn: needs real text, shows up for the user until acknowledged", async () => {
    const { admin, id, tUser } = await setup()
    expect((await json(`/api/admin/reports/${id}/action`, admin, "POST", { action: "warn", note: "kısa" })).status).toBe(400)
    const ok = await json(`/api/admin/reports/${id}/action`, admin, "POST", { action: "warn", note: "Dersler sırasında profesyonel bir dil kullanmanız gerekir." })
    expect(ok.status).toBe(200)
    expect((await db.report.findUniqueOrThrow({ where: { id } })).status).toBe("RESOLVED")

    const list = await (await api("/api/warnings", tUser)).json()
    expect(list.warnings).toHaveLength(1)
    expect(list.warnings[0].message).toMatch(/profesyonel/)
    // somebody else cannot acknowledge it
    const other = await makeUser("STUDENT")
    expect((await json(`/api/warnings/${list.warnings[0].id}/ack`, other, "POST", {})).status).toBe(404)
    expect((await json(`/api/warnings/${list.warnings[0].id}/ack`, tUser, "POST", {})).status).toBe(200)
    expect((await (await api("/api/warnings", tUser)).json()).warnings).toHaveLength(0)
    expect((await (await api("/api/warnings?all=1", tUser)).json()).warnings).toHaveLength(1)
  })

  it("ban: needs a reason, locks the account, cancels lessons, resolves sibling reports", async () => {
    const { admin, id, tUser, teacher, reporter } = await setup()
    const second = await (await report(await makeUser("STUDENT"), { targetId: teacher.id, category: "HARASSMENT" })).json()
    const booking = await makeBooking(teacher.id, reporter.id)
    const room = await liveRoom(teacher.id)

    expect((await json(`/api/admin/reports/${id}/action`, admin, "POST", { action: "ban", note: "x" })).status).toBe(400)
    const res = await json(`/api/admin/reports/${id}/action`, admin, "POST", { action: "ban", note: "Tekrarlayan güvenlik ihlali" })
    expect(res.status).toBe(200)

    const u = await db.user.findUniqueOrThrow({ where: { id: tUser.id } })
    expect(u.banned).toBe(true)
    expect(u.banReason).toBe("Tekrarlayan güvenlik ihlali")
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED")
    expect((await db.liveRoom.findUniqueOrThrow({ where: { id: room.id } })).isActive).toBe(false)
    expect((await db.report.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("RESOLVED")
    // an already banned user cannot be banned again
    expect((await json(`/api/admin/reports/${second.id}/action`, admin, "POST", { action: "ban", note: "Tekrar yasaklama" })).status).toBe(409)
  })

  it("revoke_teacher sends the teacher back to trial; close_room and unpublish_workshop act on the target", async () => {
    const { admin, teacher, tUser } = await setup()
    const viewer = await makeUser("STUDENT")

    const roomA = await liveRoom(teacher.id)
    const r1 = await (await report(viewer, { targetType: "LIVE_ROOM", targetId: roomA.id, category: "INAPPROPRIATE_CONTENT" })).json()
    expect((await json(`/api/admin/reports/${r1.id}/action`, admin, "POST", { action: "close_room", note: "Uygunsuz yayın" })).status).toBe(200)
    expect((await db.liveRoom.findUniqueOrThrow({ where: { id: roomA.id } })).isActive).toBe(false)
    // the broadcast is over now → closing again is refused
    const r1b = await (await report(await makeUser("STUDENT"), { targetType: "LIVE_ROOM", targetId: roomA.id, category: "SPAM" })).json()
    expect((await json(`/api/admin/reports/${r1b.id}/action`, admin, "POST", { action: "close_room", note: "" })).status).toBe(409)

    const ws = await (await json("/api/workshops", tUser, "POST", { title: `Rapor Atölyesi ${tag()}`, description: "Nefes ve esneme üzerine kısa bir çalışma.", category: "Hatha", mode: "LIVE", startsAt: new Date(Date.now() + 7_200_000).toISOString(), durationMin: 60, capacity: 5, priceUsd: 0 })).json()
    const r2 = await (await report(viewer, { targetType: "WORKSHOP", targetId: ws.workshop.id, category: "FRAUD", description: "Atölye açıklaması gerçeği yansıtmıyor, yanıltıcı." })).json()
    expect((await json(`/api/admin/reports/${r2.id}/action`, admin, "POST", { action: "unpublish_workshop", note: "Yanıltıcı içerik" })).status).toBe(200)
    expect((await db.workshop.findUniqueOrThrow({ where: { id: ws.workshop.id } })).status).toBe("DRAFT")
    // a room action on a workshop report makes no sense
    const r3 = await (await report(await makeUser("STUDENT"), { targetType: "WORKSHOP", targetId: ws.workshop.id, category: "SAFETY" })).json()
    expect((await json(`/api/admin/reports/${r3.id}/action`, admin, "POST", { action: "close_room", note: "" })).status).toBe(400)

    const r4 = await (await report(await makeUser("STUDENT"), { targetId: teacher.id, category: "FRAUD", description: "Platform dışına ödeme yönlendirmeye çalıştı." })).json()
    expect((await json(`/api/admin/reports/${r4.id}/action`, admin, "POST", { action: "revoke_teacher", note: "Platform dışı ödeme talebi" })).status).toBe(200)
    expect((await db.teacher.findUniqueOrThrow({ where: { id: teacher.id } })).isTrialMode).toBe(true)
  })

  it("admins can be neither warned nor banned through a report", async () => {
    const admin = await makeUser("ADMIN")
    const target = await makeUser("ADMIN")
    const reporter = await makeUser("STUDENT")
    const row = await db.report.create({ data: { reporterId: reporter.id, reportedId: target.id, reason: "x".repeat(15), category: "OTHER", targetType: "TEACHER", targetId: "x" } })
    expect((await json(`/api/admin/reports/${row.id}/action`, admin, "POST", { action: "ban", note: "deneme yasaklama" })).status).toBe(403)
    expect((await json(`/api/admin/reports/${row.id}/action`, admin, "POST", { action: "warn", note: "deneme uyarı metni" })).status).toBe(403)
    expect((await json(`/api/admin/reports/${row.id}/action`, admin, "POST", { action: "nuke", note: "" })).status).toBe(400)
  })

  it("bulk status updates only touch open reports and cap the batch", async () => {
    const { admin, id } = await setup()
    const { id: id2 } = await setup()
    const closed = await db.report.create({ data: { reporterId: admin.id, reason: "x".repeat(15), status: "RESOLVED" } })
    expect((await json("/api/admin/reports/bulk", admin, "POST", { ids: [], status: "DISMISSED" })).status).toBe(400)
    expect((await json("/api/admin/reports/bulk", admin, "POST", { ids: [id], status: "BOGUS" })).status).toBe(400)
    expect((await json("/api/admin/reports/bulk", admin, "POST", { ids: Array.from({ length: 101 }, (_, i) => `x${i}`), status: "DISMISSED" })).status).toBe(400)
    const res = await (await json("/api/admin/reports/bulk", admin, "POST", { ids: [id, id2, closed.id], status: "DISMISSED" })).json()
    expect(res.updated).toBe(2)
    expect((await db.report.findUniqueOrThrow({ where: { id: closed.id } })).status).toBe("RESOLVED")
  })

  it("CSV export is a spreadsheet-safe download", async () => {
    const { admin, reporter, teacher } = await setup()
    await db.user.update({ where: { id: reporter.id }, data: { email: `=cmd-${tag()}@aya.test` } })
    void teacher
    const res = await api("/api/admin/reports?status=all&format=csv", admin)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/text\/csv/)
    expect(res.headers.get("content-disposition")).toMatch(/raporlar-/)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]) // BOM so Excel reads Turkish characters
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).slice(1)
    expect(text.startsWith("ID,Tarih,Durum")).toBe(true)
    expect(text).not.toMatch(/,=cmd-/)
    expect(text).toMatch(/'=cmd-/)
  })
})
