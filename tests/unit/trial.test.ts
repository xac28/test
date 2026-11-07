import { describe, it, expect } from "vitest"
import { trialRoleFor, trialRoomName, trialTransition, canTeachPublicly } from "@/lib/trial"

describe("trial vetting rules", () => {
  it("room name is per teacher", () => expect(trialRoomName("abc")).toBe("trial-abc"))

  it("only the candidate (while in trial) and admins may enter", () => {
    const t = { userId: "u1", isTrialMode: true }
    expect(trialRoleFor({ id: "u1", role: "TEACHER" }, t)).toBe("candidate")
    expect(trialRoleFor({ id: "admin", role: "ADMIN" }, t)).toBe("reviewer")
    expect(trialRoleFor({ id: "u2", role: "TEACHER" }, t)).toBeNull() // another teacher
    expect(trialRoleFor({ id: "s", role: "STUDENT" }, t)).toBeNull()
    expect(trialRoleFor({ id: "u1", role: "TEACHER" }, { userId: "u1", isTrialMode: false })).toBeNull() // already approved
  })

  it("decisions are only valid in the right state", () => {
    expect(trialTransition(true, "approve")).toEqual({ isTrialMode: false })
    expect(trialTransition(false, "approve")).toBeNull()
    expect(trialTransition(true, "reject")).toEqual({ isTrialMode: true })
    expect(trialTransition(false, "reject")).toBeNull()
    expect(trialTransition(false, "revoke")).toEqual({ isTrialMode: true })
    expect(trialTransition(true, "revoke")).toBeNull()
    expect(trialTransition(true, "explode")).toBeNull()
  })

  it("unapproved teachers cannot teach publicly, admins can", () => {
    expect(canTeachPublicly({ isTrialMode: true }, { role: "TEACHER" })).toBe(false)
    expect(canTeachPublicly({ isTrialMode: false }, { role: "TEACHER" })).toBe(true)
    expect(canTeachPublicly({ isTrialMode: true }, { role: "ADMIN" })).toBe(true)
  })
})
