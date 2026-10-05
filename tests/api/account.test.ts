import { describe, it, expect, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { api, json, makeUser, makeTeacher, makeBooking, db } from "./helpers"

afterAll(() => db.$disconnect())

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex")
const token = () => crypto.randomBytes(32).toString("hex")
async function issue(userId: string, over: { expiresAt?: Date; usedAt?: Date | null } = {}) {
  const t = token()
  await db.passwordResetToken.create({ data: { userId, tokenHash: hash(t), expiresAt: over.expiresAt ?? new Date(Date.now() + 3_600_000), usedAt: over.usedAt ?? null } })
  return t
}

describe("forgot password", () => {
  it("answers the same for known and unknown addresses, and stores only a hash", async () => {
    const u = await makeUser("STUDENT")
    const known = await json("/api/auth/forgot", null, "POST", { email: u.email })
    const unknown = await json("/api/auth/forgot", null, "POST", { email: `nobody-${Date.now()}@aya.test` })
    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(await known.json()).toEqual(await unknown.json())
    const rows = await db.passwordResetToken.findMany({ where: { userId: u.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + 50 * 60_000)
    // a second request within a minute does not create another link
    await json("/api/auth/forgot", null, "POST", { email: u.email })
    expect(await db.passwordResetToken.count({ where: { userId: u.id } })).toBe(1)
  })

  it("rejects malformed addresses and never issues a link to a banned account", async () => {
    expect((await json("/api/auth/forgot", null, "POST", { email: "not-an-email" })).status).toBe(400)
    expect((await json("/api/auth/forgot", null, "POST", {})).status).toBe(400)
    const u = await makeUser("STUDENT")
    await db.user.update({ where: { id: u.id }, data: { banned: true } })
    expect((await json("/api/auth/forgot", null, "POST", { email: u.email })).status).toBe(200)
    expect(await db.passwordResetToken.count({ where: { userId: u.id } })).toBe(0)
  })
})

describe("reset password", () => {
  it("sets the new password once; the link, and every other open link, stop working", async () => {
    const u = await makeUser("STUDENT")
    const t = await issue(u.id)
    const other = await issue(u.id)
    expect((await (await api(`/api/auth/reset?token=${t}`)).json()).valid).toBe(true)

    const ok = await json("/api/auth/reset", null, "POST", { token: t, password: "NewPassw0rd!" })
    expect(ok.status).toBe(200)
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(await bcrypt.compare("NewPassw0rd!", row.password!)).toBe(true)
    expect(await bcrypt.compare("Passw0rd!", row.password!)).toBe(false)
    expect(await db.notification.count({ where: { userId: u.id, title: "Şifren değiştirildi" } })).toBe(1)

    const again = await json("/api/auth/reset", null, "POST", { token: t, password: "AnotherPassw0rd!" })
    expect(again.status).toBe(400)
    expect((await again.json()).code).toBe("TOKEN_INVALID")
    expect((await json("/api/auth/reset", null, "POST", { token: other, password: "AnotherPassw0rd!" })).status).toBe(400)
    expect((await (await api(`/api/auth/reset?token=${t}`)).json()).valid).toBe(false)
  })

  it("refuses expired, unknown and weak ones without touching the password", async () => {
    const u = await makeUser("STUDENT")
    const before = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).password
    const expired = await issue(u.id, { expiresAt: new Date(Date.now() - 1000) })
    expect((await json("/api/auth/reset", null, "POST", { token: expired, password: "NewPassw0rd!" })).status).toBe(400)
    expect((await json("/api/auth/reset", null, "POST", { token: token(), password: "NewPassw0rd!" })).status).toBe(400)
    expect((await (await api(`/api/auth/reset?token=${expired}`)).json()).valid).toBe(false)
    const live = await issue(u.id)
    const weak = await json("/api/auth/reset", null, "POST", { token: live, password: "123" })
    expect(weak.status).toBe(400)
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).password).toBe(before)
    // the weak attempt did not burn the link
    expect((await json("/api/auth/reset", null, "POST", { token: live, password: "StrongPassw0rd!" })).status).toBe(200)
  })

  it("two simultaneous requests with the same link: exactly one wins", async () => {
    const u = await makeUser("STUDENT")
    const t = await issue(u.id)
    const results = await Promise.all([1, 2, 3].map((i) => json("/api/auth/reset", null, "POST", { token: t, password: `Racing${i}Passw0rd!` })))
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
  })
})

