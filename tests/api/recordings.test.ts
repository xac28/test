import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, makeTeacher, makeBooking, db, BASE } from "./helpers"

afterAll(() => db.$disconnect())

async function setup() {
  const { user: teacher, teacher: t } = await makeTeacher()
  const student = await makeUser("STUDENT")
  const outsider = await makeUser("STUDENT")
  const admin = await makeUser("ADMIN")
  const booking = await makeBooking(t.id, student.id)
  return { teacher, student, outsider, admin, booking, t }
}

const put = (id: string, i: number, user: { token: string }, body: Buffer | string) =>
  api(`/api/recordings/${id}/chunks/${i}`, user, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: body as any,
  })

describe("lesson recording flow", () => {
  it("records, uploads in chunks, finalizes, and only teacher + student can download", async () => {
    const { teacher, student, outsider, admin, booking } = await setup()

    // Only the teacher may start; the student, outsiders and anonymous users may not
    expect((await json("/api/recordings", student, "POST", { bookingId: booking.id })).status).toBe(403)
    expect((await json("/api/recordings", outsider, "POST", { bookingId: booking.id })).status).toBe(403)
    expect((await json("/api/recordings", null, "POST", { bookingId: booking.id })).status).toBe(401)
    expect((await json("/api/recordings", teacher, "POST", {})).status).toBe(400)

    const start = await json("/api/recordings", teacher, "POST", { bookingId: booking.id, mimeType: "video/webm;codecs=vp9,opus" })
    expect(start.status).toBe(200)
    const { id, expiresAt } = await start.json()
    expect(id).toBeTruthy()

    // 30-day retention
    const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThanOrEqual(30)

    // Student cannot upload chunks
    expect((await put(id, 0, student, "x")).status).toBe(403)
    // Empty chunk rejected
    expect((await put(id, 0, teacher, "")).status).toBe(400)
    // Chunks (out of order on purpose; merge uses the index)
    const a = Buffer.from("AAAA-first-")
    const b = Buffer.from("BBBB-second-")
    const c = Buffer.from("CCCC-third")
    expect((await put(id, 1, teacher, b)).status).toBe(200)
    expect((await put(id, 0, teacher, a)).status).toBe(200)
    expect((await put(id, 0, teacher, a)).status).toBe(200) // idempotent retry
    expect((await put(id, 2, teacher, c)).status).toBe(200)

    // Not downloadable before finalize
    expect((await api(`/api/recordings/${id}/download`, teacher)).status).toBe(404)

    // Only the teacher finalizes
    expect((await json(`/api/recordings/${id}/finalize`, student, "POST", {})).status).toBe(403)
    const fin = await json(`/api/recordings/${id}/finalize`, teacher, "POST", { durationSec: 125, chunkCount: 3 })
    expect(fin.status).toBe(200)
    // Finalize twice is harmless; late chunks are refused
    expect((await json(`/api/recordings/${id}/finalize`, teacher, "POST", {})).status).toBe(200)
    expect((await put(id, 3, teacher, "late")).status).toBe(409)

    const expected = Buffer.concat([a, b, c])

    // Teacher and student download the exact bytes
    for (const u of [teacher, student]) {
      const res = await api(`/api/recordings/${id}/download`, u)
      expect(res.status).toBe(200)
      expect(res.headers.get("content-disposition")).toContain("attachment")
      expect(res.headers.get("content-type")).toContain("video/webm")
      expect(Buffer.from(await res.arrayBuffer()).equals(expected)).toBe(true)
    }

    // Outsider, admin and anonymous cannot (404 so ids can't be probed)
    expect((await api(`/api/recordings/${id}/download`, outsider)).status).toBe(404)
    expect((await api(`/api/recordings/${id}/download`, admin)).status).toBe(404)
    expect((await api(`/api/recordings/${id}/download`, null)).status).toBe(401)
    // Malformed / traversal ids
    expect((await api(`/api/recordings/..%2F..%2Fetc/download`, teacher)).status).toBe(400)

    // Listing: teacher and student see it, outsider does not
    const lt = await (await api("/api/recordings", teacher)).json()
    const ls = await (await api("/api/recordings", student)).json()
    const lo = await (await api("/api/recordings", outsider)).json()
    expect(lt.recordings.map((r: any) => r.id)).toContain(id)
    expect(ls.recordings.map((r: any) => r.id)).toContain(id)
    expect(lo.recordings.map((r: any) => r.id)).not.toContain(id)
    const item = ls.recordings.find((r: any) => r.id === id)
    expect(item.durationSec).toBe(125)
    expect(item.sizeBytes).toBe(expected.length)
  })

  it("a lesson that is not confirmed cannot be recorded", async () => {
    const { teacher, student, t } = await setup()
    const pending = await makeBooking(t.id, student.id, "PENDING")
    expect((await json("/api/recordings", teacher, "POST", { bookingId: pending.id })).status).toBe(400)
  })

  it("finalize with a missing chunk fails and leaves nothing downloadable", async () => {
    const { teacher, booking } = await setup()
    const { id } = await (await json("/api/recordings", teacher, "POST", { bookingId: booking.id })).json()
    await put(id, 0, teacher, "AAA")
    await put(id, 2, teacher, "CCC") // chunk 1 never arrives
    const fin = await json(`/api/recordings/${id}/finalize`, teacher, "POST", { chunkCount: 3 })
    expect(fin.status).toBe(422)
    expect((await api(`/api/recordings/${id}/download`, teacher)).status).toBe(404)
    expect((await db.lessonRecording.findUnique({ where: { id } }))?.status).toBe("FAILED")
  })

  it("instant live-room recordings are teacher-only", async () => {
    const { user: teacher, teacher: t } = await makeTeacher()
    const other = await makeUser("STUDENT")
    const room = await db.liveRoom.create({ data: { teacherId: t.id, roomName: `live-${Date.now()}`, title: "x" } })
    expect((await json("/api/recordings", other, "POST", { liveRoomId: room.id })).status).toBe(403)
    const { id } = await (await json("/api/recordings", teacher, "POST", { liveRoomId: room.id })).json()
    await put(id, 0, teacher, "live-bytes")
    await json(`/api/recordings/${id}/finalize`, teacher, "POST", { chunkCount: 1 })
    expect((await api(`/api/recordings/${id}/download`, teacher)).status).toBe(200)
    expect((await api(`/api/recordings/${id}/download`, other)).status).toBe(404)
  })

  it("expired recordings answer 410 and the cron purges them (secret required)", async () => {
    const { teacher, booking } = await setup()
    const { id } = await (await json("/api/recordings", teacher, "POST", { bookingId: booking.id })).json()
    await put(id, 0, teacher, "AAA")
    await json(`/api/recordings/${id}/finalize`, teacher, "POST", { chunkCount: 1 })
    expect((await api(`/api/recordings/${id}/download`, teacher)).status).toBe(200)

    await db.lessonRecording.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    // not listed any more
    const list = await (await api("/api/recordings", teacher)).json()
    expect(list.recordings.map((r: any) => r.id)).not.toContain(id)

    // cron needs the secret
    expect((await api("/api/cron/cleanup-recordings", null, { method: "POST" })).status).toBe(401)
    const cron = await api("/api/cron/cleanup-recordings", { token: process.env.CRON_SECRET! }, { method: "POST" })
    expect(cron.status).toBe(200)
    expect((await cron.json()).purged).toBeGreaterThanOrEqual(1)

    const row = await db.lessonRecording.findUnique({ where: { id } })
    expect(row?.status).toBe("EXPIRED")
    expect(row?.deletedAt).toBeTruthy()
    expect(row?.filePath).toBeNull()
    expect((await api(`/api/recordings/${id}/download`, teacher)).status).toBe(404)
  })

  it("download itself refuses expired files even before the cron ran", async () => {
    const { teacher, booking } = await setup()
    const { id } = await (await json("/api/recordings", teacher, "POST", { bookingId: booking.id })).json()
    await put(id, 0, teacher, "AAA")
    await json(`/api/recordings/${id}/finalize`, teacher, "POST", { chunkCount: 1 })
    await db.lessonRecording.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await api(`/api/recordings/${id}/download`, teacher)).status).toBe(410)
  })

  it("the recordings are not reachable as static files", async () => {
    const res = await fetch(`${BASE}/storage/recordings`)
    expect(res.status).toBe(404)
  })
})
