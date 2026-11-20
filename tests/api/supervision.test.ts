import { describe, it, expect, afterAll, beforeAll } from "vitest"
import { api, json, makeUser, makeTeacher, db } from "./helpers"

afterAll(() => db.$disconnect())

function jwtPayload(token: string) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
}
async function trialTeacher() {
  const t = await makeTeacher()
  await db.teacher.update({ where: { id: t.teacher.id }, data: { isTrialMode: true } })
  return t
}
const endAll = () => db.liveRoom.updateMany({ where: { isActive: true }, data: { isActive: false, endedAt: new Date() } })
let viewer: Awaited<ReturnType<typeof makeUser>>
beforeAll(async () => { await endAll(); viewer = await makeUser("STUDENT") })

describe("trial-phase teachers broadcast under supervision", () => {
  it("a trial teacher may go live: the room is flagged, officials are alerted, workshops stay closed", async () => {
    const admin = await makeUser("ADMIN")
    const { user, teacher } = await trialTeacher()
    const before = await db.notification.count({ where: { userId: admin.id, title: "Deneme öğretmeni yayında" } })

    const res = await json("/api/room/instant", user, "POST", { title: "İlk deneme yayınım" })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.supervised).toBe(true)
    const room = await db.liveRoom.findUniqueOrThrow({ where: { id: body.liveRoomId } })
    expect(room.supervised).toBe(true)
    expect(await db.notification.count({ where: { userId: admin.id, title: "Deneme öğretmeni yayında" } })).toBe(before + 1)
    expect(await db.eventLog.count({ where: { type: "LIVE", message: { contains: "Denetimli yayın başladı" }, userId: user.id } })).toBeGreaterThan(0)

    // resume reports the flag too
    expect((await (await api("/api/room/instant", user)).json()).active.supervised).toBe(true)

    // the directory shows who is trial and what is supervised
    const list = await (await api("/api/live", viewer)).json()
    const row = (list.broadcasts ?? list).find((b: any) => b.id === body.liveRoomId)
    expect(row.supervised).toBe(true)
    expect(row.teacher.trial).toBe(true)
    await json("/api/room/instant", user, "DELETE", { liveRoomId: body.liveRoomId })
    void teacher
  })

  it("an approved teacher is not supervised and does not alert anybody", async () => {
    const admin = await makeUser("ADMIN")
    const { user } = await makeTeacher()
    const before = await db.notification.count({ where: { userId: admin.id, title: "Deneme öğretmeni yayında" } })
    const body = await (await json("/api/room/instant", user, "POST", { title: "Onaylı yayın" })).json()
    expect(body.supervised).toBe(false)
    expect((await db.liveRoom.findUniqueOrThrow({ where: { id: body.liveRoomId } })).supervised).toBe(false)
    expect(await db.notification.count({ where: { userId: admin.id, title: "Deneme öğretmeni yayında" } })).toBe(before)
    const list = await (await api("/api/live", viewer)).json()
    expect(((list.broadcasts ?? list).find((b: any) => b.id === body.liveRoomId)).teacher.trial).toBe(false)
    await json("/api/room/instant", user, "DELETE", { liveRoomId: body.liveRoomId })
  })

  it("students, suspended teachers and anonymous visitors still cannot open a broadcast", async () => {
    const student = await makeUser("STUDENT")
    expect((await json("/api/room/instant", student, "POST", { title: "x" })).status).toBe(403)
    expect((await json("/api/room/instant", null, "POST", { title: "x" })).status).toBe(401)
    const { user } = await trialTeacher()
    await db.user.update({ where: { id: user.id }, data: { suspendedUntil: new Date(Date.now() + 86_400_000), suspensionReason: "test" } })
    expect((await json("/api/room/instant", user, "POST", { title: "x" })).status).toBe(403)
  })
})

