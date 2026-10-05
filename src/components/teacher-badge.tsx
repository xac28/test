import { BadgeCheck, Eye } from "lucide-react"
import { STATUS_HINT_TR, STATUS_LABEL_TR, teacherStatus } from "@/lib/supervision"

/**
 * "Onaylı öğretmen" (reviewed and approved by the AYA team) or "Deneme öğretmeni" (still in the trial phase: their
 * broadcasts are watched by officials). `tone="dark"` is for the dark live screens.
 */
export function TeacherBadge({ trial, size = "md", tone = "light", className = "" }: { trial: boolean; size?: "sm" | "md"; tone?: "light" | "dark"; className?: string }) {
  const status = teacherStatus(trial)
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px] gap-1" : "px-2.5 py-1 text-xs gap-1.5"
  const colors =
    status === "approved"
      ? tone === "dark" ? "bg-teal-400/15 text-teal-200 border-teal-300/30" : "bg-teal-50 text-teal-700 border-teal-200"
      : tone === "dark" ? "bg-saffron-300/15 text-saffron-300 border-saffron-300/40" : "bg-saffron-100 text-saffron-600 border-saffron-300"
  return (
    <span
      data-testid={status === "approved" ? "badge-approved" : "badge-trial"}
      title={STATUS_HINT_TR[status]}
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${pad} ${colors} ${className}`}
    >
      {status === "approved" ? <BadgeCheck size={size === "sm" ? 12 : 14} aria-hidden /> : <Eye size={size === "sm" ? 12 : 14} aria-hidden />}
      {STATUS_LABEL_TR[status]}
    </span>
  )
}
