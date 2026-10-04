import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, makeTeacher, makeBooking, db } from "./helpers"

afterAll(() => db.$disconnect())

const poach = (user: { token: string }, text = "Bana instagramdan ulaş: @ayse.yoga, ders ücretsiz") =>
  json("/api/messages", user, "POST", { targetUserId: "x", content: text })

/** pretend the previous violation happened long ago, so that the next one counts as a new incident */
const age = (userId: string) => db.policyViolation.updateMany({ where: { userId }, data: { createdAt: new Date(Date.now() - 2 * 3_600_000) } })

async function send(teacher: { token: string }, to: string, text: string) {
  return json("/api/messages", teacher, "POST", { targetUserId: to, content: text })
}

describe("taking students off the platform: warning → 10 days → ban", () => {
  it("walks the ladder, blocks every attempt, hides the teacher and gates actions", async () => {
    const admin = await makeUser("ADMIN")
    const { user: t } = await makeTeacher()
    const student = await makeUser("STUDENT")

    // clean messages are fine
    expect((await send(t, student.id, "Merhaba, ders saatimizi onaylıyorum")).status).toBe(200)

    // 1st: blocked + official warning
    const r1 = await send(t, student.id, "Bana instagramdan ulaş: @ayse.yoga")
    expect(r1.status).toBe(422)
    const d1 = await r1.json()
    expect(d1.code).toBe("POLICY")
    expect(d1.policy).toMatchObject({ strike: 1, action: "WARNED" })
    expect(d1.error).toContain("resmi uyarı")
    expect(await db.message.count({ where: { senderId: t.id, content: { contains: "instagram" } } })).toBe(0)
    expect(await db.userWarning.count({ where: { userId: t.id } })).toBe(1)
    expect(await db.notification.count({ where: { userId: t.id, type: "WARNING" } })).toBe(1)
    expect((await db.user.findUniqueOrThrow({ where: { id: t.id } })).suspendedUntil).toBeNull()

    // the same attempt again right away is logged but does not count
    const again = await (await send(t, student.id, "Bana instagramdan ulaş: @ayse.yoga")).json()
    expect(again.policy).toMatchObject({ action: "NONE" })
    expect(again.error).toContain("sayılmadı")
    expect(await db.policyViolation.count({ where: { userId: t.id } })).toBe(2)
    expect(await db.policyViolation.count({ where: { userId: t.id, counted: true } })).toBe(1)

    // 2nd (a new incident): 10 days off
    await age(t.id)
    const r2 = await send(t, student.id, "WhatsApp numaram 0532 123 45 67")
    expect(r2.status).toBe(403)
    const d2 = await r2.json()
    expect(d2.policy).toMatchObject({ strike: 2, action: "SUSPENDED" })
    const after = await db.user.findUniqueOrThrow({ where: { id: t.id } })
    const days = (after.suspendedUntil!.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(9.9)
    expect(days).toBeLessThan(10.1)

    // while suspended: cannot message, post, teach; not listed; cannot be booked
    const gated = await send(t, student.id, "normal bir mesaj")
    expect(gated.status).toBe(403)
    expect((await gated.json()).code).toBe("SUSPENDED")
    expect((await json("/api/community", t, "POST", { image: "/x", content: "merhaba herkese" })).status).toBe(403)
    const list = await (await api("/api/teachers")).json()
    expect(list.some((x: any) => x.id && x.name === (after.name))).toBe(false)
    const teacher = await db.teacher.findUniqueOrThrow({ where: { userId: t.id } })
    expect((await api(`/api/teachers/${teacher.id}`)).status).toBe(404)
    const w = await (await api("/api/warnings", t)).json()
    expect(w.suspension).toBeTruthy()
    expect(await db.notification.count({ where: { userId: admin.id, title: "Eğitmen 10 gün uzaklaştırıldı" } })).toBeGreaterThan(0)

    // 3rd: permanent ban
    await db.user.update({ where: { id: t.id }, data: { suspendedUntil: null } }) // pretend the 10 days passed
    await age(t.id)
    const r3 = await send(t, student.id, "Telegram: @ayse_yoga")
    expect(r3.status).toBe(403)
    expect((await r3.json()).policy).toMatchObject({ strike: 3, action: "BANNED" })
    const banned = await db.user.findUniqueOrThrow({ where: { id: t.id } })
    expect(banned.banned).toBe(true)
    expect(banned.banReason).toContain("platform dışına yönlendirme")
    expect(await db.eventLog.count({ where: { userId: t.id, type: "SECURITY" } })).toBeGreaterThanOrEqual(3)
  })

  it("covers profile text, workshops, video titles and the live chat check", async () => {
    const { user: t } = await makeTeacher()
    // profile text
    const p = await json("/api/teacher/profile", t, "PATCH", { bio: "Yoga öğretmeniyim, kendi kursuma katılmak için WhatsApp'tan yaz." })
    expect(p.status).toBe(422)
    expect((await p.json()).policy).toMatchObject({ strike: 1, action: "WARNED" })
    await age(t.id)
    expect((await db.teacher.findUniqueOrThrow({ where: { userId: t.id } })).bio).toBe("t")
    // video title
    const up = await json("/api/teacher/videos", t, "POST", { title: "Dersler için instagram: ayse.yoga", videoUrl: "https://example.com/a.mp4" })
    expect(up.status).toBe(403) // 2nd violation → suspended
    expect((await up.json()).policy.action).toBe("SUSPENDED")

    // workshop + live chat on a fresh teacher
    const { user: t2 } = await makeTeacher()
    const start = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const ws = await json("/api/workshops", t2, "POST", { title: "Sabah akışı", description: "Sabah akışı için kayıt olun; ayrıntılar için bana WhatsApp'tan yazın, dışarıda ödeme yaparız. ".repeat(2), category: "Hatha", level: "Tüm seviyeler", mode: "LIVE", startsAt: start, durationMin: 60, capacity: 10, priceUsd: 0 })
    expect(ws.status).toBe(422)
    await age(t2.id)
    const chat = await json("/api/policy/check", t2, "POST", { text: "takip et: @ayse_yoga" })
    expect(chat.status).toBe(403) // second incident for this teacher
    const okChat = await (await json("/api/policy/check", await makeUser("ADMIN"), "POST", { text: "@ayse_yoga" })).json()
    expect(okChat.ok).toBe(true) // admins are exempt
  })

  it("students are not on the ladder: their handle is blocked by the normal community filter", async () => {
    const s = await makeUser("STUDENT")
    const r = await json("/api/messages", s, "POST", { targetUserId: (await makeUser("STUDENT")).id, content: "instagram: ayse.yoga" })
    expect(r.status).toBe(422)
    expect((await r.json()).code).toBe("CONTACT")
    expect(await db.policyViolation.count({ where: { userId: s.id } })).toBe(0)
  })

  it("applications with contact pointers are refused before they reach an admin", async () => {
    const u = await makeUser("STUDENT")
    const res = await json("/api/teachers/apply", u, "POST", { firstName: "Ayşe", lastName: "Yılmaz", phone: "+905321234567", country: "TR", specialties: ["hatha"], experience: "10 yıllık deneyim. Instagram: ayse.yoga" })
    expect(res.status).toBe(422)
    expect(await res.text()).toContain("platform dışına yönlendirme")
  })
})

describe("admin: violation log, forgiving, lifting, scanning", () => {
  it("lists violations, forgives a false positive (which lifts the suspension) and exports CSV", async () => {
    const admin = await makeUser("ADMIN")
    const { user: t } = await makeTeacher()
    const s = await makeUser("STUDENT")
    await send(t, s.id, "instagram: ayse.yoga")
    await age(t.id)
    await send(t, s.id, "WhatsApp 0532 123 45 67")
    expect((await db.user.findUniqueOrThrow({ where: { id: t.id } })).suspendedUntil).not.toBeNull()

    expect((await api("/api/admin/policy", t)).status).toBe(403)
    const log = await (await api(`/api/admin/policy?view=violations&q=${encodeURIComponent(t.email)}`, admin)).json()
    expect(log.violations).toHaveLength(2)
    expect(log.stats.suspendedNow).toBeGreaterThan(0)
    const users = await (await api("/api/admin/policy?view=users", admin)).json()
    expect(users.items.some((i: any) => i.user.id === t.id && i.strikes === 2)).toBe(true)

    // forgive the second one → one strike left → suspension lifted
    const second = log.violations.find((v: any) => v.strike === 2)
    const f = await (await json("/api/admin/policy", admin, "POST", { action: "forgive", id: second.id, reason: "yanlış alarm" })).json()
    expect(f).toMatchObject({ success: true, strikesLeft: 1, lifted: true })
    expect((await db.user.findUniqueOrThrow({ where: { id: t.id } })).suspendedUntil).toBeNull()
    expect((await json("/api/admin/policy", admin, "POST", { action: "forgive", id: second.id })).status).toBe(409)
    expect(await db.auditLog.count({ where: { actorId: admin.id, action: "POLICY_FORGIVE", targetId: t.id } })).toBe(1)

    // manual suspend / lift
    expect((await json("/api/admin/policy", admin, "POST", { action: "suspend", userId: t.id, reason: "kısa" })).status).toBe(400)
    expect((await json("/api/admin/policy", admin, "POST", { action: "suspend", userId: t.id, days: 3, reason: "Elle uzaklaştırma testi" })).status).toBe(200)
    expect((await json("/api/admin/policy", admin, "POST", { action: "lift", userId: t.id })).status).toBe(200)
    expect((await json("/api/admin/policy", admin, "POST", { action: "lift", userId: t.id })).status).toBe(409)

    const csv = await api(`/api/admin/policy?view=violations&format=csv&q=${encodeURIComponent(t.email)}`, admin)
    expect(csv.headers.get("content-type")).toContain("text/csv")
    expect(await csv.text()).toContain("WARNED")
  })

  it("scans published texts for existing violations and records them", async () => {
    const admin = await makeUser("ADMIN")
    const { user: t, teacher } = await makeTeacher()
    await db.teacher.update({ where: { id: teacher.id }, data: { bio: "Derslerim için Instagram: ayse.yoga hesabımı takip edin." } })
    const scan = await (await api(`/api/admin/policy?view=scan&q=${encodeURIComponent(t.email)}`, admin)).json()
    expect(scan.hits).toHaveLength(1)
    expect(scan.hits[0]).toMatchObject({ field: "Profil metni" })
    const rec = await (await json("/api/admin/policy", admin, "POST", { action: "record", userId: t.id, text: scan.hits[0].text })).json()
    expect(rec.outcome).toMatchObject({ strike: 1, action: "WARNED" })
    expect((await json("/api/admin/policy", admin, "POST", { action: "record", userId: t.id, text: "Güzel bir yoga dersi" })).status).toBe(400)
  })
})
