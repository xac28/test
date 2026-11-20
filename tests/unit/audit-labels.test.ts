import { describe, it, expect } from "vitest"
import { auditLabel } from "@/lib/audit-labels"

describe("auditLabel", () => {
  it("has a Turkish label for every action code this codebase actually logs", () => {
    // Every db.auditLog.create({ data: { action: "..." } }) call, pulled by hand — if a new one is added
    // without a label here, it falls through to the raw (English) code in the admin audit log.
    const loggedActions = [
      "BAN_USER", "UNBAN_USER", "WARN_USER", "MANUAL_IP_BAN", "REMOVE_IP_BAN",
      "CLOSE_ROOM", "WATCH_LIVE", "LIVE_NOTICE", "TIMEOUT_ROOM", "CANCEL_BOOKING", "DELETE_RECORDING", "UNPUBLISH_WORKSHOP",
      "REMOVE_POST", "REMOVE_COMMENT", "REMOVE_CONTENT", "UNMUTE_USER",
      "BLOCKED_WORD_ADD", "BLOCKED_WORD_REMOVE",
      "AI_TEACH", "AI_TAUGHT_EDIT", "AI_TAUGHT_DELETE", "AI_DISMISS",
      "POLICY_FORGIVE", "POLICY_LIFT", "POLICY_SUSPEND", "POLICY_RECORD",
      "REPORT_BULK", "REPORT_ESCALATED", "REPORT_UPDATE",
      "SUPPORT_REPLY", "SUPPORT_NOTE", "SUPPORT_CLOSE", "SUPPORT_REOPEN", "SUPPORT_ASSIGN", "SUPPORT_UNASSIGN", "SUPPORT_PRIORITY",
      "POST_APPROVE", "POST_REJECT", "POST_REMOVE", "POST_RESTORE",
      "COMMENT_REMOVE", "COMMENT_RESTORE", "REVIEW_REMOVE", "REVIEW_RESTORE",
      "BRAND_PAYOUT", "PERSONAL_DISCOUNT_GRANT", "PERSONAL_DISCOUNT_CANCEL", "CAMPAIGN_CREATE", "CAMPAIGN_UPDATE", "CAMPAIGN_DELETE",
      "NEWSLETTER_SEND", "NEWSLETTER_DELETE",
    ]
    for (const action of loggedActions) {
      expect(auditLabel(action), action).not.toBe(action)
    }
  })

  it("falls back to a readable prefix label for a PAYOUT_/REPORT_/TRIAL_ action it hasn't seen before", () => {
    expect(auditLabel("PAYOUT_APPROVE")).toBe("Ödeme talebi: approve")
    expect(auditLabel("TRIAL_REJECT")).toBe("Deneme odası: reject")
  })

  it("shows a truly unknown code as-is rather than throwing", () => {
    expect(auditLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW")
  })
})
