import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { logEvent } from "@/lib/event-log"

export const dynamic = "force-dynamic"

// POST /api/csp-report — browsers send Content-Security-Policy violations here; they land in the admin system log (SECURITY, info)
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  const raw = await req.text().catch(() => "")
  if (raw.length > 8000) return new NextResponse(null, { status: 204 })
  try {
    const body = JSON.parse(raw)
    const r = body["csp-report"] || (Array.isArray(body) ? body[0]?.body : body) || {}
    const directive = String(r["violated-directive"] || r.effectiveDirective || "?").slice(0, 60)
    const blockedUri = String(r["blocked-uri"] || r.blockedURL || "?").slice(0, 160)
    const doc = String(r["document-uri"] || r.documentURL || "").slice(0, 160)
    await logEvent({ type: "SECURITY", level: "info", message: `CSP: ${directive} ← ${blockedUri}`, meta: { directive, blockedUri, doc } })
  } catch {
    /* malformed reports are ignored */
  }
  return new NextResponse(null, { status: 204 })
}