describe("officials watch unseen and step in", () => {
  async function onAir() {
    const admin = await makeUser("ADMIN")
    const { user, teacher } = await trialTeacher()
    const body = await (await json("/api/room/instant", user, "POST", { title: "İzlenecek yayın" })).json()
    return { admin, user, teacher, id: body.liveRoomId as string }
  }

  it("the monitor list, the hidden token and the notice endpoint are for admins only", async () => {
    const { admin, user, id } = await onAir()
    const student = await makeUser("STUDENT")
    const other = (await makeTeacher()).user
    for (const who of [null, student, other, user]) {
      const expected = who === null ? 401 : 403
      expect((await api("/api/admin/live-monitor", who)).status, "list").toBe(expected)
      expect((await json(`/api/admin/live-monitor/${id}/watch`, who, "POST", {})).status, "watch").toBe(expected)
      expect((await json(`/api/admin/live-monitor/${id}/notice`, who, "POST", { message: "merhaba", audience: "all" })).status, "notice").toBe(expected)
    }
    const list = await (await api("/api/admin/live-monitor", admin)).json()
    const row = list.broadcasts.find((b: any) => b.id === id)
    expect(row).toMatchObject({ supervised: true, teacher: { trial: true } })
    expect(list.supervisedCount).toBeGreaterThan(0)
    // supervised broadcasts are listed first
    expect(list.broadcasts[0].supervised).toBe(true)
  })

  it("watching gives a hidden, receive-only token and is written to the audit log once per session", async () => {
    const { admin, id } = await onAir()
    const res = await json(`/api/admin/live-monitor/${id}/watch`, admin, "POST", {})
    expect(res.status).toBe(200)
    const d = await res.json()
    const claims = jwtPayload(d.token)
    expect(claims.video.hidden).toBe(true)
    expect(claims.video.canPublish).toBe(false)
    expect(claims.video.canSubscribe).toBe(true)
    expect(claims.sub).toBe(`staff-${admin.id}`)
    expect(d.stream).toMatchObject({ supervised: true, teacher: { trial: true } })
    await json(`/api/admin/live-monitor/${id}/watch`, admin, "POST", {})
    expect(await db.auditLog.count({ where: { actorId: admin.id, action: "WATCH_LIVE", targetId: id } })).toBe(1)
  })

  it("a notice reaches the teacher (bell + audit); messages are validated; ended rooms are refused", async () => {
    const { admin, user, id } = await onAir()
    expect((await json(`/api/admin/live-monitor/${id}/notice`, admin, "POST", { message: "a", audience: "teacher" })).status).toBe(400)
    const ok = await json(`/api/admin/live-monitor/${id}/notice`, admin, "POST", { message: "Lütfen kamerayı biraz yukarı al.", audience: "teacher" })
    expect(ok.status).toBe(200)
    expect(await db.notification.count({ where: { userId: user.id, title: "Yetkili mesajı" } })).toBe(1)
    expect(await db.auditLog.count({ where: { actorId: admin.id, action: "LIVE_NOTICE", targetId: id } })).toBe(1)
    expect((await json(`/api/admin/live-monitor/${id}/notice`, admin, "POST", { message: "Herkese duyuru", audience: "all" })).status).toBe(200)

    // admins can tighten the chat of any broadcast, the teacher can too, other teachers cannot
    expect((await json(`/api/live/${id}/moderate`, admin, "POST", { action: "chat-settings", slowModeSec: 30 })).status).toBe(200)
    const stranger = (await makeTeacher()).user
    expect((await json(`/api/live/${id}/moderate`, stranger, "POST", { action: "chat-settings", slowModeSec: 0 })).status).toBe(403)

    // closing ends it; afterwards watching and messaging are refused
    expect((await json(`/api/admin/live-rooms/${id}/close`, admin, "POST", { reason: "test" })).status).toBe(200)
    expect((await json(`/api/admin/live-monitor/${id}/watch`, admin, "POST", {})).status).toBe(404)
    expect((await json(`/api/admin/live-monitor/${id}/notice`, admin, "POST", { message: "geç kaldın", audience: "all" })).status).toBe(404)
  })

  it("approving the teacher flips the badge data at once; the running broadcast stays supervised", async () => {
    const { admin, teacher, id } = await onAir()
    expect((await json(`/api/admin/teachers/${teacher.id}/trial`, admin, "POST", { action: "approve" })).status).toBe(200)
    const list = await (await api("/api/live", viewer)).json()
    const row = (list.broadcasts ?? list).find((b: any) => b.id === id)
    expect(row.teacher.trial).toBe(false)
    expect(row.supervised).toBe(true)
  })

  it("viewers learn about supervision through the join response", async () => {
    const { id } = await onAir()
    const student = await makeUser("STUDENT")
    const j = await (await json(`/api/live/${id}/join`, student, "POST", {})).json()
    expect(j.stream.supervised).toBe(true)
    expect(j.stream.teacher.trial).toBe(true)
  })
})