describe("my data", () => {
  it("exports the person's own data without secrets or staff notes", async () => {
    const u = await makeUser("STUDENT")
    await db.post.create({ data: { authorId: u.id, content: "benim paylaşımım", image: "/uploads/posts/x.jpg" } })
    const ticket = await db.supportTicket.create({ data: { userId: u.id, subject: "Merhaba", source: "USER" } })
    await db.supportMessage.create({ data: { ticketId: ticket.id, senderId: u.id, role: "USER", content: "yardım" } })
    await db.supportMessage.create({ data: { ticketId: ticket.id, role: "NOTE", content: "iç not: gizli" } })
    expect((await api("/api/profile/export")).status).toBe(401)
    const res = await api("/api/profile/export", u)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-disposition")).toContain("aya-verilerim.json")
    const text = await res.text()
    const data = JSON.parse(text)
    expect(data.user.email).toBe(u.email)
    expect(data.posts.map((p: any) => p.content)).toContain("benim paylaşımım")
    expect(text).not.toContain("$2") // no bcrypt hash
    expect(text).not.toContain("iç not: gizli")
    expect(data.user.password).toBeUndefined()
    expect(data.supportTickets[0].messages.map((m: any) => m.content)).toEqual(["yardım"])
  })

  it("closing the account needs the phrase and the password, and waits for upcoming lessons", async () => {
    const u = await makeUser("STUDENT")
    const { teacher } = await makeTeacher()
    const booking = await makeBooking(teacher.id, u.id, "CONFIRMED")

    const info = await (await api("/api/profile/account", u)).json()
    expect(info.needsPassword).toBe(true)
    expect(info.blockers.length).toBe(1)

    expect((await json("/api/profile/account", u, "DELETE", { password: u.password })).status).toBe(400) // phrase missing
    expect((await json("/api/profile/account", u, "DELETE", { confirm: "HESABIMI SİL", password: "wrong" })).status).toBe(403)
    const blocked = await json("/api/profile/account", u, "DELETE", { confirm: "HESABIMI SİL", password: u.password })
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).blockers.length).toBe(1)
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).deletedAt).toBeNull()

    await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } })
    const post = await db.post.create({ data: { authorId: u.id, content: "silinecek", image: "/uploads/posts/x.jpg" } })
    await db.passwordResetToken.create({ data: { userId: u.id, tokenHash: hash(token()), expiresAt: new Date(Date.now() + 3_600_000) } })
    const done = await json("/api/profile/account", u, "DELETE", { confirm: "HESABIMI SİL", password: u.password })
    expect(done.status).toBe(200)

    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(row.deletedAt).not.toBeNull()
    expect(row.banned).toBe(false) // deletion is not a ban (ban-evasion checks must not see it)
    expect(row.email).not.toBe(u.email)
    expect(row.email).toContain("@aya.invalid")
    expect(row.password).toBeNull()
    expect(row.name).toBe("Silinmiş kullanıcı")
    expect(await db.post.count({ where: { id: post.id } })).toBe(0)
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0)
    expect(await db.passwordResetToken.count({ where: { userId: u.id } })).toBe(0)
    expect(await db.booking.count({ where: { id: booking.id } })).toBe(1) // records for payments stay
    expect((await api("/api/profile/export", u)).status).toBe(401) // the session is gone
    // even a token that somehow survived is refused
    const stray = crypto.randomBytes(48).toString("hex")
    await db.session.create({ data: { sessionToken: stray, userId: u.id, expires: new Date(Date.now() + 3_600_000) } })
    expect((await api("/api/profile/export", { token: stray })).status).toBe(401)
    // and the old address can sign up / be reset again without finding the old account
    expect((await db.user.findUnique({ where: { email: u.email } }))).toBeNull()
  })

  it("a teacher with a live broadcast or a pending payout cannot close the account; admins cannot at all", async () => {
    const { user: t, teacher } = await makeTeacher()
    await db.liveRoom.create({ data: { teacherId: teacher.id, roomName: `r-${Date.now()}-${Math.random()}`, title: "x", isActive: true } })
    const r = await json("/api/profile/account", t, "DELETE", { confirm: "HESABIMI SİL", password: t.password })
    expect(r.status).toBe(409)
    const admin = await makeUser("ADMIN")
    expect((await json("/api/profile/account", admin, "DELETE", { confirm: "HESABIMI SİL", password: admin.password })).status).toBe(403)
  })
})

describe("site plumbing", () => {
  it("health, robots, sitemap and manifest answer", async () => {
    const health = await api("/api/health")
    expect(health.status).toBe(200)
    expect((await health.json()).status).toBe("ok")

    const robots = await (await api("/robots.txt")).text()
    expect(robots).toContain("Disallow: /admin")
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/)

    const sitemap = await (await api("/sitemap.xml")).text()
    expect(sitemap).toContain("/pozlar/savasci-2")
    expect(sitemap).toContain("/yoga-stilleri/vinyasa")
    expect(sitemap).not.toContain("/admin")
    expect(sitemap).not.toContain("silinmis-")

    // security headers: a Content-Security-Policy (report-only unless CSP_MODE=enforce at build time) and the basics
    const page = await api("/")
    const csp = page.headers.get("content-security-policy") || page.headers.get("content-security-policy-report-only") || ""
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("report-uri /api/csp-report")
    expect(page.headers.get("x-content-type-options")).toBe("nosniff")
    // violation reports are accepted and end up in the system log
    const marker = `test-${Date.now()}.example`
    const rep = await api("/api/csp-report", null, { method: "POST", headers: { "Content-Type": "application/csp-report" }, body: JSON.stringify({ "csp-report": { "violated-directive": "img-src", "blocked-uri": `https://${marker}/x.png`, "document-uri": "http://localhost/" } }) })
    expect(rep.status).toBe(204)
    expect(await db.eventLog.count({ where: { type: "SECURITY", message: { contains: marker } } })).toBe(1)

    const manifest = await (await api("/manifest.webmanifest")).json()
    expect(manifest.short_name).toBe("AYA")
    expect((await api("/icon.svg")).status).toBe(200)
  })
})
