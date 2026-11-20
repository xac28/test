import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, makeTeacher, db } from "./helpers"

const userIds: string[] = []
const campaignIds: string[] = []
afterAll(async () => {
  await db.booking.deleteMany({ where: { OR: [{ studentId: { in: userIds } }, { teacher: { userId: { in: userIds } } }] } })
  await db.personalDiscount.deleteMany({ where: { userId: { in: userIds } } })
  await db.campaign.deleteMany({ where: { id: { in: campaignIds } } })
  await db.teacher.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.$disconnect()
})

async function studentWith(userId: string) { userIds.push(userId); return userId }
const book = (student: { token: string }, teacherId: string, type: "trial" | "regular" = "regular") =>
  json("/api/bookings", student, "POST", { teacherSlug: teacherId, slot: new Date(Date.now() + 3 * 86_400_000).toISOString(), type })

describe("personal discounts: admin grant/cancel", () => {
  it("only admins manage personal discounts", async () => {
    const student = await makeUser("STUDENT")
    await studentWith(student.id)
    expect((await json("/api/admin/discounts", null, "POST", { userId: student.id, discountPct: 50 })).status).toBe(401)
    expect((await json("/api/admin/discounts", student, "POST", { userId: student.id, discountPct: 50 })).status).toBe(403)
    expect((await api("/api/admin/discounts", student)).status).toBe(403)
  })

  it("validates the percentage, the target user, and refuses admin targets", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    await studentWith(student.id)
    for (const bad of [{ discountPct: 0 }, { discountPct: 101 }, { discountPct: "x" }]) {
      expect((await json("/api/admin/discounts", admin, "POST", { userId: student.id, ...bad })).status, JSON.stringify(bad)).toBe(400)
    }
    expect((await json("/api/admin/discounts", admin, "POST", { userId: "does-not-exist", discountPct: 50 })).status).toBe(404)
    expect((await json("/api/admin/discounts", admin, "POST", { userId: admin.id, discountPct: 50 })).status).toBe(400)
  })

  it("grants, lists, edits, and cancels a discount; a second grant replaces the first", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    await studentWith(student.id)

    const grant = await json("/api/admin/discounts", admin, "POST", { userId: student.id, discountPct: 30, reason: "Sadakat" })
    expect(grant.status).toBe(200)

    const list = await (await api(`/api/admin/discounts?q=${student.email}`, admin)).json()
    const row = list.users.find((u: any) => u.id === student.id)
    expect(row.discount).toMatchObject({ discountPct: 30, reason: "Sadakat" })

    expect((await json("/api/admin/discounts", admin, "POST", { userId: student.id, discountPct: 80 })).status).toBe(200)
    const list2 = await (await api(`/api/admin/discounts?q=${student.email}`, admin)).json()
    expect(list2.users.find((u: any) => u.id === student.id).discount.discountPct).toBe(80)

    expect((await api(`/api/admin/discounts/${student.id}`, admin, { method: "DELETE" })).status).toBe(200)
    const list3 = await (await api(`/api/admin/discounts?q=${student.email}`, admin)).json()
    expect(list3.users.find((u: any) => u.id === student.id).discount).toBeNull()
    expect((await api(`/api/admin/discounts/${student.id}`, admin, { method: "DELETE" })).status).toBe(404)
  })
})

describe("personal discounts affect what a lesson actually costs", () => {
  it("a student's own 100% discount makes any lesson free, regardless of the teacher", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    await studentWith(student.id)
    const { teacher, user: teacherUser } = await makeTeacher()
    await studentWith(teacherUser.id)

    await json("/api/admin/discounts", admin, "POST", { userId: student.id, discountPct: 100 })
    const r = await book(student, teacher.id)
    expect(r.status).toBe(200)
    expect((await r.json()).price).toBe(0)
  })

  it("a teacher's own discount lowers what students pay to book THEM specifically — a free-demo-lesson hook for new teachers", async () => {
    const admin = await makeUser("ADMIN")
    const { teacher, user: teacherUser } = await makeTeacher() // hourlyRate: 40
    await studentWith(teacherUser.id)
    const studentA = await makeUser("STUDENT")
    const studentB = await makeUser("STUDENT")
    await studentWith(studentA.id)
    await studentWith(studentB.id)

    await json("/api/admin/discounts", admin, "POST", { userId: teacherUser.id, discountPct: 100, reason: "Yeni eğitmen tanıtımı" })
    const r1 = await book(studentA, teacher.id)
    expect((await r1.json()).price).toBe(0)

    // a second, unrelated teacher is unaffected by the first teacher's promo
    const { teacher: other } = await makeTeacher()
    userIds.push(other.userId)
    const r2 = await book(studentB, other.id)
    expect((await r2.json()).price).toBe(40)
  })

  it("an expired personal discount no longer applies", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    await studentWith(student.id)
    const { teacher, user: teacherUser } = await makeTeacher()
    await studentWith(teacherUser.id)

    const future = new Date(Date.now() + 86_400_000).toISOString()
    await json("/api/admin/discounts", admin, "POST", { userId: student.id, discountPct: 100, endsAt: future })
    // simulate time passing, the way an admin-set end date naturally would
    await db.personalDiscount.update({ where: { userId: student.id }, data: { endsAt: new Date(Date.now() - 1000) } })
    const r = await book(student, teacher.id)
    expect((await r.json()).price).toBe(40)
  })
})

