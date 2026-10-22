import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, db } from "./helpers"

const emails: string[] = []
const refIds: string[] = []
afterAll(async () => {
  await db.newsletterSubscriber.deleteMany({ where: { email: { in: emails } } })
  await db.newsletterCampaign.deleteMany({ where: { OR: [{ refId: { in: refIds } }, { subject: { startsWith: "Test kampanya" } }] } })
  await db.article.deleteMany({ where: { id: { in: refIds } } })
  await db.$disconnect()
})
const addr = () => { const e = `news-${Math.random().toString(16).slice(2, 8)}@Example.com`; emails.push(e.toLowerCase()); return e }

describe("newsletter sign-up", () => {
  it("subscribes, normalises, stays idempotent and records where the address came from", async () => {
    const email = addr()
    const a = await json("/api/newsletter", null, "POST", { email, source: "shop:matlar" })
    expect(a.status).toBe(200)
    expect(await a.json()).toEqual({ ok: true })
    expect((await json("/api/newsletter", null, "POST", { email: email.toUpperCase() })).status).toBe(200)
    const rows = await db.newsletterSubscriber.findMany({ where: { email: email.toLowerCase() } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: "shop:matlar", unsubscribedAt: null })
    expect(rows[0].unsubscribeToken).toMatch(/^[0-9a-f]{36}$/)
  })

  it("rejects malformed, empty and oversized input", async () => {
    for (const body of [{ email: "nope" }, { email: "a@b" }, {}, { email: 5 }, { email: `${"x".repeat(200)}@example.com` }]) {
      expect((await json("/api/newsletter", null, "POST", body)).status).toBe(400)
    }
  })

  it("unsubscribes through the secret link, and signing up again re-activates", async () => {
    const email = addr()
    await json("/api/newsletter", null, "POST", { email })
    const sub = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: email.toLowerCase() } })
    expect((await json("/api/newsletter/unsubscribe", null, "POST", { token: "x" })).status).toBe(404)
    expect((await json("/api/newsletter/unsubscribe", null, "POST", { token: "a".repeat(30) })).status).toBe(404)
    expect((await json("/api/newsletter/unsubscribe", null, "POST", { token: sub.unsubscribeToken })).status).toBe(200)
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { id: sub.id } })).unsubscribedAt).toBeTruthy()
    expect((await json("/api/newsletter/unsubscribe", null, "POST", { token: sub.unsubscribeToken })).status).toBe(200) // clicking twice is fine
    await json("/api/newsletter", null, "POST", { email })
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { id: sub.id } })).unsubscribedAt).toBeNull()
    const page = await api(`/bulten/ayril?t=${sub.unsubscribeToken}`)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain("Bültenden ayrıl")
  })
})

describe("newsletter admin", () => {
  it("is admin only", async () => {
    const student = await makeUser("STUDENT")
    expect((await api("/api/admin/newsletter")).status).toBe(401)
    expect((await api("/api/admin/newsletter", student)).status).toBe(403)
    expect((await json("/api/admin/newsletter", student, "POST", { action: "add", emails: addr() })).status).toBe(403)
  })

  it("lists, searches, adds in bulk, exports and deletes subscribers", async () => {
    const admin = await makeUser("ADMIN")
    const [a, b] = [addr(), addr()]
    const add = await json("/api/admin/newsletter", admin, "POST", { action: "add", emails: `${a}, ${b.toUpperCase()}; not-an-email` })
    expect(await add.json()).toMatchObject({ added: 2, invalid: 1 })
    const list = await (await api(`/api/admin/newsletter?q=${encodeURIComponent(a.toLowerCase())}`, admin)).json()
    expect(list.subscribers).toHaveLength(1)
    expect(list.subscribers[0].source).toBe("admin")
    expect(JSON.stringify(list)).not.toContain("unsubscribeToken") // the secret never leaves the server
    expect(list.counts.active).toBeGreaterThanOrEqual(2)
    const csv = await api(`/api/admin/newsletter?format=csv&q=${encodeURIComponent(b.toLowerCase())}`, admin)
    expect(csv.headers.get("content-type")).toContain("text/csv")
    expect(await csv.text()).toContain(b.toLowerCase())
    const del = await api(`/api/admin/newsletter/${list.subscribers[0].id}`, admin, { method: "DELETE" })
    expect(del.status).toBe(200)
    expect(await db.newsletterSubscriber.count({ where: { email: a.toLowerCase() } })).toBe(0)
  })

  it("sends a campaign to active subscribers only and logs it (nothing leaves the server without SMTP settings)", async () => {
    const admin = await makeUser("ADMIN")
    const smtp = (await (await api("/api/admin/newsletter", admin)).json()).smtp
    if (smtp) return // with real SMTP settings this test would send mail: skip
    const email = addr()
    await json("/api/newsletter", null, "POST", { email })
    expect((await json("/api/admin/newsletter", admin, "POST", { action: "send", subject: "x", body: "kısa" })).status).toBe(400)
    expect((await json("/api/admin/newsletter", admin, "POST", { action: "send", subject: "Test kampanya", body: "Merhaba, bu bir deneme iletisidir.", ctaHref: "javascript:alert(1)", ctaLabel: "Tıkla" })).status).toBe(400)
    const r = await json("/api/admin/newsletter", admin, "POST", { action: "send", subject: "Test kampanya A", body: "Merhaba, bu bir deneme iletisidir.", ctaLabel: "Bak", ctaHref: "https://aya.test/x" })
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j).toMatchObject({ success: true, skipped: true, sent: 0 })
    expect(j.recipients).toBeGreaterThanOrEqual(1)
    const log = await (await api("/api/admin/newsletter", admin)).json()
    expect(log.campaigns[0]).toMatchObject({ subject: "Test kampanya A", kind: "manual", skipped: true })
    expect((await json("/api/admin/newsletter", admin, "POST", { action: "test", subject: "Test kampanya", body: "Merhaba, bu bir deneme iletisidir." })).status).toBe(409)
    expect((await json("/api/admin/newsletter", admin, "POST", { action: "bogus" })).status).toBe(400)
  })

  it("announces a published article once when asked to", async () => {
    const admin = await makeUser("ADMIN")
    const r = await json("/api/admin/articles", admin, "POST", {
      title: `Test duyuru ${Math.random().toString(16).slice(2, 6)}`, excerpt: "Yeni bir duyuru: sistem bakımı tamamlandı ve her şey yolunda.", body: "## Duyuru\n\n" + "Bakım tamamlandı. ".repeat(12), category: "Duyurular", status: "PUBLISHED", notify: true,
    })
    const j = await r.json()
    refIds.push(j.article.id)
    expect(j.newsletter).toBeTruthy()
    expect(await db.newsletterCampaign.count({ where: { refId: j.article.id, kind: "article" } })).toBe(1)
    const again = await json(`/api/admin/articles/${j.article.id}`, admin, "PATCH", { notify: true })
    expect((await again.json()).newsletter).toBeNull()
    expect(await db.newsletterCampaign.count({ where: { refId: j.article.id } })).toBe(1)
    const noNotify = await json("/api/admin/articles", admin, "POST", { title: `Test haber ${Math.random().toString(16).slice(2, 6)}`, excerpt: "Sessiz bir haber: abonelere gönderilmemesi gerekir.", body: "## Haber\n\n" + "Sessiz haber. ".repeat(12), category: "Haberler", status: "PUBLISHED" })
    const n = await noNotify.json()
    refIds.push(n.article.id)
    expect(n.newsletter).toBeNull()
  })
})
