import { describe, it, expect, afterAll } from "vitest"
import { api, makeUser, makeTeacher, json, db, BASE } from "./helpers"

afterAll(() => db.$disconnect())

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0))
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii("IHDR"), 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89])

const login = (email: string, password: string, ip?: string) =>
  api("/api/mobile/auth/login", null, { method: "POST", headers: { "content-type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) }, body: JSON.stringify({ email, password }) })

describe("login lock: guessing one account from many addresses", () => {
  it("locks the account after repeated failures, even when every try comes from a new IP", async () => {
    const victim = await makeUser("STUDENT")
    for (let i = 0; i < 10; i++) expect((await login(victim.email, "wrong-" + i)).status).toBe(401)
    const locked = await login(victim.email, "wrong-again")
    expect(locked.status).toBe(429)
    expect((await locked.json()).code).toBe("TOO_MANY_ATTEMPTS")
    // while locked, even the right password is refused: guessing cannot be confirmed
    expect((await login(victim.email, victim.password)).status).toBe(429)
  })

  it("a successful login clears the failure count", async () => {
    const u = await makeUser("STUDENT")
    for (let i = 0; i < 6; i++) await login(u.email, "bad-" + i)
    expect((await login(u.email, u.password)).status).toBe(200)
    for (let i = 0; i < 6; i++) expect((await login(u.email, "bad2-" + i)).status).toBe(401)
  })

  it("one address that fails across many accounts is locked out too", async () => {
    const ip = `10.250.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
    let last = 0
    for (let i = 0; i < 30; i++) last = (await login(`nobody-${i}-${Math.random().toString(36).slice(2)}@aya.test`, "x", ip)).status
    expect([401, 429]).toContain(last)
    // 10/min request limiter or the failure lock must have stopped it
    expect((await login(`nobody-final@aya.test`, "x", ip)).status).toBe(429)
  })

  it("unknown e-mail and wrong password are indistinguishable", async () => {
    const u = await makeUser("STUDENT")
    const a = await login(u.email, "nope-nope")
    const b = await login(`ghost-${Date.now()}@aya.test`, "nope-nope")
    expect(a.status).toBe(b.status)
    expect(await a.json()).toEqual(await b.json())
  })
})

describe("malformed input is a 400, never a 500", () => {
  it("upload with a JSON body", async () => {
    const u = await makeUser("STUDENT")
    const res = await api("/api/upload", u, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
    expect(res.status).toBe(400)
  })

  it("availability with an empty / bad body", async () => {
    const { user } = await makeTeacher()
    const put = (body: unknown) => json("/api/teachers/availability", user, "PUT", body)
    expect((await put({})).status).toBe(400)
    const t = await db.teacher.findFirstOrThrow({ where: { userId: user.id } })
    expect((await put({ teacherId: t.id, slots: [{ dayOfWeek: 9, startTime: "09:00", endTime: "10:00" }] })).status).toBe(400)
    expect((await put({ teacherId: t.id, slots: [{ dayOfWeek: 1, startTime: "25:00", endTime: "26:00" }] })).status).toBe(400)
    expect((await put({ teacherId: t.id, slots: [{ dayOfWeek: 1, startTime: "11:00", endTime: "10:00" }] })).status).toBe(400)
    expect((await put({ teacherId: t.id, slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }] })).status).toBe(200)
  })

  it("a student cannot rewrite another teacher's availability", async () => {
    const { teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    const res = await json("/api/teachers/availability", student, "PUT", { teacherId: teacher.id, slots: [] })
    expect(res.status).toBe(403)
  })
})

describe("uploaded files cannot be guessed", () => {
  it("file names carry a random part, so two uploads in the same millisecond never collide or follow a pattern", async () => {
    const u = await makeUser("STUDENT")
    const fd = () => {
      const f = new FormData()
      f.append("file", new Blob([PNG as unknown as BlobPart], { type: "image/png" }), "a.png")
      f.append("type", "post")
      return f
    }
    const a = await (await api("/api/upload", u, { method: "POST", body: fd() })).json()
    const b = await (await api("/api/upload", u, { method: "POST", body: fd() })).json()
    expect(a.url).not.toBe(b.url)
    expect(a.url).toMatch(/^\/uploads\/posts\/post-[a-z0-9]+-\d+-[0-9a-f]{24}\.png$/)
  })

  it("certificates are private: owner and admins only", async () => {
    const owner = await makeUser("STUDENT")
    const other = await makeUser("STUDENT")
    const admin = await makeUser("ADMIN")
    const f = new FormData()
    f.append("file", new Blob([PNG as unknown as BlobPart], { type: "image/png" }), "diploma.png")
    f.append("type", "certificate")
    const { url } = await (await api("/api/upload", owner, { method: "POST", body: f })).json()
    expect(url).toMatch(/^\/uploads\/certificates\/cert-/)
    expect((await api(url, null)).status).toBe(404)
    expect((await api(url, other)).status).toBe(404)
    expect((await api(url, owner)).status).toBe(200)
    expect((await api(url, admin)).status).toBe(200)
    // public pictures stay public
    const g = new FormData()
    g.append("file", new Blob([PNG as unknown as BlobPart], { type: "image/png" }), "p.png")
    g.append("type", "post")
    const post = await (await api("/api/upload", owner, { method: "POST", body: g })).json()
    expect((await api(post.url, null)).status).toBe(200)
  })

  it("path traversal through the uploads route is refused", async () => {
    for (const p of ["../../.env", "..%2f..%2f.env", "avatars/../../../.env", "%2e%2e/%2e%2e/.env"]) {
      const res = await fetch(`${BASE}/uploads/${p}`, { redirect: "manual" })
      expect([400, 403, 404]).toContain(res.status)
    }
  })
})

describe("authorization sweep", () => {
  it("a student gets 401/403 on every admin endpoint; anonymous gets 401/403", async () => {
    const student = await makeUser("STUDENT")
    for (const p of ["/api/admin/users", "/api/admin/reports", "/api/admin/overview", "/api/admin/payouts", "/api/admin/articles", "/api/admin/trials"]) {
      expect([401, 403], `student ${p}`).toContain((await api(p, student)).status)
      expect([401, 403], `anon ${p}`).toContain((await api(p, null)).status)
    }
  })

  it("cron endpoints refuse requests without the secret", async () => {
    for (const p of ["/api/cron/digests?weekly=0", "/api/cron/publish", "/api/cron/reminders"]) {
      for (const method of ["GET", "POST"]) {
        const res = await api(p, null, { method })
        expect([401, 403, 405], `${method} ${p}`).toContain(res.status)
        const bad = await api(p, null, { method, headers: { authorization: "Bearer wrong" } })
        expect([401, 403, 405], `${method} ${p} wrong secret`).toContain(bad.status)
      }
    }
  })

  it("forged bearer tokens are rejected", async () => {
    for (const t of ["x".repeat(96), "eyJhbGciOiJub25lIn0.eyJyb2xlIjoiQURNSU4ifQ.", "' OR '1'='1"]) {
      expect((await api("/api/mobile/me", { token: t })).status).toBe(401)
    }
  })

  it("profile update cannot change role or ban state", async () => {
    const u = await makeUser("STUDENT")
    const res = await json("/api/profile", u, "PUT", { firstName: "A", lastName: "B", role: "ADMIN" })
    expect(res.status).toBe(403)
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("STUDENT")
  })
})