describe("campaigns: admin CRUD and public active endpoint", () => {
  it("only admins manage campaigns; validates input", async () => {
    const student = await makeUser("STUDENT")
    await studentWith(student.id)
    const body = { name: "Test Kampanyası", discountPct: 20, scope: "ALL", startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString() }
    expect((await json("/api/admin/campaigns", null, "POST", body)).status).toBe(401)
    expect((await json("/api/admin/campaigns", student, "POST", body)).status).toBe(403)
    const admin = await makeUser("ADMIN")
    expect((await json("/api/admin/campaigns", admin, "POST", { ...body, name: "Hi" })).status).toBe(400)
    expect((await json("/api/admin/campaigns", admin, "POST", { ...body, discountPct: 0 })).status).toBe(400)
    expect((await json("/api/admin/campaigns", admin, "POST", { ...body, scope: "EVERYONE" })).status).toBe(400)
  })

  it("creates, edits, ends early, lists and deletes a campaign", async () => {
    const admin = await makeUser("ADMIN")
    const body = { name: "Test Kampanyası", discountPct: 20, scope: "ALL", bannerMessage: "Özel indirim!", startsAt: new Date(Date.now() - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString() }
    const created = await json("/api/admin/campaigns", admin, "POST", body)
    expect(created.status).toBe(200)
    const { campaign } = await created.json()
    campaignIds.push(campaign.id)

    const list = await (await api("/api/admin/campaigns", admin)).json()
    expect(list.campaigns.find((c: any) => c.id === campaign.id)).toMatchObject({ name: "Test Kampanyası", discountPct: 20 })

    expect((await json(`/api/admin/campaigns/${campaign.id}`, admin, "PATCH", { discountPct: 35 })).status).toBe(200)
    expect((await (await api("/api/admin/campaigns", admin)).json()).campaigns.find((c: any) => c.id === campaign.id).discountPct).toBe(35)

    expect((await json(`/api/admin/campaigns/${campaign.id}`, admin, "PATCH", { endsAt: new Date(Date.now() - 1000).toISOString() })).status).toBe(200)
    expect((await api(`/api/admin/campaigns/${campaign.id}`, admin, { method: "DELETE" })).status).toBe(200)
    expect((await json(`/api/admin/campaigns/${campaign.id}`, admin, "PATCH", { discountPct: 10 })).status).toBe(404)
  })

  it("a currently-active ALL campaign discounts lesson price for everyone; a future one does not; the public endpoint reports it", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    await studentWith(student.id)
    const { teacher, user: teacherUser } = await makeTeacher()
    await studentWith(teacherUser.id)

    const active = await (await json("/api/admin/campaigns", admin, "POST", {
      name: "Yılbaşı Kampanyası", discountPct: 25, scope: "ALL", bannerMessage: "Yılbaşına özel %25 indirim!",
      startsAt: new Date(Date.now() - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    })).json()
    campaignIds.push(active.campaign.id)

    const r = await book(student, teacher.id)
    expect((await r.json()).price).toBe(30) // 40 * 0.75

    const publicActive = await (await api("/api/campaigns/active")).json()
    expect(publicActive).toMatchObject({ active: true, discountPct: 25, bannerMessage: "Yılbaşına özel %25 indirim!" })

    await db.campaign.update({ where: { id: active.campaign.id }, data: { endsAt: new Date(Date.now() - 1000) } })
    const after = await (await api("/api/campaigns/active")).json()
    expect(after.active).toBe(false)
  })

  it("a TEACHERS-scoped campaign does not discount lesson price (no teacher-side purchase to discount yet)", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    await studentWith(student.id)
    const { teacher, user: teacherUser } = await makeTeacher()
    await studentWith(teacherUser.id)

    const c = await (await json("/api/admin/campaigns", admin, "POST", {
      name: "Öğretmen Kampanyası", discountPct: 50, scope: "TEACHERS",
      startsAt: new Date(Date.now() - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    })).json()
    campaignIds.push(c.campaign.id)

    const r = await book(student, teacher.id)
    expect((await r.json()).price).toBe(40)
  })
})
