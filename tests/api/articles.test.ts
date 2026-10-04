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
