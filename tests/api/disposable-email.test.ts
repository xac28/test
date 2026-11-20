import { describe, it, expect, afterAll } from "vitest"
import { json, db } from "./helpers"

const emails: string[] = []
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})

const tag = () => Math.random().toString(16).slice(2, 10)
const body = (email: string) => ({ name: "Test Kullanıcı", email, password: "secret123", acceptTerms: true })

describe("registration refuses disposable/throwaway e-mail addresses (web + mobile)", () => {
  for (const path of ["/api/auth/register", "/api/mobile/auth/register"]) {
    it(`${path} rejects known throwaway providers and creates no account for them`, async () => {
      for (const email of [
        `a${tag()}@mailinator.com`,
        `a${tag()}@10minutemail.com`,
        `a${tag()}@guerrillamail.com`,
        `a${tag()}@yopmail.com`,
        `a${tag()}@${tag()}.mailinator.com`, // wildcard-subdomain provider
      ]) {
        const res = await json(path, null, "POST", body(email))
        expect(res.status, email).toBe(400)
        expect((await res.json()).code).toBe("EMAIL_REJECTED")
        expect(await db.user.findUnique({ where: { email } })).toBeNull()
      }
    })

    it(`${path} rejects an obviously malformed address before creating anything`, async () => {
      for (const email of ["not-an-email", "a@b", "a@@b.com", "a@b..com", `.leadingdot${tag()}@aya.test`]) {
        const res = await json(path, null, "POST", body(email))
        expect(res.status, email).toBe(400)
      }
    })

    it(`${path} still accepts a real-looking address`, async () => {
      const email = `ok-${tag()}@aya.test`
      emails.push(email)
      const res = await json(path, null, "POST", body(email))
      expect(res.status).toBe(200)
      expect(await db.user.findUnique({ where: { email } })).not.toBeNull()
    })
  }
})
