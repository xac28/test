import { describe, it, expect, afterAll } from "vitest"
import crypto from "crypto"
import { api, json, makeUser, db } from "./helpers"

afterAll(() => db.$disconnect())

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex")
async function issue(userId: string, over: { expires?: Date } = {}) {
  const t = crypto.randomBytes(32).toString("hex")
  await db.verificationToken.create({ data: { identifier: `verify:${userId}`, token: hash(t), expires: over.expires ?? new Date(Date.now() + 3_600_000) } })
  return t
}

describe("registration and the address behind it", () => {
  it("a new account gets a verification link (stored hashed) and starts unverified", async () => {
    const email = `v-${Date.now()}-${Math.floor(Math.random() * 1e5)}@aya.test`
    const res = await json("/api/auth/register", null, "POST", { name: "Doğrulama Deneme", email, password: "Passw0rd!", acceptTerms: true })
    expect(res.status).toBe(200)
    const u = await db.user.findUniqueOrThrow({ where: { email } })
    expect(u.emailVerified).toBeNull()
    // sending is fire-and-forget: give it a moment
    let rows = 0
    for (let i = 0; i < 20 && !rows; i++) { rows = await db.verificationToken.count({ where: { identifier: `verify:${u.id}` } }); if (!rows) await new Promise((r) => setTimeout(r, 150)) }
    expect(rows).toBe(1)
    const row = await db.verificationToken.findFirstOrThrow({ where: { identifier: `verify:${u.id}` } })
    expect(row.token).toMatch(/^[0-9a-f]{64}$/)
  })

  it("registering with the address of a Google-only account does not give out a password for it", async () => {
    const victim = await db.user.create({ data: { name: "Google Kullanıcı", email: `g-${Date.now()}@aya.test`, password: null, emailVerified: new Date() } })
    const res = await json("/api/auth/register", null, "POST", { name: "Saldırgan", email: victim.email, password: "Passw0rd!", acceptTerms: true })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("USE_GOOGLE_OR_RESET")
    expect((await db.user.findUniqueOrThrow({ where: { id: victim.id } })).password).toBeNull()
  })
})

describe("verifying", () => {
  it("a valid link verifies once; wrong, expired and spent links are refused", async () => {
    const u = await makeUser("STUDENT")
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerified).toBeNull()
    const t = await issue(u.id)
    expect((await json("/api/auth/verify", null, "POST", { token: t })).status).toBe(200)
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerified).not.toBeNull()
    const again = await json("/api/auth/verify", null, "POST", { token: t })
    expect(again.status).toBe(400)
    expect((await again.json()).code).toBe("TOKEN_INVALID")

    const u2 = await makeUser("STUDENT")
    const expired = await issue(u2.id, { expires: new Date(Date.now() - 1000) })
    expect((await json("/api/auth/verify", null, "POST", { token: expired })).status).toBe(400)
    expect((await json("/api/auth/verify", null, "POST", { token: crypto.randomBytes(32).toString("hex") })).status).toBe(400)
    expect((await json("/api/auth/verify", null, "POST", {})).status).toBe(400)
    expect((await db.user.findUniqueOrThrow({ where: { id: u2.id } })).emailVerified).toBeNull()
  })

  it("a link cannot be used by two requests at once", async () => {
    const u = await makeUser("STUDENT")
    const t = await issue(u.id)
    const results = await Promise.all([1, 2, 3].map(() => json("/api/auth/verify", null, "POST", { token: t })))
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
  })

  it("status and resend need a session; resend has a one-minute cooldown and skips verified people", async () => {
    expect((await api("/api/auth/verify")).status).toBe(401)
    expect((await json("/api/auth/verify", null, "POST", { resend: true })).status).toBe(401)
    const u = await makeUser("STUDENT")
    expect(await (await api("/api/auth/verify", u)).json()).toMatchObject({ verified: false, hasPassword: true })
    expect((await json("/api/auth/verify", u, "POST", { resend: true })).status).toBe(200)
    const second = await json("/api/auth/verify", u, "POST", { resend: true })
    expect(second.status).toBe(429)
    expect((await second.json()).code).toBe("COOLDOWN")
    expect(await db.verificationToken.count({ where: { identifier: `verify:${u.id}` } })).toBe(1)
    await db.user.update({ where: { id: u.id }, data: { emailVerified: new Date() } })
    expect(await (await json("/api/auth/verify", u, "POST", { resend: true })).json()).toMatchObject({ alreadyVerified: true })
    expect((await (await api("/api/auth/verify", u)).json()).verified).toBe(true)
  })
})

describe("the verified-address requirement (REQUIRE_EMAIL_VERIFICATION=true)", () => {
  it("only blocks unverified people, and only when switched on", async () => {
    const { emailGate } = await import("../../src/lib/email-verification")
    const u = await makeUser("STUDENT")
    delete process.env.REQUIRE_EMAIL_VERIFICATION
    expect(await emailGate(u.id)).toBeNull() // off by default
    process.env.REQUIRE_EMAIL_VERIFICATION = "true"
    try {
      const blocked = await emailGate(u.id)
      expect(blocked!.status).toBe(403)
      expect((await blocked!.json()).code).toBe("EMAIL_UNVERIFIED")
      await db.user.update({ where: { id: u.id }, data: { emailVerified: new Date() } })
      expect(await emailGate(u.id)).toBeNull()
    } finally {
      delete process.env.REQUIRE_EMAIL_VERIFICATION
    }
  })
})
