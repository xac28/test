import { describe, it, expect } from "vitest"
import {
  categoriesFor, validateReportInput, computePriority, withinRateLimit, sanitizeReportText, canTransition, isOpen,
  REPORT_CATEGORIES, ESCALATION_THRESHOLD, MAX_REPORTS_PER_HOUR, MAX_REPORTS_PER_DAY,
} from "@/lib/reports"

const ok = { targetType: "LIVE_ROOM", targetId: "room1", category: "HARASSMENT", description: "Eğitmen katılımcılara hakaret etti." }

describe("categories", () => {
  it("each target only offers sensible categories", () => {
    const booking = categoriesFor("BOOKING").map((c) => c.id)
    expect(booking).toContain("NO_SHOW")
    expect(categoriesFor("LIVE_ROOM").map((c) => c.id)).not.toContain("NO_SHOW")
    expect(categoriesFor("CHAT_MESSAGE").map((c) => c.id)).toContain("SPAM")
    expect(categoriesFor("TEACHER").map((c) => c.id)).not.toContain("TECHNICAL")
    for (const t of ["TEACHER", "LIVE_ROOM", "WORKSHOP", "BOOKING", "CHAT_MESSAGE"] as const) {
      expect(categoriesFor(t).map((c) => c.id)).toContain("OTHER")
      expect(categoriesFor(t).map((c) => c.id)).toContain("SAFETY")
    }
    expect(Object.keys(REPORT_CATEGORIES).length).toBe(10)
  })
})

describe("validateReportInput", () => {
  it("accepts a valid report and cleans the text", () => {
    const v = validateReportInput({ ...ok, description: "  Çok   kötü‮ davranış\n\n\n\nsergiledi.  " })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.data.description).toBe("Çok kötü davranış\n\nsergiledi.")
  })
  it("rejects unknown targets, categories not allowed for the target, and short descriptions", () => {
    expect(validateReportInput({ ...ok, targetType: "USER" }).ok).toBe(false)
    expect(validateReportInput({ ...ok, targetId: "" }).ok).toBe(false)
    expect(validateReportInput({ ...ok, category: "NO_SHOW" }).ok).toBe(false) // not for live rooms
    expect(validateReportInput({ ...ok, category: "NOPE" }).ok).toBe(false)
    expect(validateReportInput({ ...ok, description: "kısa" }).ok).toBe(false)
    expect(validateReportInput({ ...ok, description: 42 }).ok).toBe(false)
  })
  it("chat message reports must carry the message", () => {
    const base = { targetType: "CHAT_MESSAGE", targetId: "room1", category: "SPAM", description: "Aynı mesajı tekrar tekrar yazıyor." }
    expect(validateReportInput(base).ok).toBe(false)
    const v = validateReportInput({ ...base, message: { text: "satın al!!!", senderIdentity: "u1", senderName: "Biri", sentAt: 123 } })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.data.message).toEqual({ text: "satın al!!!", senderIdentity: "u1", senderName: "Biri", sentAt: 123 })
  })
  it("truncates over-long text instead of failing", () => {
    expect(sanitizeReportText("x".repeat(5000)).length).toBe(1500)
  })
})

describe("priority & escalation", () => {
  it("uses the category's base priority for a single reporter", () => {
    expect(computePriority("SAFETY", 1)).toBe("HIGH")
    expect(computePriority("TECHNICAL", 1)).toBe("LOW")
    expect(computePriority("QUALITY", 1)).toBe("NORMAL")
  })
  it("raises one level at threshold-1 reporters and becomes URGENT at the threshold", () => {
    expect(computePriority("TECHNICAL", ESCALATION_THRESHOLD - 1)).toBe("NORMAL")
    expect(computePriority("QUALITY", ESCALATION_THRESHOLD - 1)).toBe("HIGH")
    expect(computePriority("SAFETY", ESCALATION_THRESHOLD - 1)).toBe("URGENT")
    expect(computePriority("TECHNICAL", ESCALATION_THRESHOLD)).toBe("URGENT")
    expect(computePriority("SPAM", ESCALATION_THRESHOLD + 5)).toBe("URGENT")
  })
})

describe("limits & workflow", () => {
  it("rate limits per hour and per day", () => {
    expect(withinRateLimit({ lastHour: 0, lastDay: 0 }).ok).toBe(true)
    expect(withinRateLimit({ lastHour: MAX_REPORTS_PER_HOUR, lastDay: 5 }).ok).toBe(false)
    expect(withinRateLimit({ lastHour: 1, lastDay: MAX_REPORTS_PER_DAY }).ok).toBe(false)
  })
  it("status helpers", () => {
    expect(isOpen("PENDING")).toBe(true)
    expect(isOpen("REVIEWED")).toBe(true)
    expect(isOpen("RESOLVED")).toBe(false)
    expect(isOpen("DISMISSED")).toBe(false)
    expect(canTransition("PENDING", "RESOLVED")).toBe(true)
    expect(canTransition("RESOLVED", "REVIEWED")).toBe(true) // reopening is allowed
    expect(canTransition("PENDING", "PENDING")).toBe(false)
    expect(canTransition("PENDING", "BANANA")).toBe(false)
  })
})
