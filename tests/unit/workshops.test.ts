import { describe, it, expect } from "vitest"
import {
  workshopState, seatsLeft, initialEnrollmentStatus, canEnroll, canAccessContent, validateWorkshopInput, formatPriceTR, JOIN_WINDOW_MIN, WorkshopLike,
} from "@/lib/workshops"

const NOW = new Date("2026-10-04T12:00:00Z")
const at = (min: number) => new Date(NOW.getTime() + min * 60_000)
const live = (over: Partial<WorkshopLike> = {}): WorkshopLike => ({
  mode: "LIVE", status: "PUBLISHED", startsAt: at(120), durationMin: 60, capacity: 10, priceUsd: 0, ...over,
})

describe("workshopState", () => {
  it("covers every phase of a live workshop", () => {
    expect(workshopState(live({ startsAt: at(120) }), NOW)).toBe("upcoming")
    expect(workshopState(live({ startsAt: at(JOIN_WINDOW_MIN) }), NOW)).toBe("starting-soon")
    expect(workshopState(live({ startsAt: at(-10) }), NOW)).toBe("ongoing")
    expect(workshopState(live({ startsAt: at(-60) }), NOW)).toBe("ended")
    expect(workshopState(live({ startsAt: at(-59) }), NOW)).toBe("ongoing")
  })
  it("status and mode override time", () => {
    expect(workshopState(live({ status: "DRAFT" }), NOW)).toBe("draft")
    expect(workshopState(live({ status: "CANCELLED", startsAt: at(-500) }), NOW)).toBe("cancelled")
    expect(workshopState(live({ mode: "RECORDED", startsAt: null }), NOW)).toBe("recorded")
  })
})

describe("seats & enrollment", () => {
  it("cancelled enrollments free their seat", () => {
    const e = [{ status: "CONFIRMED" }, { status: "RESERVED" }, { status: "CANCELLED" }]
    expect(seatsLeft(3, e)).toBe(1)
    expect(seatsLeft(2, e)).toBe(0)
    expect(seatsLeft(1, e)).toBe(0) // never negative
  })
  it("free workshops confirm immediately, paid ones reserve", () => {
    expect(initialEnrollmentStatus(0)).toBe("CONFIRMED")
    expect(initialEnrollmentStatus(25)).toBe("RESERVED")
  })
  it("canEnroll guards", () => {
    expect(canEnroll(live(), { now: NOW, seatsLeft: 3 }).ok).toBe(true)
    expect(canEnroll(live(), { now: NOW, seatsLeft: 0 })).toMatchObject({ ok: false, code: "FULL" })
    expect(canEnroll(live(), { now: NOW, seatsLeft: 3, existing: { status: "CONFIRMED" } })).toMatchObject({ code: "ALREADY" })
    expect(canEnroll(live(), { now: NOW, seatsLeft: 3, existing: { status: "CANCELLED" } }).ok).toBe(true) // may re-enroll
    expect(canEnroll(live({ startsAt: at(-120) }), { now: NOW, seatsLeft: 3 })).toMatchObject({ code: "ENDED" })
    expect(canEnroll(live({ status: "DRAFT" }), { now: NOW, seatsLeft: 3 })).toMatchObject({ code: "UNAVAILABLE" })
    expect(canEnroll(live(), { now: NOW, seatsLeft: 3, isOwner: true })).toMatchObject({ code: "OWNER" })
  })
  it("content access: owner, admin or confirmed only", () => {
    expect(canAccessContent({ isOwner: false, isAdmin: false, enrollmentStatus: "CONFIRMED" })).toBe(true)
    expect(canAccessContent({ isOwner: false, isAdmin: false, enrollmentStatus: "RESERVED" })).toBe(false)
    expect(canAccessContent({ isOwner: false, isAdmin: false, enrollmentStatus: null })).toBe(false)
    expect(canAccessContent({ isOwner: true, isAdmin: false })).toBe(true)
    expect(canAccessContent({ isOwner: false, isAdmin: true })).toBe(true)
  })
})

describe("validateWorkshopInput", () => {
  const base = {
    title: "Sabah Yogası", description: "Güne yumuşak bir başlangıç: nefes, esneme ve kısa bir meditasyon.", category: "Hatha",
    startsAt: at(60).toISOString(), durationMin: 60, capacity: 12, priceUsd: 15,
  }
  it("accepts a valid live workshop and normalises numbers", () => {
    const v = validateWorkshopInput({ ...base, priceUsd: "15.456" }, NOW)
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.data.priceUsd).toBe(15.46)
      expect(v.data.mode).toBe("LIVE")
      expect(v.data.level).toBe("Tüm seviyeler")
    }
  })
  it("rejects bad input", () => {
    expect(validateWorkshopInput({ ...base, title: "ab" }, NOW).ok).toBe(false)
    expect(validateWorkshopInput({ ...base, description: "kısa" }, NOW).ok).toBe(false)
    expect(validateWorkshopInput({ ...base, startsAt: at(-600).toISOString() }, NOW).ok).toBe(false)
    expect(validateWorkshopInput({ ...base, startsAt: "yarın" }, NOW).ok).toBe(false)
    expect(validateWorkshopInput({ ...base, capacity: 0 }, NOW).ok).toBe(false)
    expect(validateWorkshopInput({ ...base, durationMin: 5 }, NOW).ok).toBe(false)
    expect(validateWorkshopInput({ ...base, priceUsd: -1 }, NOW).ok).toBe(false)
    expect(validateWorkshopInput({ ...base, level: "Uzman" }, NOW).ok).toBe(false)
    expect(validateWorkshopInput({ ...base, coverUrl: "javascript:alert(1)" }, NOW).ok).toBe(false)
  })
  it("recorded workshops need a video and ignore the start time", () => {
    expect(validateWorkshopInput({ ...base, mode: "RECORDED" }, NOW).ok).toBe(false)
    const v = validateWorkshopInput({ ...base, mode: "RECORDED", startsAt: undefined, videoUrl: "https://cdn.example.com/v.mp4" }, NOW)
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.data.startsAt).toBeNull()
  })
  it("formatPriceTR", () => {
    expect(formatPriceTR(0)).toBe("Ücretsiz")
    expect(formatPriceTR(15)).toBe("$15")
    expect(formatPriceTR(12.5)).toBe("$12.50")
  })
})
