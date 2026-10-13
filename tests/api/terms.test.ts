import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, makeTeacher, makeBooking, db } from "./helpers"

afterAll(() => db.$disconnect())

const reg = (path: string, extra: object = {}) =>
  json(path, null, "POST", {
    name: "Ayşe Test",
    email: `reg-${Date.now()}-${Math.random().toString(16).slice(2)}@aya.test`,
    password: "secret123",
    ...extra,
  })

describe("registration requires the terms box (web + mobile API)", () => {
  for (const path of ["/api/auth/register", "/api/mobile/auth/register"]) {
    it(`${path} rejects a missing/false acceptTerms`, async () => {
      const a = await reg(path)
      expect(a.status).toBe(400)
      expect((await a.json()).code).toBe("TERMS_REQUIRED")
      const b = await reg(path, { acceptTerms: false })
      expect(b.status).toBe(400)
      const c = await reg(path, { acceptTerms: "true" }) // must be boolean true
      expect(c.status).toBe(400)
    })

    it(`${path} accepts acceptTerms:true and stores the acceptance`, async () => {
      const email = `ok-${Date.now()}-${Math.random().toString(16).slice(2)}@aya.test`
      const res = await json(path, null, "POST", { name: "Mehmet Test", email, password: "secret123", acceptTerms: true })
      expect(res.status).toBe(200)
      const user = await db.user.findUnique({ where: { email } })
      expect(user?.termsAcceptedAt).toBeTruthy()
      expect(user?.termsVersion).toBeTruthy()
    })
  }

  it("mobile register returns a token whose user is termsAccepted", async () => {
    const res = await reg("/api/mobile/auth/register", { acceptTerms: true })
    const data = await res.json()
    expect(data.token).toBeTruthy()
    expect(data.user.termsAccepted).toBe(true)
    const me = await (await api("/api/mobile/me", { token: data.token })).json()
    expect(me.user.termsAccepted).toBe(true)
  })
})

describe("terms gate", () => {
  it("blocks actions with 403 TERMS_REQUIRED until accepted, then lets them through", async () => {
    const student = await makeUser("STUDENT", { terms: false })
    const { teacher, user: teacherUser } = await makeTeacher()
    const booking = await makeBooking(teacher.id, student.id)

    const me = await (await api("/api/mobile/me", student)).json()
    expect(me.user.termsAccepted).toBe(false)

    const blocked = await json("/api/room/join", student, "POST", { bookingId: booking.id })
    expect(blocked.status).toBe(403)
    expect((await blocked.json()).code).toBe("TERMS_REQUIRED")

    // must send acceptTerms:true
    const bad = await json("/api/terms/accept", student, "POST", {})
    expect(bad.status).toBe(400)
    const ok = await json("/api/terms/accept", student, "POST", { acceptTerms: true })
    expect(ok.status).toBe(200)

    const me2 = await (await api("/api/mobile/me", student)).json()
    expect(me2.user.termsAccepted).toBe(true)

    const joined = await json("/api/room/join", student, "POST", { bookingId: booking.id })
    expect(joined.status).toBe(200)
    expect((await joined.json()).role).toBe("student")
    void teacherUser
  })

  it("accept requires authentication", async () => {
    const res = await json("/api/terms/accept", null, "POST", { acceptTerms: true })
    expect(res.status).toBe(401)
  })
})
