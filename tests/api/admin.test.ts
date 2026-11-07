import { describe, it, expect, afterAll } from "vitest"
import crypto from "crypto"
import { api, json, makeUser, makeTeacher, makeBooking, db } from "./helpers"

afterAll(() => db.$disconnect())

const tag = () => crypto.randomBytes(3).toString("hex")
const publicIp = () => `203.0.113.${1 + Math.floor(Math.random() * 250)}` // TEST-NET-3: public-looking, never routed

describe("admin API access control", () => {
  const paths = ["/api/admin/badges", "/api/admin/overview", "/api/admin/users", "/api/admin/bookings", "/api/admin/workshops", "/api/admin/recordings", "/api/admin/audit", "/api/admin/live-rooms"]

  it("every admin endpoint refuses anonymous visitors and non-admins", async () => {
    const student = await makeUser("STUDENT")
    const { user: teacher } = await makeTeacher()
    for (const p of paths) {
      expect((await api(p)).status, `${p} anonymous`).toBe(401)
      expect((await api(p, student)).status, `${p} student`).toBe(403)
      expect((await api(p, teacher)).status, `${p} teacher`).toBe(403)
    }
    const stranger = await makeUser("STUDENT")
    expect((await api(`/api/admin/users/${stranger.id}`, student)).status).toBe(403)
    expect((await json(`/api/admin/users/${stranger.id}/warn`, student, "POST", { message: "x".repeat(20) })).status).toBe(403)
    expect((await json(`/api/admin/users/${stranger.id}/ban`, student, "POST", { reason: "deneme" })).status).toBe(403)
    expect((await json("/api/admin/bans", student, "POST", { ipAddress: publicIp(), reason: "deneme" })).status).toBe(403)
    expect((await json("/api/admin/bans", null, "POST", { ipAddress: publicIp(), reason: "deneme" })).status).toBe(401)
  })
})

describe("overview and badges", () => {
  it("badges count the work waiting for an admin", async () => {
    const admin = await makeUser("ADMIN")
    const before = await (await api("/api/admin/badges", admin)).json()
    const reporter = await makeUser("STUDENT")
    await db.report.create({ data: { reporterId: reporter.id, reason: "x".repeat(12), priority: "URGENT" } })
    await db.payoutRequest.create({ data: { teacherId: (await makeTeacher()).teacher.id, amount: 55, currency: "USD", method: "IBAN", iban: "TR330006100519786457841326", accountName: "A B" } })
    const after = await (await api("/api/admin/badges", admin)).json()
    expect(after.reports).toBe(before.reports + 1)
    expect(after.urgentReports).toBe(before.urgentReports + 1)
    expect(after.payouts).toBe(before.payouts + 1)
  })

  it("overview returns the action queue, 14-day series and a health check", async () => {
    const admin = await makeUser("ADMIN")
    const o = await (await api("/api/admin/overview", admin)).json()
    expect(o.queue).toMatchObject({ openReports: expect.any(Number), pendingApplications: expect.any(Number), pendingPayouts: expect.any(Number) })
    expect(o.totals.users).toBeGreaterThan(0)
    for (const k of ["users", "bookings", "reports"]) expect(o.series[k]).toHaveLength(14)
    expect(o.series.users.reduce((s: number, d: any) => s + d.count, 0)).toBeGreaterThan(0) // test users were just created
    const db_ = o.health.find((h: any) => h.id === "db")
    expect(db_.ok).toBe(true)
    expect(o.health.map((h: any) => h.id)).toEqual(expect.arrayContaining(["db", "livekit", "email", "payments", "https"]))
  })
})

