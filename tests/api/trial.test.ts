import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, db } from "./helpers"

afterAll(() => db.$disconnect())

async function trialTeacher() {
  const user = await makeUser("TEACHER")
  const teacher = await db.teacher.create({ data: { userId: user.id, isTrialMode: true, hourlyRate: 40 } })
  return { user, teacher }
}
const future = () => new Date(Date.now() + 86_400_000).toISOString()

describe("trial room access", () => {
  it("candidate and admin get tokens; strangers and other teachers do not", async () => {
    const { user, teacher } = await trialTeacher()
    const admin = await makeUser("ADMIN")
    const stranger = await makeUser("STUDENT")
    const otherTeacher = await makeUser("TEACHER")
    await db.teacher.create({ data: { userId: otherTeacher.id, isTrialMode: true } })

    expect((await json("/api/room/trial", null, "POST", {})).status).toBe(401)

    const own = await json("/api/room/trial", user, "POST", {})
    expect(own.status).toBe(200)
    const ownBody = await own.json()
    expect(ownBody.role).toBe("candidate")
    expect(ownBody.roomName).toBe(`trial-${teacher.id}`)

    const rev = await json("/api/room/trial", admin, "POST", { teacherId: teacher.id })
    expect((await rev.json()).role).toBe("reviewer")

    expect((await json("/api/room/trial", stranger, "POST", { teacherId: teacher.id })).status).toBe(403)
    expect((await json("/api/room/trial", otherTeacher, "POST", { teacherId: teacher.id })).status).toBe(403)
    // an admin without a teacherId and without a teacher profile → nothing to join
    expect((await json("/api/room/trial", admin, "POST", {})).status).toBe(404)
  })

  it("an approved teacher no longer needs (or gets) a trial room", async () => {
    const user = await makeUser("TEACHER")
    await db.teacher.create({ data: { userId: user.id, isTrialMode: false } })
    const res = await json("/api/room/trial", user, "POST", {})
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("ALREADY_APPROVED")
  })
})

describe("unapproved teachers cannot teach the public", () => {
  it("no public broadcast, no workshop, no bookings — until approved", async () => {
    const { user, teacher } = await trialTeacher()
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")

    // a trial-phase teacher may go live, but only as a supervised broadcast; workshop broadcasts stay approved-only
    const wsLive = await json("/api/room/instant", user, "POST", { title: "Atölye", workshopId: "x" })
    expect(wsLive.status).toBe(403)
    expect((await wsLive.json()).code).toBe("TRIAL_REQUIRED")
    expect((await db.liveRoom.count({ where: { teacherId: teacher.id } }))).toBe(0)
    const live = await json("/api/room/instant", user, "POST", { title: "Deneme yayını" })
    expect(live.status).toBe(200)
    expect((await live.json()).supervised).toBe(true)
    expect((await db.liveRoom.findFirstOrThrow({ where: { teacherId: teacher.id } })).supervised).toBe(true)

    const ws = await json("/api/workshops", user, "POST", {
      title: "Deneme Atölyesi", description: "Bu atölye onaysız öğretmen tarafından açılmaya çalışılıyor, reddedilmeli.", category: "Hatha", startsAt: future(),
    })
    expect(ws.status).toBe(403)

    const book = await json("/api/bookings", student, "POST", { teacherSlug: "x", slot: future(), type: "regular" })
    expect([403, 404]).toContain(book.status) // name lookup may miss; the mobile endpoint takes the id:
    const mobile = await json("/api/mobile/bookings", student, "POST", { teacherId: teacher.id, slot: future(), type: "regular" })
    expect(mobile.status).toBe(403)
    expect((await mobile.json()).code).toBe("TEACHER_NOT_APPROVED")

    // not listed publicly
    const list = await (await api("/api/teachers")).json()
    expect(list.map((t: any) => t.id)).not.toContain(teacher.id)

    // admin approves → everything opens up
    expect((await json(`/api/admin/teachers/${teacher.id}/trial`, admin, "POST", { action: "approve" })).status).toBe(200)
    expect((await json("/api/room/instant", user, "POST", { title: "Gerçek yayın" })).status).toBe(200)
    const list2 = await (await api("/api/teachers")).json()
    expect(list2.map((t: any) => t.id)).toContain(teacher.id)
    expect((await json("/api/mobile/bookings", student, "POST", { teacherId: teacher.id, slot: future(), type: "regular" })).status).not.toBe(403)
    await json("/api/room/instant", user, "DELETE", { liveRoomId: (await db.liveRoom.findFirst({ where: { teacherId: teacher.id } }))!.id })
  })
})

