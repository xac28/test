import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, makeTeacher, db } from "./helpers"

afterAll(() => db.$disconnect())

const future = (min = 120) => new Date(Date.now() + min * 60_000).toISOString()
const base = (over: object = {}) => ({
  title: `Sabah Yogası ${Math.random().toString(16).slice(2, 6)}`,
  description: "Güne yumuşak bir başlangıç: nefes, esneme ve kısa bir meditasyon.",
  category: "Hatha",
  mode: "LIVE",
  startsAt: future(),
  durationMin: 60,
  capacity: 10,
  priceUsd: 0,
  ...over,
})

async function createWorkshop(teacher: { token: string }, over: object = {}) {
  const res = await json("/api/workshops", teacher, "POST", base(over))
  expect(res.status).toBe(200)
  return (await res.json()).workshop as { id: string; slug: string }
}

describe("creating workshops", () => {
  it("only teachers can create; validation errors are 400; trial teachers are refused", async () => {
    const { user: teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    expect((await json("/api/workshops", null, "POST", base())).status).toBe(401)
    expect((await json("/api/workshops", student, "POST", base())).status).toBe(403)
    expect((await json("/api/workshops", teacher, "POST", base({ title: "ab" }))).status).toBe(400)
    expect((await json("/api/workshops", teacher, "POST", base({ startsAt: "2020-01-01T00:00:00Z" }))).status).toBe(400)
    expect((await json("/api/workshops", teacher, "POST", base({ mode: "RECORDED" }))).status).toBe(400) // no video

    const trial = await makeUser("TEACHER")
    await db.teacher.create({ data: { userId: trial.id, isTrialMode: true } })
    expect((await json("/api/workshops", trial, "POST", base())).status).toBe(403)

    const w = await createWorkshop(teacher)
    expect(w.slug).toMatch(/^sabah-yogasi-/)
  })
})

describe("public listing & visibility", () => {
  it("lists published workshops, filters by category/mode, hides drafts and past ones", async () => {
    const { user: teacher } = await makeTeacher()
    const stranger = await makeUser("STUDENT")
    const cat = `Kat${Math.random().toString(16).slice(2, 6)}`
    const pub = await createWorkshop(teacher, { category: cat })
    const draft = await json("/api/workshops", teacher, "POST", base({ category: cat, status: "DRAFT" }))
    const draftId = (await draft.json()).workshop.id
    const recorded = await createWorkshop(teacher, { category: cat, mode: "RECORDED", startsAt: undefined, videoUrl: "https://cdn.example.com/v.mp4" })

    const list = await (await api(`/api/workshops?category=${cat}`)).json()
    const ids = list.workshops.map((w: any) => w.id)
    expect(ids).toContain(pub.id)
    expect(ids).toContain(recorded.id)
    expect(ids).not.toContain(draftId)
    const liveOnly = await (await api(`/api/workshops?category=${cat}&mode=LIVE`)).json()
    expect(liveOnly.workshops.map((w: any) => w.id)).toEqual([pub.id])

    // draft: invisible to others, visible to the owner; list entries never expose the video URL
    expect((await api(`/api/workshops/${draftId}`, stranger)).status).toBe(404)
    expect((await api(`/api/workshops/${draftId}`, teacher)).status).toBe(200)
    expect(JSON.stringify(list)).not.toContain("cdn.example.com")

    // slug works as id
    expect((await api(`/api/workshops/${pub.slug}`)).status).toBe(200)

    // an ended workshop moves to ?past=1
    await db.workshop.update({ where: { id: pub.id }, data: { startsAt: new Date(Date.now() - 3 * 3_600_000) } })
    const after = await (await api(`/api/workshops?category=${cat}`)).json()
    expect(after.workshops.map((w: any) => w.id)).not.toContain(pub.id)
    const past = await (await api(`/api/workshops?category=${cat}&past=1`)).json()
    expect(past.workshops.map((w: any) => w.id)).toContain(pub.id)
  })
})

describe("enrollment", () => {
  it("free: confirmed instantly; duplicate is 409; owner can't enroll; unauthenticated is 401", async () => {
    const { user: teacher } = await makeTeacher()
    const s1 = await makeUser("STUDENT")
    const w = await createWorkshop(teacher)
    expect((await json(`/api/workshops/${w.id}/enroll`, null, "POST", {})).status).toBe(401)
    const r = await json(`/api/workshops/${w.id}/enroll`, s1, "POST", {})
    expect(r.status).toBe(200)
    expect((await r.json()).status).toBe("CONFIRMED")
    const again = await json(`/api/workshops/${w.id}/enroll`, s1, "POST", {})
    expect(again.status).toBe(409)
    expect((await again.json()).code).toBe("ALREADY")
    expect((await json(`/api/workshops/${w.id}/enroll`, teacher, "POST", {})).status).toBe(400)
    const view = await (await api(`/api/workshops/${w.id}`, s1)).json()
    expect(view.workshop.myEnrollment).toBe("CONFIRMED")
    expect(view.workshop.seatsLeft).toBe(9)
  })

  it("terms gate applies", async () => {
    const { user: teacher } = await makeTeacher()
    const noTerms = await makeUser("STUDENT", { terms: false })
    const w = await createWorkshop(teacher)
    const res = await json(`/api/workshops/${w.id}/enroll`, noTerms, "POST", {})
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("TERMS_REQUIRED")
  })

  it("never oversells: parallel enrollments into 2 seats give exactly 2 winners", async () => {
    const { user: teacher } = await makeTeacher()
    const w = await createWorkshop(teacher, { capacity: 2 })
    const students = await Promise.all([0, 1, 2, 3, 4].map(() => makeUser("STUDENT")))
    const results = await Promise.all(students.map((s) => json(`/api/workshops/${w.id}/enroll`, s, "POST", {})))
    expect(results.filter((r) => r.status === 200)).toHaveLength(2)
    expect(results.filter((r) => r.status === 409)).toHaveLength(3)
    const count = await db.workshopEnrollment.count({ where: { workshopId: w.id, status: { not: "CANCELLED" } } })
    expect(count).toBe(2)
  })

  it("cancelling frees the seat, and the person may enroll again", async () => {
    const { user: teacher } = await makeTeacher()
    const w = await createWorkshop(teacher, { capacity: 1 })
    const a = await makeUser("STUDENT")
    const b = await makeUser("STUDENT")
    expect((await json(`/api/workshops/${w.id}/enroll`, a, "POST", {})).status).toBe(200)
    expect((await json(`/api/workshops/${w.id}/enroll`, b, "POST", {})).status).toBe(409) // full
    expect((await api(`/api/workshops/${w.id}/enroll`, a, { method: "DELETE" })).status).toBe(200)
    expect((await json(`/api/workshops/${w.id}/enroll`, b, "POST", {})).status).toBe(200)
    expect((await api(`/api/workshops/${w.id}/enroll`, a, { method: "DELETE" })).status).toBe(404) // nothing left to cancel
    expect((await json(`/api/workshops/${w.id}/enroll`, a, "POST", {})).status).toBe(409) // full again
  })

  it("an ended or cancelled workshop takes no enrollments", async () => {
    const { user: teacher } = await makeTeacher()
    const s = await makeUser("STUDENT")
    const w = await createWorkshop(teacher)
    await db.workshop.update({ where: { id: w.id }, data: { startsAt: new Date(Date.now() - 5 * 3_600_000) } })
    expect((await json(`/api/workshops/${w.id}/enroll`, s, "POST", {})).status).toBe(400)
    const w2 = await createWorkshop(teacher)
    expect((await json(`/api/workshops/${w2.id}`, teacher, "PATCH", { status: "CANCELLED" })).status).toBe(200)
    expect((await json(`/api/workshops/${w2.id}/enroll`, s, "POST", {})).status).toBe(400)
  })
})

describe("paid workshops & protected content", () => {
  it("reserved until the teacher confirms the payment; the recorded video is hidden until then", async () => {
    const { user: teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    const other = await makeUser("STUDENT")
    const w = await createWorkshop(teacher, { mode: "RECORDED", startsAt: undefined, videoUrl: "https://cdn.example.com/secret.mp4", priceUsd: 25 })

    const anon = await (await api(`/api/workshops/${w.id}`)).json()
    expect(anon.workshop.videoUrl).toBeNull()

    const enrolled = await json(`/api/workshops/${w.id}/enroll`, student, "POST", {})
    expect((await enrolled.json()).status).toBe("RESERVED")
    const reserved = await (await api(`/api/workshops/${w.id}`, student)).json()
    expect(reserved.workshop.myEnrollment).toBe("RESERVED")
    expect(reserved.workshop.videoUrl).toBeNull()

    // only the owner (or admin) confirms
    expect((await json(`/api/workshops/${w.id}/enrollments/${student.id}`, other, "PATCH", { status: "CONFIRMED" })).status).toBe(403)
    expect((await json(`/api/workshops/${w.id}/enrollments/${student.id}`, student, "PATCH", { status: "CONFIRMED" })).status).toBe(403)
    expect((await api(`/api/workshops/${w.id}/enrollments`, student)).status).toBe(403)
    const list = await (await api(`/api/workshops/${w.id}/enrollments`, teacher)).json()
    expect(list.enrollments).toHaveLength(1)
    expect(list.enrollments[0].status).toBe("RESERVED")

    expect((await json(`/api/workshops/${w.id}/enrollments/${student.id}`, teacher, "PATCH", { status: "CONFIRMED" })).status).toBe(200)
    const confirmed = await (await api(`/api/workshops/${w.id}`, student)).json()
    expect(confirmed.workshop.videoUrl).toBe("https://cdn.example.com/secret.mp4")
    // other users still cannot see it; the owner can
    expect((await (await api(`/api/workshops/${w.id}`, other)).json()).workshop.videoUrl).toBeNull()
    expect((await (await api(`/api/workshops/${w.id}`, teacher)).json()).workshop.videoUrl).toBe("https://cdn.example.com/secret.mp4")
  })

  it("owner edits: capacity cannot drop below enrolled; others cannot edit", async () => {
    const { user: teacher } = await makeTeacher()
    const stranger = await makeUser("STUDENT")
    const s1 = await makeUser("STUDENT")
    const s2 = await makeUser("STUDENT")
    const w = await createWorkshop(teacher, { capacity: 5 })
    await json(`/api/workshops/${w.id}/enroll`, s1, "POST", {})
    await json(`/api/workshops/${w.id}/enroll`, s2, "POST", {})
    expect((await json(`/api/workshops/${w.id}`, stranger, "PATCH", { title: "Hacked" })).status).toBe(403)
    expect((await json(`/api/workshops/${w.id}`, teacher, "PATCH", { capacity: 1 })).status).toBe(400)
    expect((await json(`/api/workshops/${w.id}`, teacher, "PATCH", { capacity: 2, title: "Yeni Başlık Burada" })).status).toBe(200)
    expect((await db.workshop.findUnique({ where: { id: w.id } }))?.title).toBe("Yeni Başlık Burada")
  })
})

describe("workshop live sessions are members-only", () => {
  it("join: not enrolled → 403, reserved → 403, confirmed → 200, host → 200, normal stream → open", async () => {
    const { user: teacher, teacher: t } = await makeTeacher()
    const confirmed = await makeUser("STUDENT")
    const reserved = await makeUser("STUDENT")
    const outsider = await makeUser("STUDENT")
    const w = await createWorkshop(teacher)
    await db.workshopEnrollment.create({ data: { workshopId: w.id, userId: confirmed.id, status: "CONFIRMED" } })
    await db.workshopEnrollment.create({ data: { workshopId: w.id, userId: reserved.id, status: "RESERVED" } })
    await db.liveRoom.updateMany({ where: { teacherId: t.id, isActive: true }, data: { isActive: false } })
    const room = await db.liveRoom.create({ data: { teacherId: t.id, roomName: `live-${t.id}-${Date.now()}`, title: "Atölye", workshopId: w.id } })

    const denied = await json(`/api/live/${room.id}/join`, outsider, "POST", {})
    expect(denied.status).toBe(403)
    const body = await denied.json()
    expect(body.code).toBe("ENROLLMENT_REQUIRED")
    expect(body.workshop.slug).toBe(w.slug)
    expect((await json(`/api/live/${room.id}/join`, reserved, "POST", {})).status).toBe(403)
    expect((await json(`/api/live/${room.id}/join`, confirmed, "POST", {})).status).toBe(200)
    const host = await json(`/api/live/${room.id}/join`, teacher, "POST", {})
    expect(host.status).toBe(200)
    expect((await host.json()).role).toBe("host")

    const open = await db.liveRoom.create({ data: { teacherId: t.id, roomName: `live-open-${Date.now()}`, title: "Açık yayın" } })
    expect((await json(`/api/live/${open.id}/join`, outsider, "POST", {})).status).toBe(200)
  })

  it("only the workshop's own teacher can broadcast it", async () => {
    const { user: owner } = await makeTeacher()
    const { user: other } = await makeTeacher()
    const w = await createWorkshop(owner)
    const denied = await json("/api/room/instant", other, "POST", { workshopId: w.id })
    expect(denied.status).toBe(403)
    const ok = await json("/api/room/instant", owner, "POST", { workshopId: w.id })
    expect(ok.status).toBe(200)
    const data = await ok.json()
    expect(data.title).toBe(w.slug ? (await db.workshop.findUnique({ where: { id: w.id } }))!.title : "")
    const room = await db.liveRoom.findUnique({ where: { id: data.liveRoomId } })
    expect(room?.workshopId).toBe(w.id)
    await json("/api/room/instant", owner, "DELETE", { liveRoomId: data.liveRoomId })
  })
})
