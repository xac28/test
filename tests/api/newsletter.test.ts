import { describe, it, expect, afterAll } from "vitest"
import { json, db } from "./helpers"

afterAll(() => db.$disconnect())

describe("newsletter", () => {
  it("subscribes an address, normalises it and stays idempotent", async () => {
    const email = `News.${Date.now()}@Example.com`
    const a = await json("/api/newsletter", null, "POST", { email })
    expect(a.status).toBe(200)
    expect(await a.json()).toEqual({ ok: true })
    const again = await json("/api/newsletter", null, "POST", { email: email.toUpperCase() })
    expect(again.status).toBe(200)
    expect(await db.newsletterSubscriber.count({ where: { email: email.toLowerCase() } })).toBe(1)
    await db.newsletterSubscriber.deleteMany({ where: { email: email.toLowerCase() } })
  })

  it("rejects malformed, empty and oversized input", async () => {
    for (const body of [{ email: "nope" }, { email: "a@b" }, {}, { email: 5 }, { email: `${"x".repeat(200)}@example.com` }]) {
      expect((await json("/api/newsletter", null, "POST", body)).status).toBe(400)
    }
  })
})