describe("users", () => {
  it("searches on the server, filters by role/status and paginates — and never leaks password hashes", async () => {
    const admin = await makeUser("ADMIN")
    const needle = `Zeynep-${tag()}`
    const target = await makeUser("STUDENT")
    await db.user.update({ where: { id: target.id }, data: { name: needle } })

    const found = await (await api(`/api/admin/users?q=${needle.toLowerCase()}`, admin)).json()
    expect(found.users.map((u: any) => u.id)).toEqual([target.id])
    expect(JSON.stringify(found)).not.toMatch(/password|\$2[aby]\$/)

    const byEmail = await (await api(`/api/admin/users?q=${encodeURIComponent(target.email)}`, admin)).json()
    expect(byEmail.total).toBe(1)
    expect((await (await api(`/api/admin/users?q=${needle}&role=TEACHER`, admin)).json()).total).toBe(0)
    expect((await (await api(`/api/admin/users?q=${needle}&status=banned`, admin)).json()).total).toBe(0)

    const p1 = await (await api("/api/admin/users?page=1", admin)).json()
    const p2 = await (await api("/api/admin/users?page=2", admin)).json()
    expect(p1.users).toHaveLength(20)
    expect(p1.users.map((u: any) => u.id)).not.toEqual(expect.arrayContaining(p2.users.map((u: any) => u.id)))
    expect(p1.counts.ADMIN).toBeGreaterThan(0)
  })

  it("detail has reports, warnings and IP history; unknown ids are 404", async () => {
    const admin = await makeUser("ADMIN")
    const u = await makeUser("STUDENT")
    await db.userIpLog.create({ data: { userId: u.id, ipAddress: publicIp() } })
    await db.userIpLog.create({ data: { userId: u.id, ipAddress: "127.0.0.1" } })
    await db.userWarning.create({ data: { userId: u.id, message: "Eski uyarı", issuedById: admin.id } })
    const d = await (await api(`/api/admin/users/${u.id}`, admin)).json()
    expect(d.user.email).toBe(u.email)
    expect(d.user.password).toBeUndefined()
    expect(d.warnings).toHaveLength(1)
    expect(d.ips).toHaveLength(2)
    expect(d.ips.find((i: any) => i.ip === "127.0.0.1").bannable).toBe(false)
    expect((await api("/api/admin/users/nope", admin)).status).toBe(404)
  })

  it("warn needs a real message and never targets admins", async () => {
    const admin = await makeUser("ADMIN")
    const u = await makeUser("STUDENT")
    expect((await json(`/api/admin/users/${u.id}/warn`, admin, "POST", { message: "kısa" })).status).toBe(400)
    expect((await json(`/api/admin/users/${u.id}/warn`, admin, "POST", { message: "Lütfen topluluk kurallarına uyun." })).status).toBe(200)
    expect(await db.userWarning.count({ where: { userId: u.id } })).toBe(1)
    expect((await json(`/api/admin/users/${admin.id}/warn`, admin, "POST", { message: "Kendime uyarı veriyorum" })).status).toBe(403)
    expect((await json("/api/admin/users/nope/warn", admin, "POST", { message: "Lütfen topluluk kurallarına uyun." })).status).toBe(404)
  })

  it("ban requires a reason, is audited with it, and can be lifted", async () => {
    const admin = await makeUser("ADMIN")
    const u = await makeUser("STUDENT")
    expect((await json(`/api/admin/users/${u.id}/ban`, admin, "POST", {})).status).toBe(400)
    expect((await json(`/api/admin/users/${u.id}/ban`, admin, "POST", { reason: "  " })).status).toBe(400)
    expect((await json(`/api/admin/users/${admin.id}/ban`, admin, "POST", { reason: "kendimi" })).status).toBe(400)
    const other = await makeUser("ADMIN")
    expect((await json(`/api/admin/users/${other.id}/ban`, admin, "POST", { reason: "başka yönetici" })).status).toBe(403)

    await db.userIpLog.create({ data: { userId: u.id, ipAddress: publicIp() } })
    await db.userIpLog.create({ data: { userId: u.id, ipAddress: "10.1.2.3" } }) // private → must NOT be banned
    const res = await json(`/api/admin/users/${u.id}/ban`, admin, "POST", { reason: "Spam hesabı" })
    expect(res.status).toBe(200)
    expect((await res.json()).details.ipsBanned).toBe(1)
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).banReason).toBe("Spam hesabı")
    expect(await db.ipBan.count({ where: { ipAddress: "10.1.2.3", bannedUserId: u.id } })).toBe(0)
    expect(await db.auditLog.count({ where: { targetId: u.id, action: "BAN_USER", reason: { contains: "Spam hesabı" } } })).toBe(1)
    expect((await json(`/api/admin/users/${u.id}/ban`, admin, "POST", { reason: "tekrar" })).status).toBe(409)

    // a banned user's bearer session no longer works
    expect((await api("/api/reports", u)).status).toBe(401)

    expect((await api(`/api/admin/users/${u.id}/ban`, admin, { method: "DELETE" })).status).toBe(200)
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).banned).toBe(false)
    expect((await api(`/api/admin/users/${u.id}/ban`, admin, { method: "DELETE" })).status).toBe(409)
  })

  it("CSV export", async () => {
    const admin = await makeUser("ADMIN")
    const res = await api("/api/admin/users?format=csv", admin)
    expect(res.headers.get("content-type")).toMatch(/text\/csv/)
    expect(await res.text()).toMatch(/E-posta/)
  })
})

