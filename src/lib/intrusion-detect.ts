/**
 * 🛡️ Intrusion detection — runs on every request in proxy.ts (Next.js Proxy runs on the
 * Node.js runtime by default in this version, so a direct Prisma call here is fine).
 *
 * Three independent jobs:
 *  1. recordVisit()   — upserts one row per distinct IP (VisitorIpLog), so the admin panel
 *                        can see who is visiting the site, logged in or not.
 *  2. scanForAttack() — matches the request path/query/user-agent against known exploit-scanner,
 *                        injection and automated-tool signatures, and watches for one IP probing
 *                        an abnormal spread of distinct API shapes in a short window (endpoint
 *                        enumeration — dirb/ffuf/gobuster/Burp Intruder style traffic, or someone
 *                        "listening in" on the API and poking at it by hand). A few hits from the
 *                        same IP auto-ban it through the existing ban engine (lib/ban-engine.ts),
 *                        which is already enforced on every request by proxy.ts.
 *
 * Both are called fire-and-forget (not awaited) from proxy.ts so they never add latency to a
 * real visitor's response — same pattern as logUserIp() elsewhere in this codebase.
 *
 * Deliberately NOT built: a "ban visitors whose browser devtools are open" signal. A real browser's
 * Network/Elements panel is visible only to that visitor — the server never sees it, so the only way
 * to detect it is a client-side script the visitor's own browser runs, and anyone actually trying to
 * tamper with the site would simply not run it, or would patch it out, while every curious customer,
 * QA tester, bug-reporter and the site's own admins would get banned for pressing F12. The signatures
 * below catch the same intent — someone probing the site with tools, from outside — using only things
 * the server itself observes, which cannot be switched off from the browser.
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

/**
 * User-Agent strings sent, by default, by automated scanners, vulnerability tools and exploitation
 * frameworks — never by a browser or a phone app, unless the operator deliberately fakes one (and at
 * that point they are indistinguishable from a real visitor, which is true of any such list).
 * This is a request-side signal, unlike devtools detection: it needs no client-side script, it applies
 * to every request including ones that never render a page, and it cannot be toggled off from inside
 * the browser without already impersonating an ordinary one, which defeats the point of a scan.
 * Deliberately narrow: only tool names with no legitimate reason to ever call this app (no uptime
 * monitor, health-check script, webhook sender or generic HTTP client is named "sqlmap"). Generic
 * library user-agents (curl, python-requests, go-http-client, ...) are left out on purpose — half the
 * internet's legitimate automation uses them, so matching those would ban real integrations and
 * monitoring tools, not attackers.
 */
const SCANNER_UA_PATTERNS: RegExp[] = [
  /sqlmap/i, /\bnikto\b/i, /\bnessus\b/i, /openvas/i, /acunetix/i, /netsparker/i, /\bnuclei\b/i,
  /\bnmap\b/i, /masscan/i, /\bzgrab\b/i, /\bzmap\b/i, /\bw3af\b/i, /skipfish/i, /arachni/i,
  /dirbuster/i, /\bgobuster\b/i, /\bffuf\b/i, /\bwfuzz\b/i, /feroxbuster/i, /\bdirsearch\b/i,
  /wpscan/i, /joomscan/i, /\bhydra\b/i, /metasploit/i, /burpcollaborator/i, /\bbrutex\b/i,
]

export type AttackKind = "PATH_SCAN" | "INJECTION" | "SCANNER_UA" | "API_ENUM"

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s // malformed %-sequence: keep the raw text rather than throwing
  }
}

/**
 * `req.nextUrl.search` carries the query percent-encoded, and Next.js represents a literal space in it as
 * `+` (form-encoding convention) rather than `%20` — so a payload like `' OR 1=1` can arrive as
 * `%27+OR+1%3D1`, which `decodeURIComponent` alone leaves as `'+OR+1=1` (it does not treat `+` as space;
 * that rule is specific to form-encoded bodies, not query percent-decoding). None of the raw
 * PAYLOAD_PATTERNS above, which expect real whitespace, would match either form. Folding `+` to a space
 * as well, and decoding once more (to also catch a double-encoded `%2527` evasion), and checking every
 * resulting form alongside the original closes that gap without weakening the original checks.
 */
function decodedVariants(raw: string): string[] {
  const variants = new Set<string>([raw])
  const once = safeDecode(raw)
  variants.add(once)
  if (once !== raw) variants.add(safeDecode(once))
  const spaced = raw.replace(/\+/g, " ")
  variants.add(spaced)
  variants.add(safeDecode(spaced))
  return [...variants]
}

function classify(pathAndQuery: string, userAgent: string | null): AttackKind | null {
  const variants = decodedVariants(pathAndQuery)
  if (variants.some((v) => ATTACK_PATH_PATTERNS.some((r) => r.test(v)))) return "PATH_SCAN"
  if (variants.some((v) => PAYLOAD_PATTERNS.some((r) => r.test(v)))) return "INJECTION"
  if (userAgent && SCANNER_UA_PATTERNS.some((r) => r.test(userAgent))) return "SCANNER_UA"
  return null
}

