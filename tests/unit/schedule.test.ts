import { describe, expect, it } from "vitest"
import { formatSchedule, fromLocalInput, parseSchedule, scheduleData, toLocalInput } from "@/lib/schedule"

const now = new Date("2026-10-09T10:00:00Z")
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString()

describe("scheduled publishing rules", () => {
  it("accepts an empty value, a future date and rejects nonsense, the past and the far future", () => {
    expect(parseSchedule("", now)).toEqual({ ok: true, value: null })
    expect(parseSchedule(null, now)).toEqual({ ok: true, value: null })
    const ok = parseSchedule(inHours(5), now)
    expect(ok.ok && ok.value?.toISOString()).toBe(inHours(5))
    expect(parseSchedule("not a date", now)).toMatchObject({ ok: false })
    expect(parseSchedule(12345, now)).toMatchObject({ ok: false })
    expect(parseSchedule(inHours(-3), now)).toMatchObject({ ok: false, error: expect.stringContaining("geçmişte") })
    expect(parseSchedule(inHours(24 * 400), now)).toMatchObject({ ok: false, error: expect.stringContaining("1 yıl") })
    expect(parseSchedule(new Date(now.getTime() - 10_000), now).ok).toBe(true) // a few seconds of clock difference is fine
  })

  it("publishing now or unpublishing drops the schedule", () => {
    const existing = { scheduledAt: new Date(inHours(5)), scheduledNotify: true }
    expect(scheduleData({}, "PUBLISHED", existing, now)).toEqual({ ok: true, data: { scheduledAt: null, scheduledNotify: false } })
    expect(scheduleData({}, "DRAFT", existing, now, true)).toEqual({ ok: true, data: { scheduledAt: null, scheduledNotify: false } })
  })

  it("editing a scheduled draft keeps its time and announcement choice; sending null cancels it", () => {
    const existing = { scheduledAt: new Date(inHours(5)), scheduledNotify: true }
    expect(scheduleData({ title: "x" }, "DRAFT", existing, now)).toEqual({ ok: true, data: existing })
    expect(scheduleData({ notify: false }, "DRAFT", existing, now)).toEqual({ ok: true, data: { scheduledAt: existing.scheduledAt, scheduledNotify: false } })
    expect(scheduleData({ scheduledAt: null }, "DRAFT", existing, now)).toEqual({ ok: true, data: { scheduledAt: null, scheduledNotify: false } })
  })

  it("sets a new time with the announcement flag, and refuses a bad one", () => {
    const r = scheduleData({ scheduledAt: inHours(2), notify: true }, "DRAFT", undefined, now)
    expect(r.ok && r.data.scheduledNotify).toBe(true)
    expect(scheduleData({ scheduledAt: inHours(2) }, "DRAFT", undefined, now)).toMatchObject({ ok: true, data: { scheduledNotify: false } })
    expect(scheduleData({ scheduledAt: inHours(-9) }, "DRAFT", undefined, now)).toMatchObject({ ok: false })
    expect(scheduleData({}, "DRAFT", undefined, now)).toEqual({ ok: true, data: { scheduledAt: null, scheduledNotify: false } })
  })

  it("converts to and from the browser's date-time input", () => {
    expect(toLocalInput(null)).toBe("")
    expect(toLocalInput("garbage")).toBe("")
    const local = toLocalInput("2026-10-12T07:30:00Z")
    expect(local).toMatch(/^2026-10-1[12]T\d\d:\d\d$/)
    expect(fromLocalInput(local)).toBe("2026-10-12T07:30:00.000Z")
    expect(fromLocalInput("")).toBeNull()
    expect(formatSchedule("2026-10-12T07:30:00Z")).toMatch(/Eki|10/)
    expect(formatSchedule(null)).toBe("")
  })
})
