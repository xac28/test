/** Where each kind of account lands: its own panel (the student panel is only for students). */
export function homePathFor(role: string | null | undefined): string {
  if (role === "ADMIN") return "/admin"
  if (role === "TEACHER") return "/teach"
  return "/dashboard"
}
