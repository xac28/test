/**
 * 🛡️ Intrusion detection — runs on every request in proxy.ts (Next.js Proxy runs on the
 * Node.js runtime by default in this version, so a direct Prisma call here is fine).
 *
 * Two independent jobs:
 *  1. recordVisit()   — upserts one row per distinct IP (VisitorIpLog), so the admin panel
 *                        can see who is visiting the site, logged in or not.
 *  2. scanForAttack() — matches the request path/query against known exploit-scanner and
 *                        injection signatures. A few hits from the same IP in a short window
 *                        auto-bans it through the existing ban engine (lib/ban-engine.ts),
 *                        which is already enforced on every request by proxy.ts.
 *
 * Both are called fire-and-forget (not awaited) from proxy.ts so they never add latency to a
 * real visitor's response — same pattern as logUserIp() elsewhere in this codebase.
 */

import { db } from "@/lib/db"
import { banIpAddress, isBannableIp } from "@/lib/ban-engine"
import { logEvent } from "@/lib/event-log"

// ── Visitor logging ─────────────────────────────────────────────────────────

// A page view fires this once per request — HTML, every API call it makes, every asset — so a single
// visit can mean a dozen calls in under a second. Writing every one of them would load the DB for no
// benefit (the admin panel only needs "last seen" accurate to a few seconds), so each IP is written at
// most once per window; everything in between is a no-op, not even a query.
const VISIT_WRITE_THROTTLE_MS = 5_000
const lastWritten = new Map<string, number>()

setInterval(() => {
  const cutoff = Date.now() - VISIT_WRITE_THROTTLE_MS
  for (const [ip, t] of lastWritten) if (t < cutoff) lastWritten.delete(ip)
}, 30_000).unref?.()

/** One row per IP (upsert), so this table stays small no matter how much traffic the site gets. */
export async function recordVisit(ip: string, path: string, userAgent: string | null): Promise<void> {
  if (!ip || ip === "unknown") return
  const now = Date.now()
  const last = lastWritten.get(ip)
  if (last && now - last < VISIT_WRITE_THROTTLE_MS) return
  lastWritten.set(ip, now)
  const write = () =>
    db.visitorIpLog.upsert({
      where: { ipAddress: ip },
      update: { lastSeenAt: new Date(), hitCount: { increment: 1 }, lastPath: path.slice(0, 300), userAgent: userAgent || undefined },
      create: { ipAddress: ip, lastPath: path.slice(0, 300), userAgent: userAgent || null },
    })
  try {
    await write()
  } catch {
    // Two requests from the same IP landing in the same instant can race on this row (the browser
    // firing several assets at once). One retry clears it without spamming the error log.
    try {
      await write()
    } catch (error) {
      console.error("[INTRUSION] visit log error:", error)
    }
  }
}

// ── Attack signatures ───────────────────────────────────────────────────────

/** Paths this app never serves — requested only by exploit scanners and recon bots. */
const ATTACK_PATH_PATTERNS: RegExp[] = [
  /\.env(\.|$|\?)/i,
  /\.git\//i,
  /\.(aws|ssh|docker)\//i,
  /wp-(login|admin|content|includes|json)/i,
  /xmlrpc\.php/i,
  /phpmyadmin|pma\//i,
  /\.(php\d?|asp|aspx|jsp|jspx|cgi)($|\?)/i,
  /config\.(json|ya?ml|php|bak|old)$/i,
  /vendor\/phpunit/i,
  /actuator(\/|$)/i,
  /server-status/i,
  /etc\/passwd/i,
  /\betc%2fpasswd\b/i,
  /boaform|shell\?|cmd=|;%20cat%20/i,
  /\/(console|solr|jenkins|elmah\.axd)(\/|$)/i,
]

/** Classic SQL-injection / XSS / traversal payloads carried in the path or query string. */
const PAYLOAD_PATTERNS: RegExp[] = [
  /union(\s|%20|\+)+select/i,
  /<script[\s>]/i,
  /javascript:/i,
  /['"]\s*or\s*['"]?\s*1\s*=\s*1/i,
  /select\b.{1,60}\bfrom\b.{1,40}\bwhere\b/i,
  /%00/,
  /\.\.(%2f|%5c|\/|\\){2,}/i,
]

export type AttackKind = "PATH_SCAN" | "INJECTION"

function classify(pathAndQuery: string): AttackKind | null {
  if (ATTACK_PATH_PATTERNS.some((r) => r.test(pathAndQuery))) return "PATH_SCAN"
  if (PAYLOAD_PATTERNS.some((r) => r.test(pathAndQuery))) return "INJECTION"
  return null
}

// ── Auto-ban: N hits from the same IP inside the window ────────────────────

const WINDOW_MS = 10 * 60_000
const BAN_THRESHOLD = 5

const recentHits = new Map<string, number[]>()

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS
  for (const [ip, hits] of recentHits) if (!hits.length || hits[hits.length - 1] < cutoff) recentHits.delete(ip)
}, 60_000).unref?.()

/** Call with the raw pathname + search of every request. No-op unless it matches an attack signature. */
export async function scanForAttack(ip: string, pathname: string, search: string, userAgent: string | null): Promise<void> {
  const kind = classify(pathname + (search || ""))
  if (!kind) return

  const path = (pathname + (search || "")).slice(0, 300)
  try {
    await db.attackLog.create({ data: { ipAddress: ip, kind, path, userAgent: userAgent || null } })
  } catch (error) {
    console.error("[INTRUSION] attack log error:", error)
  }
  logEvent({ type: "SECURITY", level: "warn", message: `Saldırı paterni tespit edildi (${kind}): ${path}`, ip })

  if (!isBannableIp(ip)) return // never auto-ban loopback/private/shared ranges

  const cutoff = Date.now() - WINDOW_MS
  const hits = (recentHits.get(ip) || []).filter((t) => t > cutoff)
  hits.push(Date.now())
  recentHits.set(ip, hits)

  if (hits.length >= BAN_THRESHOLD) {
    recentHits.delete(ip)
    await banIpAddress(ip, `Otomatik: ${hits.length} saldırı paterni tespit edildi (son: ${kind} — ${path})`)
    try {
      await db.attackLog.updateMany({ where: { ipAddress: ip, autoBanned: false }, data: { autoBanned: true } })
    } catch {}
    logEvent({ type: "SECURITY", level: "warn", message: `Otomatik IP banı: ${ip} (saldırı paterni eşiği aşıldı)`, ip })
    console.log(`[INTRUSION] 🚨 auto-banned ${ip} after ${hits.length} attack hits`)
  }
}
