import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, db } from "./helpers"

afterAll(() => db.$disconnect())

const article = (over: object = {}) => ({
  title: `Nefesin Sessiz Gücü ${Math.random().toString(16).slice(2, 6)}`,
  excerpt: "Nefes çalışmasının sinir sistemi üzerindeki etkisine kısa bir bakış.",
  body: "## Giriş\n\n" + "Nefes, bedenle zihin arasındaki köprüdür. ".repeat(8),
  category: "Nefes",
  ...over,
})

describe("articles", () => {
  it("only admins write; drafts stay private until published; unpublishing hides them again", async () => {
    const admin = await makeUser("ADMIN")
    const teacher = await makeUser("TEACHER")

    expect((await json("/api/admin/articles", null, "POST", article())).status).toBe(401)
    expect((await json("/api/admin/articles", teacher, "POST", article())).status).toBe(401)
    expect((await json("/api/admin/articles", admin, "POST", article({ title: "x" }))).status).toBe(400)

    const created = await json("/api/admin/articles", admin, "POST", article())
    expect(created.status).toBe(200)
    const a = (await created.json()).article
    expect(a.status).toBe("DRAFT")
    expect(a.publishedAt).toBeNull()

    const cat = `K${Math.random().toString(16).slice(2, 6)}`
    await json(`/api/admin/articles/${a.id}`, admin, "PATCH", { category: cat })
    expect((await (await api(`/api/articles?category=${cat}`)).json()).articles).toHaveLength(0) // draft is private

    const pub = await json(`/api/admin/articles/${a.id}`, admin, "PATCH", { status: "PUBLISHED" })
    expect(pub.status).toBe(200)
    expect((await pub.json()).article.publishedAt).toBeTruthy()
    const list = await (await api(`/api/articles?category=${cat}`)).json()
    expect(list.articles.map((x: any) => x.slug)).toEqual([a.slug])
    expect(JSON.stringify(list)).not.toContain("Nefes, bedenle") // list never ships the body

    await json(`/api/admin/articles/${a.id}`, admin, "PATCH", { status: "DRAFT" })
    expect((await (await api(`/api/articles?category=${cat}`)).json()).articles).toHaveLength(0)

    // non-admin cannot edit or delete; admin can
    expect((await json(`/api/admin/articles/${a.id}`, teacher, "PATCH", { title: "Hacked title" })).status).toBe(401)
    expect((await api(`/api/admin/articles/${a.id}`, teacher, { method: "DELETE" })).status).toBe(401)
    expect((await api(`/api/admin/articles/${a.id}`, admin, { method: "DELETE" })).status).toBe(200)
    expect(await db.article.findUnique({ where: { id: a.id } })).toBeNull()
  })
})

describe("writing helper (admin)", () => {
  const text = "Yin yoga, duruşların üç ila beş dakika boyunca tutulduğu yavaş ve derin bir esneme pratiğidir. Kasları değil, bağ dokusunu ve eklemleri hedefler. Bu yüzden yin yoga, günün yorgunluğunu atmak isteyenler için çok uygundur. Nefes yin yogada en önemli araçtır; her duruşta nefesi izlemek zihni de sakinleştirir."
  it("suggests an excerpt, titles and a checklist for a text, only for admins", async () => {
    const admin = await makeUser("ADMIN")
    const post = (b: object, u: any = admin) => json("/api/admin/writing", u, "POST", b)
    const s = await (await post({ action: "summary", body: text, max: 160 })).json()
    expect(s.summary.length).toBeLessThanOrEqual(160)
    expect(s.summary.length).toBeGreaterThan(40)
    const t = await (await post({ action: "titles", body: text, title: "x" })).json()
    expect(t.titles.length).toBeGreaterThan(1)
    const c = await (await post({ action: "check", body: text, title: "Yin yoga rehberi", excerpt: s.summary })).json()
    expect(c.checks.length).toBeGreaterThan(5)
    expect(c.score).toBeGreaterThanOrEqual(0)
    expect((await post({ action: "summary", body: "" })).status).toBe(400)
    expect((await post({ action: "nope", body: text })).status).toBe(400)
    expect((await post({ action: "summary", body: text }, await makeUser("STUDENT"))).status).toBe(403)
    expect((await post({ action: "summary", body: text }, null)).status).toBe(401)
  })

  it("drafts a newsletter from the content published lately", async () => {
    const admin = await makeUser("ADMIN")
    const title = `Taslak denemesi ${Math.random().toString(36).slice(2, 7)}`
    const a = await db.article.create({ data: { slug: `wr-${Math.random().toString(36).slice(2, 8)}`, title, excerpt: "Bülten taslağı için yazılmış kısa bir özet cümlesi burada.", body: text.repeat(2), category: "Sağlık", status: "PUBLISHED", publishedAt: new Date(), authorId: admin.id } })
    try {
      const d = await (await api("/api/admin/writing?draft=newsletter&days=7", admin)).json()
      expect(d.count).toBeGreaterThanOrEqual(1)
      expect(d.body).toContain(title)
      expect(d.body).toContain(`/icerikler/${a.slug}`)
      expect(d.body.startsWith("Merhaba,")).toBe(true)
      expect(d.subject).toContain("AYA")
      expect((await api("/api/admin/writing?draft=other", admin)).status).toBe(400)
    } finally {
      await db.article.delete({ where: { id: a.id } })
    }
  })
})
