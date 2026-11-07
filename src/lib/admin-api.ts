import { NextResponse } from "next/server"
import { resolveUser, AuthUser } from "@/lib/auth-utils"

/** Resolves the signed-in admin (cookie or Bearer) or returns the 401/403 response to send back. */
export async function requireAdmin(req: Request): Promise<{ admin: AuthUser } | { response: NextResponse }> {
  const user = await resolveUser(req)
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (user.role !== "ADMIN") return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { admin: user }
}

export function pageOf(url: URL, size = 20) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1)
  return { page, size, skip: (page - 1) * size }
}

export const CSV_LIMIT = 5000
export const wantsCsv = (url: URL) => url.searchParams.get("format") === "csv"

/** Reasons typed by admins end up in audit logs and e-mails: trim and cap them. */
export function cleanReason(raw: unknown, max = 500): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : ""
}
