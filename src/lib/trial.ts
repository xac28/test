/**
 * Teacher vetting ("deneme yayını"): a newly approved teacher is in trial mode and may not teach
 * the public until an admin has watched a short live trial and approved them.
 */

export const TRIAL_DURATION_MIN = 5

export function trialRoomName(teacherId: string): string {
  return `trial-${teacherId}`
}

export type TrialRole = "candidate" | "reviewer"

/** Who may be in a trial room: the candidate themself (while still in trial) and admins. */
export function trialRoleFor(
  user: { id: string; role: string },
  teacher: { userId: string; isTrialMode: boolean }
): TrialRole | null {
  if (user.role === "ADMIN") return "reviewer"
  if (teacher.userId === user.id && teacher.isTrialMode) return "candidate"
  return null
}

export type TrialAction = "approve" | "reject" | "revoke"

/** What each decision does, given the teacher's current state. `null` = not allowed in this state. */
export function trialTransition(isTrialMode: boolean, action: string): { isTrialMode: boolean } | null {
  if (action === "approve") return isTrialMode ? { isTrialMode: false } : null
  if (action === "reject") return isTrialMode ? { isTrialMode: true } : null
  if (action === "revoke") return !isTrialMode ? { isTrialMode: true } : null
  return null
}

export const TRIAL_ACTION_LABEL_TR: Record<TrialAction, string> = {
  approve: "onaylandı",
  reject: "reddedildi",
  revoke: "onayı kaldırıldı",
}

/** Public offerings (broadcasts, workshops, bookings) are for approved teachers only; admins are exempt. */
export function canTeachPublicly(teacher: { isTrialMode: boolean }, user: { role: string }): boolean {
  return !teacher.isTrialMode || user.role === "ADMIN"
}
