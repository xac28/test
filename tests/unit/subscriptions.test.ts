import { describe, it, expect } from "vitest"
import { addInterval, effectivePlan, formatTL, memberLessonPrice, monthKey, normalizeTrGsm, planPriceKurus, RENEWAL_GRACE_MS } from "@/lib/subscriptions"

describe("membership plans", () => {
  it("prices default per plan/interval and can be set from the environment in TL", () => {
    expect(planPriceKurus("PREMIUM", "MONTHLY", {})).toBe(49_900)
    expect(planPriceKurus("UNLIMITED", "YEARLY", {})).toBe(959_000)
    expect(planPriceKurus("PREMIUM", "MONTHLY", { SUB_PRICE_PREMIUM_MONTHLY: "549,90" })).toBe(54_990)
    expect(planPriceKurus("PREMIUM", "MONTHLY", { SUB_PRICE_PREMIUM_MONTHLY: "₺ 600" })).toBe(60_000)
    // nonsense falls back to the default instead of selling for 0
    for (const bad of ["0", "-5", "abc", ""]) expect(planPriceKurus("PREMIUM", "MONTHLY", { SUB_PRICE_PREMIUM_MONTHLY: bad })).toBe(49_900)
  })

  it("a paid plan counts only while its period (plus the renewal grace) runs", () => {
    const now = new Date("2026-11-19T12:00:00Z")
    const future = new Date(now.getTime() + 86_400_000)
    expect(effectivePlan({ subscriptionPlan: "PREMIUM", subscriptionEnds: future }, now)).toBe("PREMIUM")
    expect(effectivePlan({ subscriptionPlan: "UNLIMITED", subscriptionEnds: new Date(now.getTime() - RENEWAL_GRACE_MS + 60_000) }, now)).toBe("UNLIMITED")
    expect(effectivePlan({ subscriptionPlan: "UNLIMITED", subscriptionEnds: new Date(now.getTime() - RENEWAL_GRACE_MS - 60_000) }, now)).toBe("FREE")
    expect(effectivePlan({ subscriptionPlan: "PREMIUM", subscriptionEnds: null }, now)).toBe("FREE")
    expect(effectivePlan({ subscriptionPlan: "GOLD", subscriptionEnds: future }, now)).toBe("FREE")
    expect(effectivePlan(null, now)).toBe("FREE")
  })

  it("members get 20% off lessons; free lessons stay free", () => {
    expect(memberLessonPrice(40, "PREMIUM")).toBe(32)
    expect(memberLessonPrice(33.33, "UNLIMITED")).toBe(26.66)
    expect(memberLessonPrice(40, "FREE")).toBe(40)
    expect(memberLessonPrice(0, "PREMIUM")).toBe(0)
  })

  it("periods, months and phone numbers", () => {
    expect(addInterval(new Date("2026-01-15T10:00:00Z"), "MONTHLY").toISOString()).toBe("2026-02-15T10:00:00.000Z")
    expect(addInterval(new Date("2026-01-15T10:00:00Z"), "YEARLY").toISOString()).toBe("2027-01-15T10:00:00.000Z")
    // 31 Oct 22:30 UTC is already 1 November in Turkey
    expect(monthKey(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11")
    expect(monthKey(new Date("2026-10-31T20:00:00Z"))).toBe("2026-10")
    for (const ok of ["05321234567", "5321234567", "+90 532 123 45 67", "905321234567", "0532-123-45-67"]) expect(normalizeTrGsm(ok)).toBe("+905321234567")
    for (const bad of ["1234", "02121234567", "", "+1 202 555 0100"]) expect(normalizeTrGsm(bad)).toBeNull()
    expect(formatTL(49_900)).toBe("₺499")
    expect(formatTL(479_000)).toBe("₺4.790")
    expect(formatTL(54_990)).toBe("₺549,90")
  })
})