// ── Endpoint-enumeration detector ───────────────────────────────────────────
//
// Someone fuzzing the API (Burp Intruder, ffuf, a hand-written script listening in on traffic and
// replaying it against many endpoints, ...) hits a wide spread of DISTINCT api routes in a short burst.
// An ordinary visitor's browser never does this: loading every kind of page this site has only ever
// touches a handful of distinct /api/* shapes (checked against the real app — the busiest page load
// fires 3). IDs in the path are folded away first, so browsing ten different teacher profiles, ten
// different ids but one route shape, never counts as ten distinct endpoints.
const ENUM_WINDOW_MS = 60_000
const ENUM_DISTINCT_THRESHOLD = 30
const seenShapesByIp = new Map<string, { shapes: Set<string>; windowStart: number }>()

setInterval(() => {
  const cutoff = Date.now() - ENUM_WINDOW_MS
  for (const [ip, e] of seenShapesByIp) if (e.windowStart < cutoff) seenShapesByIp.delete(ip)
}, 60_000).unref?.()

/** "/api/teachers/ckx1yz.../reviews?x=1" → "/api/teachers/:id/reviews" */
export function pathShape(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id") // uuid
    .replace(/\/c[a-z0-9]{20,}/gi, "/:id") // cuid
    .replace(/\/[0-9]+(?=\/|$)/g, "/:id") // numeric id
    .replace(/\/[A-Za-z0-9]{16,}(?=\/|$)/g, "/:id") // any other long opaque id (e.g. a Mongo-style hex id); 16+ chars with
    // no hyphen/underscore so it never folds a real kebab-case route word (the longest in this app is 13 chars)
}

/** True the moment this IP's distinct-API-shape count in the current window crosses the enumeration threshold. */
function trackEnumeration(ip: string, pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false
  const now = Date.now()
  let entry = seenShapesByIp.get(ip)
  if (!entry || now - entry.windowStart > ENUM_WINDOW_MS) {
    entry = { shapes: new Set(), windowStart: now }
    seenShapesByIp.set(ip, entry)
  }
  entry.shapes.add(pathShape(pathname))
  if (entry.shapes.size < ENUM_DISTINCT_THRESHOLD) return false
  seenShapesByIp.delete(ip) // one report per burst
  return true
}

// ── Auto-ban: N hits from the same IP inside the window ────────────────────

const WINDOW_MS = 10 * 60_000
const BAN_THRESHOLD = 5

const recentHits = new Map<string, number[]>()

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS
  for (const [ip, hits] of recentHits) if (!hits.length || hits[hits.length - 1] < cutoff) recentHits.delete(ip)
}, 60_000).unref?.()

async function recordAttack(ip: string, kind: AttackKind, path: string, userAgent: string | null): Promise<void> {
  try {
    await db.attackLog.create({ data: { ipAddress: ip, kind, path, userAgent: userAgent || null } })
  } catch (error) {
    console.error("[INTRUSION] attack log error:", error)
  }
  logEvent({ type: "SECURITY", level: "warn", message: `Saldırı paterni tespit edildi (${kind}): ${path}`, ip })
}

async function ban(ip: string, reason: string): Promise<void> {
  await banIpAddress(ip, reason)
  try {
    await db.attackLog.updateMany({ where: { ipAddress: ip, autoBanned: false }, data: { autoBanned: true } })
  } catch {}
  logEvent({ type: "SECURITY", level: "warn", message: `Otomatik IP banı: ${ip} (${reason})`, ip })
  console.log(`[INTRUSION] 🚨 auto-banned ${ip}: ${reason}`)
}

/** Call with the raw pathname + search of every request. No-op unless it matches an attack signature. */
export async function scanForAttack(ip: string, pathname: string, search: string, userAgent: string | null): Promise<void> {
  // Endpoint enumeration is its own signal (checked for every /api/ request, not only ones that also
  // match a signature below), because the paths involved otherwise look perfectly ordinary one at a time.
  const enumerating = isBannableIp(ip) && trackEnumeration(ip, pathname)

  const kind = classify(pathname + (search || ""), userAgent)
  const path = (pathname + (search || "")).slice(0, 300)

  if (kind) await recordAttack(ip, kind, path, userAgent)
  if (enumerating) await recordAttack(ip, "API_ENUM", `${ENUM_DISTINCT_THRESHOLD}+ distinct endpoints within ${ENUM_WINDOW_MS / 1000}s`, userAgent)

  if (!isBannableIp(ip)) return // never auto-ban loopback/private/shared ranges

  // Crossing the enumeration threshold is itself overwhelming evidence (it already took many
  // distinct, otherwise-unremarkable requests to get there) — ban at once rather than waiting for repeats.
  if (enumerating) {
    await ban(ip, `Otomatik: kısa sürede ${ENUM_DISTINCT_THRESHOLD}+ farklı API uç noktası denendi (tarama/fuzzing aracı davranışı)`)
    return
  }
  if (!kind) return

  const cutoff = Date.now() - WINDOW_MS
  const hits = (recentHits.get(ip) || []).filter((t) => t > cutoff)
  hits.push(Date.now())
  recentHits.set(ip, hits)

  if (hits.length >= BAN_THRESHOLD) {
    recentHits.delete(ip)
    await ban(ip, `Otomatik: ${hits.length} saldırı paterni tespit edildi (son: ${kind} — ${path})`)
  }
}
