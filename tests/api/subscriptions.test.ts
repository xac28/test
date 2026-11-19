import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, makeTeacher, db } from "./helpers"
import { PREMIUM_MONTHLY_PASSES, monthKey } from "@/lib/subscriptions"

const users: string[] = []
const rooms: string[] = []
afterAll(async () => {
  await db.subscriptionPass.deleteMany({ where: { userId: { in: users } } })
  await db.subscription.deleteMany({ where: { userId: { in: users } } })
  await db.liveRoom.deleteMany({ where: { id: { in: rooms } } })
  await db.$disconnect()
})

const student = async () => { const u = await makeUser("STUDENT"); users.push(u.id); return u }
const setPlan = (id: string, plan: "FREE" | "PREMIUM" | "UNLIMITED", days = 20) =>
  db.user.update({ where: { id }, data: { subscriptionPlan: plan, subscriptionEnds: plan === "FREE" ? null : new Date(Date.now() + days * 86_400_000) } })
const billing = { phone: "0532 123 45 67", city: "İzmir", address: "Alsancak mah. 1453 sok. No 7" }
const where = (r: Response) => r.headers.get("location") ?? ""
const callback = (token: string) => api("/api/subscriptions/callback", null, { method: "POST", body: new URLSearchParams({ token }), redirect: "manual" })
const tokenOf = (html: string, testid: string) => html.match(new RegExp(`name="token" value="([^"]+)"><button type="submit" data-testid="${testid}"`))?.[1] ?? ""
async function paidRoom() {
  const t = await makeTeacher()
  users.push(t.user.id)
  const room = await db.liveRoom.create({ data: { teacherId: t.teacher.id, roomName: `sub-test-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, title: "Özel akış", studentsOnly: true } })
  rooms.push(room.id)
  return room
}

describe("plans and checkout", () => {
  it("lists plans and TL prices to everyone; membership only for the signed-in caller", async () => {
    const anon = await (await api("/api/subscriptions")).json()
    expect(anon.plans.map((p: { id: string }) => p.id)).toEqual(["FREE", "PREMIUM", "UNLIMITED"])
    expect(anon.prices.PREMIUM.MONTHLY).toBeGreaterThan(0)
    expect(anon.prices.UNLIMITED.YEARLY).toBeGreaterThan(anon.prices.UNLIMITED.MONTHLY)
    expect(anon.membership).toBeNull()
    const s = await student()
    const mine = await (await api("/api/subscriptions", s)).json()
    expect(mine.membership).toMatchObject({ plan: "FREE", subscription: null, passes: null })
  })

  it("refuses strangers and bad input", async () => {
    expect((await json("/api/subscriptions/checkout", null, "POST", { plan: "PREMIUM", interval: "MONTHLY", ...billing })).status).toBe(401)
    const s = await student()
    for (const bad of [{ plan: "GOLD" }, { interval: "WEEKLY" }, { phone: "123" }, { city: "" }, { address: "kısa" }]) {
      const r = await json("/api/subscriptions/checkout", s, "POST", { plan: "PREMIUM", interval: "MONTHLY", ...billing, ...bad })
      expect(r.status, JSON.stringify(bad)).toBe(400)
    }
    expect((await db.subscription.count({ where: { userId: s.id } }))).toBe(0)
  })

  it("pays, activates once, blocks a second subscription, cancels but keeps the paid period (mock provider)", async () => {
    const s = await student()
    const r = await json("/api/subscriptions/checkout", s, "POST", { plan: "PREMIUM", interval: "MONTHLY", ...billing })
    if (r.status === 503) {
      // no payment provider on this server: nothing may be created
      expect((await r.json()).code).toBe("PAYMENTS_OFF")
      expect(await db.subscription.count({ where: { userId: s.id } })).toBe(0)
      return
    }
    expect(r.status).toBe(200)
    const { html } = await r.json()
    const ok = tokenOf(html, "mock-sub-ok")
    expect(ok).toMatch(/^mock\./)
    expect(where(await callback(ok.slice(0, -2) + "xx"))).toContain("odeme=hata") // forged signature

    const both = await Promise.all([callback(ok), callback(ok)]) // the provider / a double click may post twice
    for (const b of both) { expect(b.status).toBe(303); expect(where(b)).toContain("/dashboard/uyelik?odeme=ok") }
    const subs = await db.subscription.findMany({ where: { userId: s.id } })
    expect(subs).toHaveLength(1)
    expect(subs[0]).toMatchObject({ status: "ACTIVE", plan: "PREMIUM", interval: "MONTHLY" })
    const u = await db.user.findUniqueOrThrow({ where: { id: s.id } })
    expect(u.subscriptionPlan).toBe("PREMIUM")
    expect(u.subscriptionEnds!.getTime()).toBeGreaterThan(Date.now() + 27 * 86_400_000)
    expect(u.phone).toBe("+905321234567")

    const again = await json("/api/subscriptions/checkout", s, "POST", { plan: "UNLIMITED", interval: "YEARLY", ...billing })
    expect(again.status).toBe(409)
    expect((await again.json()).code).toBe("ALREADY_ACTIVE")

    expect((await api("/api/subscriptions", s, { method: "DELETE" })).status).toBe(200)
    expect((await db.subscription.findUniqueOrThrow({ where: { id: subs[0].id } })).status).toBe("CANCELED")
    const after = await (await api("/api/subscriptions", s)).json()
    expect(after.membership.plan).toBe("PREMIUM") // the paid month is kept
    expect(after.membership.subscription.status).toBe("CANCELED")
    const during = await json("/api/subscriptions/checkout", s, "POST", { plan: "PREMIUM", interval: "MONTHLY", ...billing })
    expect((await during.json()).code).toBe("PERIOD_RUNNING")
    expect((await api("/api/subscriptions", s, { method: "DELETE" })).status).toBe(404)
  })

  it("a declined payment activates nothing", async () => {
    const s = await student()
    const r = await json("/api/subscriptions/checkout", s, "POST", { plan: "UNLIMITED", interval: "YEARLY", ...billing })
    if (r.status === 503) return
    const { html } = await r.json()
    expect(where(await callback(tokenOf(html, "mock-sub-fail")))).toContain("odeme=red")
    expect((await db.subscription.findFirstOrThrow({ where: { userId: s.id } })).status).toBe("FAILED")
    expect((await db.user.findUniqueOrThrow({ where: { id: s.id } })).subscriptionPlan).toBe("FREE")
    // the approve button of that closed checkout no longer works
    expect(where(await callback(tokenOf(html, "mock-sub-ok")))).toContain("odeme=hata")
  })

  it("the webhook ignores unknown references and the cron needs its secret", async () => {
    expect((await json("/api/subscriptions/webhook", null, "POST", { subscriptionReferenceCode: "nope", iyziEventType: "subscription.order.success" })).status).toBe(200)
    expect((await json("/api/cron/subscriptions", null, "POST", {})).status).toBe(401)
  })
})

describe("what membership unlocks", () => {
  it("students-only broadcasts: hidden and closed for free users, Premium spends one pass per broadcast, Sınırsız enters freely", async () => {
    const room = await paidRoom()
    const free = await student()
    const listed = async (u: { token: string }) => ((await (await api("/api/live", u)).json()).broadcasts as { id: string }[]).some((b) => b.id === room.id)

    expect(await listed(free)).toBe(false)
    const denied = await json(`/api/live/${room.id}/join`, free, "POST", {})
    expect(denied.status).toBe(403)
    expect((await denied.json()).code).toBe("STUDENTS_ONLY")

    const premium = await student()
    await setPlan(premium.id, "PREMIUM")
    expect(await listed(premium)).toBe(true)
    expect((await json(`/api/live/${room.id}/join`, premium, "POST", {})).status).toBe(200)
    expect((await json(`/api/live/${room.id}/join`, premium, "POST", {})).status).toBe(200) // re-entering is free
    expect(await db.subscriptionPass.count({ where: { userId: premium.id } })).toBe(1)
    const summary = await (await api("/api/subscriptions", premium)).json()
    expect(summary.membership.passes).toMatchObject({ used: 1, limit: PREMIUM_MONTHLY_PASSES })

    // the month's passes run out
    const month = monthKey()
    await db.subscriptionPass.createMany({ data: Array.from({ length: PREMIUM_MONTHLY_PASSES - 1 }, (_, i) => ({ userId: premium.id, liveRoomId: `old-${i}-${premium.id}`, month })) })
    const other = await paidRoom()
    const out = await json(`/api/live/${other.id}/join`, premium, "POST", {})
    expect(out.status).toBe(403)
    expect((await out.json()).code).toBe("PASS_LIMIT")
    expect((await json(`/api/live/${room.id}/join`, premium, "POST", {})).status).toBe(200) // already-entered broadcast still open

    const unlimited = await student()
    await setPlan(unlimited.id, "UNLIMITED")
    for (const r of [room, other]) expect((await json(`/api/live/${r.id}/join`, unlimited, "POST", {})).status).toBe(200)
    expect(await db.subscriptionPass.count({ where: { userId: unlimited.id } })).toBe(0)

    // an expired plan unlocks nothing
    const lapsed = await student()
    await setPlan(lapsed.id, "UNLIMITED", -5)
    expect((await json(`/api/live/${room.id}/join`, lapsed, "POST", {})).status).toBe(403)
  })

  it("members pay 20% less for a lesson; without a payment method nothing is booked on a production server", async () => {
    const t = await makeTeacher()
    users.push(t.user.id)
    const m = await student()
    await setPlan(m.id, "PREMIUM")
    const slot = new Date(Date.now() + 5 * 86_400_000)
    slot.setUTCHours(10, 0, 0, 0)
    const r = await json("/api/bookings", m, "POST", { teacherSlug: t.teacher.id, slot: slot.toISOString(), type: "regular" })
    if (r.status === 503) {
      expect((await r.json()).code).toBe("PAYMENTS_OFF")
      expect(await db.booking.count({ where: { studentId: m.id } })).toBe(0)
      return
    }
    expect(r.status).toBe(200)
    expect((await r.json()).price).toBe(32)
    expect((await db.booking.findFirstOrThrow({ where: { studentId: m.id } })).price).toBe(32)
  })
})
