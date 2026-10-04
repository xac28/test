import { describe, it, expect, afterAll } from "vitest"
import crypto from "crypto"
import { api, json, makeUser, makeTeacher, db } from "./helpers"

afterAll(() => db.$disconnect())
const tag = () => crypto.randomBytes(3).toString("hex")
const ask = (message: unknown, user?: { token: string } | null) => json("/api/ai/recommend", user ?? null, "POST", { message })

describe("AYA Rehber API", () => {
  it("validates input and caps the message length", async () => {
    expect((await ask("")).status).toBe(400)
    expect((await ask("   ")).status).toBe(400)
    expect((await ask(42 as any)).status).toBe(400)
    expect((await json("/api/ai/recommend", null, "POST", {})).status).toBe(400)
    const long = await ask("yoga ".repeat(5000))
    expect(long.status).toBe(200)
  })

  it("routes by intent with real internal links", async () => {
    const cases: [string, string, string][] = [
      ["Eğitmen olmak istiyorum", "become_teacher", "/become-teacher"],
      ["Üye olmak istiyorum", "account", "/login?mode=register"],
      ["Atölyeleri göster", "workshops", "/atolyeler"],
      ["Paket fiyatları", "pricing", "/pricing"],
      ["Bir eğitmeni şikayet etmek istiyorum", "report", "/login?mode=register"],
      ["Canlı yayın var mı?", "live", "/live"],
      ["nefes yazıları", "articles", "/icerikler"],
    ]
    for (const [q, intent, href] of cases) {
      const r = await (await ask(q)).json()
      expect(r.intent, q).toBe(intent)
      expect(r.reply.length, q).toBeGreaterThan(20)
      expect(r.links.map((l: any) => l.href), q).toContain(href)
    }
  })

  it("is aware of who is asking", async () => {
    const teacher = (await makeTeacher()).user
    const student = await makeUser("STUDENT")
    expect((await (await ask("eğitmen olmak istiyorum", teacher)).json()).links[0].href).toBe("/teach")
    expect((await (await ask("ödeme talebi nasıl", teacher)).json()).links[0].href).toBe("/teach/earnings")
    const member = await (await ask("atölyeleri göster", student)).json()
    expect(member.links.some((l: any) => l.href.startsWith("/login"))).toBe(false)
    const visitor = await (await ask("atölyeleri göster")).json()
    expect(visitor.links.some((l: any) => l.href.startsWith("/login"))).toBe(true)
  })

  it("lists running broadcasts and links to them", async () => {
    const { teacher } = await makeTeacher()
    const room = await db.liveRoom.create({ data: { teacherId: teacher.id, roomName: `ai-${tag()}`, title: `Rehber Yayını ${tag()}` } })
    const r = await (await ask("şu an canlı yayın var mı")).json()
    expect(r.intent).toBe("live")
    expect(r.links.map((l: any) => l.href)).toContain(`/live/${room.id}`)
    await db.liveRoom.update({ where: { id: room.id }, data: { isActive: false, endedAt: new Date() } })
  })

  it("recommends only approved teachers, and every recommended profile exists", async () => {
    await db.teacher.updateMany({ where: { hourlyRate: { lte: 1 } }, data: { hourlyRate: 40 } }) // leftovers of earlier runs
    const trial = await makeUser("TEACHER")
    const trialT = await db.teacher.create({ data: { userId: trial.id, isTrialMode: true, hourlyRate: 1, specialties: JSON.stringify(["Yin Yoga"]) } })
    const approved = await makeUser("TEACHER")
    const approvedT = await db.teacher.create({ data: { userId: approved.id, isTrialMode: false, hourlyRate: 1, specialties: JSON.stringify(["Yin Yoga"]) } })

    // cheapest first → the new $1 teachers would be on top if they were eligible
    const r = await (await ask("ucuz yin yoga esneme hocası")).json()
    const ids = r.teachers.map((t: any) => t.id)
    expect(ids).not.toContain(trialT.id)
    expect(ids).toContain(approvedT.id)
    for (const t of r.teachers) {
      expect(t.href).toMatch(/^\/teachers\/[A-Za-z0-9_-]+$/)
      if (t.id === approvedT.id) expect((await api(`/api/teachers/${t.id}`)).status).toBe(200)
    }
    // the unapproved profile is not public
    expect((await api(`/api/teachers/${trialT.id}`)).status).toBe(404)
  })

  it("replies never echo markup from the visitor", async () => {
    const r = await (await ask("<img src=x onerror=alert(1)> yoga")).json()
    expect(r.reply).not.toContain("<img")
  })
})

describe("database teacher profiles", () => {
  it("returns a bookable profile with real, future, free slots only", async () => {
    const { user, teacher } = await makeTeacher()
    await db.user.update({ where: { id: user.id }, data: { name: `Profil Hoca ${tag()}` } })
    await db.availability.createMany({ data: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ teacherId: teacher.id, dayOfWeek: d, startTime: "09:00", endTime: "12:00" })) })

    const res = await api(`/api/teachers/${teacher.id}`)
    expect(res.status).toBe(200)
    const p = await res.json()
    expect(p).toMatchObject({ id: teacher.id, slug: teacher.id, pricePerClassUSD: 40, trialPriceUSD: 20 })
    expect(p.availability.length).toBeGreaterThan(20)
    const now = Date.now()
    for (const s of p.availability) {
      expect(new Date(s).getTime()).toBeGreaterThan(now)
      expect([9, 10, 11]).toContain(new Date(s).getUTCHours())
    }

    // book one → it disappears, and the booking API accepts the teacher id as the slug
    const student = await makeUser("STUDENT")
    const slot = p.availability[0]
    const book = await json("/api/bookings", student, "POST", { teacherSlug: teacher.id, slot, type: "regular" })
    expect(book.status).toBe(200)
    const after = await (await api(`/api/teachers/${teacher.id}`)).json()
    expect(after.availability).not.toContain(slot)
    expect(after.availability.length).toBe(p.availability.length - 1)
  })

  it("unknown ids are 404", async () => {
    expect((await api("/api/teachers/does-not-exist")).status).toBe(404)
  })
})
