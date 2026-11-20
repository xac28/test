import { describe, it, expect } from "vitest"
import {
  applyDiscountPct, campaignDiscountPct, isCampaignActive, personalDiscountPct,
  validateCampaignInput, validatePersonalDiscountInput,
} from "@/lib/discounts"

describe("validatePersonalDiscountInput", () => {
  it("accepts a plain percentage and rounds it", () => {
    const v = validatePersonalDiscountInput({ discountPct: "33.33" })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v).toMatchObject({ discountPct: 33.3, reason: null, endsAt: null })
  })

  it("rejects 0, negative, over 100, and non-numeric", () => {
    expect(validatePersonalDiscountInput({ discountPct: 0 }).ok).toBe(false)
    expect(validatePersonalDiscountInput({ discountPct: -5 }).ok).toBe(false)
    expect(validatePersonalDiscountInput({ discountPct: 101 }).ok).toBe(false)
    expect(validatePersonalDiscountInput({ discountPct: "abc" }).ok).toBe(false)
  })

  it("accepts 100 (a fully free account)", () => {
    expect(validatePersonalDiscountInput({ discountPct: 100 }).ok).toBe(true)
  })

  it("trims and caps the reason, and rejects a past end date", () => {
    const v = validatePersonalDiscountInput({ discountPct: 50, reason: "  Yeni eğitmen tanıtımı  " })
    expect(v.ok && v.reason).toBe("Yeni eğitmen tanıtımı")
    expect(validatePersonalDiscountInput({ discountPct: 50, endsAt: "2020-01-01" }).ok).toBe(false)
    expect(validatePersonalDiscountInput({ discountPct: 50, endsAt: "not-a-date" }).ok).toBe(false)
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const v2 = validatePersonalDiscountInput({ discountPct: 50, endsAt: future })
    expect(v2.ok && v2.endsAt?.toISOString()).toBe(future)
  })
})

describe("validateCampaignInput", () => {
  const base = { name: "Yılbaşı Kampanyası", discountPct: 20, scope: "ALL", startsAt: "2027-01-01T00:00:00.000Z", endsAt: "2027-01-10T00:00:00.000Z" }

  it("accepts a well-formed campaign", () => {
    const v = validateCampaignInput(base)
    expect(v.ok).toBe(true)
    if (v.ok) expect(v).toMatchObject({ name: "Yılbaşı Kampanyası", discountPct: 20, scope: "ALL" })
  })

  it("rejects a short name, a bad scope, out-of-range discount, and endsAt before startsAt", () => {
    expect(validateCampaignInput({ ...base, name: "Hi" }).ok).toBe(false)
    expect(validateCampaignInput({ ...base, scope: "EVERYONE" }).ok).toBe(false)
    expect(validateCampaignInput({ ...base, discountPct: 0 }).ok).toBe(false)
    expect(validateCampaignInput({ ...base, discountPct: 150 }).ok).toBe(false)
    expect(validateCampaignInput({ ...base, startsAt: base.endsAt, endsAt: base.startsAt }).ok).toBe(false)
  })

  it("an empty banner message becomes null", () => {
    const v = validateCampaignInput({ ...base, bannerMessage: "   " })
    expect(v.ok && v.bannerMessage).toBeNull()
  })
})

describe("personalDiscountPct", () => {
  it("is 0 for no discount, and 0 once endsAt has passed", () => {
    expect(personalDiscountPct(null)).toBe(0)
    expect(personalDiscountPct({ discountPct: 50, endsAt: new Date(Date.now() - 1000) })).toBe(0)
  })

  it("applies while open-ended or still within its end date", () => {
    expect(personalDiscountPct({ discountPct: 50, endsAt: null })).toBe(50)
    expect(personalDiscountPct({ discountPct: 100, endsAt: new Date(Date.now() + 100_000) })).toBe(100)
  })
})

describe("campaignDiscountPct / isCampaignActive", () => {
  const now = new Date("2027-01-05T00:00:00.000Z")
  const studentsCampaign = { discountPct: 10, scope: "STUDENTS" as const, startsAt: new Date("2027-01-01"), endsAt: new Date("2027-01-10") }
  const teachersCampaign = { discountPct: 40, scope: "TEACHERS" as const, startsAt: new Date("2027-01-01"), endsAt: new Date("2027-01-10") }
  const allCampaign = { discountPct: 20, scope: "ALL" as const, startsAt: new Date("2027-01-01"), endsAt: new Date("2027-01-10") }
  const expired = { discountPct: 90, scope: "ALL" as const, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-01-10") }
  const notYet = { discountPct: 90, scope: "ALL" as const, startsAt: new Date("2028-01-01"), endsAt: new Date("2028-01-10") }

  it("isCampaignActive checks the date window", () => {
    expect(isCampaignActive(studentsCampaign, now)).toBe(true)
    expect(isCampaignActive(expired, now)).toBe(false)
    expect(isCampaignActive(notYet, now)).toBe(false)
  })

  it("matches STUDENTS/TEACHERS campaigns only for their own role, ALL for both, and ignores inactive ones", () => {
    const campaigns = [studentsCampaign, teachersCampaign, expired, notYet]
    expect(campaignDiscountPct(campaigns, "STUDENT", now)).toBe(10)
    expect(campaignDiscountPct(campaigns, "TEACHER", now)).toBe(40)
  })

  it("picks the best (highest) applicable campaign when several overlap", () => {
    const campaigns = [studentsCampaign, allCampaign]
    expect(campaignDiscountPct(campaigns, "STUDENT", now)).toBe(20) // ALL's 20% beats STUDENTS' 10%
    expect(campaignDiscountPct(campaigns, "TEACHER", now)).toBe(20) // only ALL applies to teachers here
  })

  it("is 0 when nothing matches", () => {
    expect(campaignDiscountPct([expired, notYet], "STUDENT", now)).toBe(0)
    expect(campaignDiscountPct([], "TEACHER", now)).toBe(0)
  })
})

describe("applyDiscountPct", () => {
  it("reduces the price by the given percentage, rounded to cents", () => {
    expect(applyDiscountPct(40, 20)).toBe(32)
    expect(applyDiscountPct(20, 50)).toBe(10)
  })

  it("100% makes it free; 0 or negative pct/amount pass through", () => {
    expect(applyDiscountPct(40, 100)).toBe(0)
    expect(applyDiscountPct(40, 0)).toBe(40)
    expect(applyDiscountPct(0, 50)).toBe(0)
    expect(applyDiscountPct(-5, 50)).toBe(-5)
  })

  it("clamps an out-of-range percentage instead of trusting the caller", () => {
    expect(applyDiscountPct(40, 150)).toBe(0)
    expect(applyDiscountPct(40, -10)).toBe(40)
  })
})