describe("admin decisions", () => {
  it("only admins decide; reject/revoke need a reason; states are enforced; everything is audited", async () => {
    const { user, teacher } = await trialTeacher()
    const admin = await makeUser("ADMIN")
    const other = await makeUser("TEACHER")
    const url = `/api/admin/teachers/${teacher.id}/trial`

    expect((await json(url, user, "POST", { action: "approve" })).status).toBe(401) // self-approval
    expect((await json(url, other, "POST", { action: "approve" })).status).toBe(401)
    expect((await json(url, null, "POST", { action: "approve" })).status).toBe(401)

    // reject: reason required, teacher stays in trial and sees the note
    expect((await json(url, admin, "POST", { action: "reject" })).status).toBe(400)
    expect((await json(url, admin, "POST", { action: "reject", note: "Ses kalitesi yetersiz" })).status).toBe(200)
    let row = await db.teacher.findUnique({ where: { id: teacher.id } })
    expect(row?.isTrialMode).toBe(true)
    expect(row?.trialNote).toBe("Ses kalitesi yetersiz")
    // cannot revoke someone who is not approved
    expect((await json(url, admin, "POST", { action: "revoke", note: "x" })).status).toBe(409)

    expect((await json(url, admin, "POST", { action: "approve" })).status).toBe(200)
    expect((await json(url, admin, "POST", { action: "approve" })).status).toBe(409) // already approved
    row = await db.teacher.findUnique({ where: { id: teacher.id } })
    expect(row?.isTrialMode).toBe(false)
    expect(row?.trialNote).toBeNull()

    // revoke: closes live rooms, unpublishes workshops, trial mode again
    const live = await json("/api/room/instant", user, "POST", { title: "Yayın" })
    const liveRoomId = (await live.json()).liveRoomId
    const w = await json("/api/workshops", user, "POST", {
      title: "Onaylı Atölye", description: "Onaylı öğretmenin atölyesi; onay kaldırılınca taslağa dönmeli.", category: "Hatha", startsAt: future(),
    })
    const wid = (await w.json()).workshop.id
    expect((await json(url, admin, "POST", { action: "revoke" })).status).toBe(400)
    expect((await json(url, admin, "POST", { action: "revoke", note: "Uygunsuz davranış" })).status).toBe(200)
    expect((await db.teacher.findUnique({ where: { id: teacher.id } }))?.isTrialMode).toBe(true)
    expect((await db.liveRoom.findUnique({ where: { id: liveRoomId } }))?.isActive).toBe(false)
    expect((await db.workshop.findUnique({ where: { id: wid } }))?.status).toBe("DRAFT")
    const again = await json("/api/room/instant", user, "POST", {})
    expect(again.status).toBe(200) // revoked = back in the trial phase: allowed to broadcast, but supervised again
    expect((await again.json()).supervised).toBe(true)

    const logs = await db.auditLog.findMany({ where: { targetId: teacher.id }, orderBy: { createdAt: "asc" } })
    expect(logs.map((l) => l.action)).toEqual(["TRIAL_REJECT", "TRIAL_APPROVE", "TRIAL_REVOKE"])
  })

  it("the old approve-trial endpoint still works and is admin-only; the trials list shows candidates", async () => {
    const { user, teacher } = await trialTeacher()
    const admin = await makeUser("ADMIN")
    expect((await api("/api/admin/trials", user)).status).toBe(401)
    const list = await (await api("/api/admin/trials", admin)).json()
    const mine = list.trials.find((t: any) => t.id === teacher.id)
    expect(mine).toBeTruthy()
    expect(mine.inRoom).toBe(false)
    expect((await api(`/api/admin/teachers/${teacher.id}/approve-trial`, user, { method: "POST" })).status).toBe(401)
    expect((await api(`/api/admin/teachers/${teacher.id}/approve-trial`, admin, { method: "POST" })).status).toBe(200)
  })
})
