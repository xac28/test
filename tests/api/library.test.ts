import { describe, it, expect } from "vitest"
import { api } from "./helpers"

describe("pose and style library API (mobile app)", () => {
  it("lists, searches and filters poses", async () => {
    const all = await (await api("/api/poses")).json()
    expect(all.total).toBeGreaterThanOrEqual(15)
    expect(all.poses[0]).toMatchObject({ slug: expect.any(String), name: expect.any(String), image: expect.stringMatching(/^\/poses\/.+\.webp$/) })
    const q = await (await api("/api/poses?q=tadasana")).json()
    expect(q.poses.map((p: any) => p.slug)).toEqual(["dag-durusu"])
    const bal = await (await api(`/api/poses?category=${encodeURIComponent("Denge")}`)).json()
    expect(bal.total).toBeGreaterThan(0)
    expect(bal.total).toBeLessThan(all.total)
    expect((await (await api("/api/poses?q=zzzz-yok")).json()).total).toBe(0)
  })

  it("returns one pose in full, 404 for an unknown one", async () => {
    const p = await (await api("/api/poses/savasci-2")).json()
    expect(p.steps.length).toBeGreaterThanOrEqual(4)
    expect(p.styles.length).toBeGreaterThan(0)
    expect(p.counter.every((c: any) => c.slug && c.image)).toBe(true)
    expect((await api("/api/poses/yok-boyle")).status).toBe(404)
  })

  it("serves the styles with their poses", async () => {
    const list = await (await api("/api/styles")).json()
    expect(list.styles.length).toBe(6)
    const v = await (await api("/api/styles/vinyasa")).json()
    expect(v.name).toBe("Vinyasa")
    expect(v.poses.length).toBeGreaterThan(2)
    expect(v.faq.length).toBeGreaterThan(0)
    expect((await api("/api/styles/yok")).status).toBe(404)
    // anyone may read it, and the answer can be cached
    expect((await api("/api/styles")).headers.get("cache-control")).toContain("s-maxage")
  })
})