describe("bookings", () => {
  it("lists, filters and cancels with a reason (once)", async () => {
    const admin = await makeUser("ADMIN")
    const { teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    const b = await makeBooking(teacher.id, student.id)
    const done = await makeBooking(teacher.id, student.id, "COMPLETED")

    const list = await (await api(`/api/admin/bookings?q=${b.id}`, admin)).json()
    expect(list.bookings).toHaveLength(1)
    expect(list.bookings[0].student.email).toBe(student.email)
    expect((await (await api(`/api/admin/bookings?status=CONFIRMED&q=${encodeURIComponent(student.email)}`, admin)).json()).total).toBe(1)
    expect((await (await api(`/api/admin/bookings?status=CANCELLED&q=${encodeURIComponent(student.email)}`, admin)).json()).total).toBe(0)

    expect((await json(`/api/admin/bookings/${b.id}/cancel`, admin, "POST", {})).status).toBe(400)
    expect((await json(`/api/admin/bookings/${b.id}/cancel`, admin, "POST", { reason: "Eğitmen rahatsızlandı" })).status).toBe(200)
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED")
    expect((await json(`/api/admin/bookings/${b.id}/cancel`, admin, "POST", { reason: "tekrar" })).status).toBe(409)
    expect((await json(`/api/admin/bookings/${done.id}/cancel`, admin, "POST", { reason: "tamamlanmış" })).status).toBe(409)
    expect((await json("/api/admin/bookings/nope/cancel", admin, "POST", { reason: "yok" })).status).toBe(404)
    expect(await db.auditLog.count({ where: { targetId: b.id, action: "CANCEL_BOOKING" } })).toBe(1)
  })
})

describe("workshops moderation", () => {
  it("unpublishing needs a reason and only works on published workshops", async () => {
    const admin = await makeUser("ADMIN")
    const { user: t } = await makeTeacher()
    const w = (await (await json("/api/workshops", t, "POST", { title: `Moderasyon ${tag()}`, description: "Kısa bir nefes çalışması ve meditasyon.", category: "Hatha", mode: "LIVE", startsAt: new Date(Date.now() + 7_200_000).toISOString(), durationMin: 45, capacity: 8, priceUsd: 0 })).json()).workshop
    const list = await (await api(`/api/admin/workshops?q=${w.id}`, admin)).json()
    expect(list.workshops[0]).toMatchObject({ id: w.id, status: "PUBLISHED", enrollments: 0 })

    expect((await json(`/api/admin/workshops/${w.id}/unpublish`, admin, "POST", {})).status).toBe(400)
    expect((await json(`/api/admin/workshops/${w.id}/unpublish`, admin, "POST", { reason: "Kurallara aykırı" })).status).toBe(200)
    expect((await db.workshop.findUniqueOrThrow({ where: { id: w.id } })).status).toBe("DRAFT")
    expect((await json(`/api/admin/workshops/${w.id}/unpublish`, admin, "POST", { reason: "tekrar" })).status).toBe(409)
    expect((await api(`/api/admin/workshops?status=DRAFT&q=${w.id}`, admin).then((r) => r.json())).total).toBe(1)
  })
})

describe("recordings moderation", () => {
  it("shows metadata only and deletes with a reason", async () => {
    const admin = await makeUser("ADMIN")
    const { user: t, teacher } = await makeTeacher()
    void teacher
    const rec = await db.lessonRecording.create({
      data: { roomName: `r-${tag()}`, teacherUserId: t.id, status: "READY", sizeBytes: BigInt(1234567), durationSec: 600, filePath: "x/y.webm", expiresAt: new Date(Date.now() + 86_400_000) },
    })
    const list = await (await api("/api/admin/recordings?status=READY", admin)).json()
    const row = list.recordings.find((r: any) => r.id === rec.id)
    expect(row).toBeTruthy()
    expect(row.sizeBytes).toBe(1234567)
    expect(JSON.stringify(row)).not.toMatch(/filePath|x\/y\.webm/)
    expect(list.storage.files).toBeGreaterThan(0)

    expect((await api(`/api/admin/recordings/${rec.id}`, admin, { method: "DELETE" })).status).toBe(400) // reason missing
    expect((await json(`/api/admin/recordings/${rec.id}`, admin, "DELETE", { reason: "Kurallara aykırı içerik" })).status).toBe(200)
    const gone = await db.lessonRecording.findUniqueOrThrow({ where: { id: rec.id } })
    expect(gone.status).toBe("EXPIRED")
    expect(gone.filePath).toBeNull()
    expect(gone.deletedAt).not.toBeNull()
    expect((await json("/api/admin/recordings/nope", admin, "DELETE", { reason: "yok" })).status).toBe(400) // not an id
    expect((await json(`/api/admin/recordings/c${"0".repeat(24)}`, admin, "DELETE", { reason: "yok" })).status).toBe(404)
  })
})

describe("audit log", () => {
  it("lists, filters by action and searches; teachers may only log their own room timeout", async () => {
    const admin = await makeUser("ADMIN")
    const { user: teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    const marker = `marker-${tag()}`

    expect((await json("/api/admin/audit", teacher, "POST", { action: "TIMEOUT_ROOM", reason: marker, roomName: "room-x" })).status).toBe(200)
    expect((await json("/api/admin/audit", teacher, "POST", { action: "BAN_USER", reason: "hile" })).status).toBe(403)
    expect((await json("/api/admin/audit", student, "POST", { action: "TIMEOUT_ROOM", reason: "x" })).status).toBe(403)
    expect((await json("/api/admin/audit", null, "POST", { action: "TIMEOUT_ROOM" })).status).toBe(401)
    expect((await json("/api/admin/audit", admin, "POST", { action: "NOT_A_THING" })).status).toBe(400)

    const res = await (await api(`/api/admin/audit?q=${marker}`, admin)).json()
    expect(res.logs).toHaveLength(1)
    expect(res.logs[0]).toMatchObject({ action: "TIMEOUT_ROOM", actor: expect.any(String) })
    expect((await (await api(`/api/admin/audit?action=BAN_USER&q=${marker}`, admin)).json()).total).toBe(0)
    expect(res.actions.map((a: any) => a.action)).toContain("TIMEOUT_ROOM")

    const csv = await api(`/api/admin/audit?format=csv&q=${marker}`, admin)
    expect(csv.headers.get("content-disposition")).toMatch(/denetim-kayitlari/)
    expect(await csv.text()).toContain(marker)
  })

  it("closing a live room through the admin API leaves an audit entry", async () => {
    const admin = await makeUser("ADMIN")
    const { teacher } = await makeTeacher()
    const room = await db.liveRoom.create({ data: { teacherId: teacher.id, roomName: `adm-${tag()}`, title: "Kapatılacak" } })
    expect((await json(`/api/admin/live-rooms/${room.id}/close`, await makeUser("STUDENT"), "POST", {})).status).toBe(403)
    expect((await json(`/api/admin/live-rooms/${room.id}/close`, admin, "POST", { reason: "Kural ihlali" })).status).toBe(200)
    expect((await db.liveRoom.findUniqueOrThrow({ where: { id: room.id } })).isActive).toBe(false)
    expect(await db.auditLog.count({ where: { targetId: room.id, action: "CLOSE_ROOM" } })).toBe(1)
    const live = await (await api("/api/admin/live-rooms", admin)).json()
    expect(live.broadcasts.map((b: any) => b.id)).not.toContain(room.id)
    expect((await json("/api/admin/live-rooms/nope/close", admin, "POST", {})).status).toBe(404)
  })
})

describe("IP bans", () => {
  it("validates addresses, protects shared/private ranges and the admin's own address, and can lift a ban", async () => {
    const admin = await makeUser("ADMIN")
    const ban = (body: object, headers: Record<string, string> = {}) =>
      api("/api/admin/bans", admin, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) })

    expect((await ban({ ipAddress: "not-an-ip", reason: "deneme" })).status).toBe(400)
    expect((await ban({ ipAddress: "999.1.1.1", reason: "deneme" })).status).toBe(400)
    expect((await ban({ ipAddress: publicIp() })).status).toBe(400) // reason missing
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.9", "172.20.1.1", "::1"]) {
      expect((await ban({ ipAddress: ip, reason: "özel ağ" })).status, ip).toBe(400)
    }
    const mine = publicIp()
    expect((await ban({ ipAddress: mine, reason: "kendim" }, { "x-forwarded-for": mine })).status).toBe(400)
    expect((await ban({ ipAddress: publicIp(), reason: "geçmiş", expiresAt: "2001-01-01" })).status).toBe(400)

    const ip = publicIp()
    expect((await ban({ ipAddress: ip, reason: "Saldırı kaynağı" })).status).toBe(200)
    const row = await db.ipBan.findFirstOrThrow({ where: { ipAddress: ip, isActive: true } })
    expect(row.bannedByAdminId).toBe(admin.id)
    const list = await (await api("/api/admin/bans?type=ip-bans", admin)).json()
    expect(list.bans.some((b: any) => b.ipAddress === ip)).toBe(true)

    expect((await api("/api/admin/bans", admin, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banId: row.id }) })).status).toBe(200)
    expect((await db.ipBan.findUniqueOrThrow({ where: { id: row.id } })).isActive).toBe(false)
    const stats = await (await api("/api/admin/bans?type=stats", admin)).json()
    expect(stats).toMatchObject({ activeIpBans: expect.any(Number), bannedUsers: expect.any(Number) })
    expect((await api("/api/admin/bans?type=nope", admin)).status).toBe(400)
  })
})
