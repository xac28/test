import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { authenticateDevice, currentRelease, mintSessionCookie } from "@/lib/streamer"
import { logEvent } from "@/lib/event-log"

export const dynamic = "force-dynamic"

const older = (a: string, b: string) => {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0), pb = b.split(".").map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0)
  return false
}

// POST /api/streamer/session (Bearer = device token) → the web session cookie for the app's window (12 h)
export async function POST(req: Request) {
  const ip = extractIp(req)
  const limit = rateLimit(`streamer-session:${ip}`, { maxRequests: 30, windowMs: 60_000 })
  if (!limit.allowed) return NextResponse.json({ error: "Çok fazla istek." }, { status: 429 })
  const a = await authenticateDevice(req)
  if ("error" in a) {
    if (a.status === 403) await logEvent({ type: "SECURITY", level: "warn", message: `Yayın uygulaması oturumu reddedildi: ${a.error}`, ip })
    return NextResponse.json({ error: a.error }, { status: a.status })
  }
  // builds older than the published minimum are cut off (a way to retire a version with a known problem)
  const release = await currentRelease()
  const version = req.headers.get("x-streamer-version") || ""
  if (release?.minVersion && (!version || older(version, release.minVersion))) {
    return NextResponse.json({ error: `Uygulamanın bu sürümü artık desteklenmiyor. ${release.minVersion} veya daha yenisini web sitesinden indir.`, code: "UPDATE_REQUIRED" }, { status: 426 })
  }
  const cookie = await mintSessionCookie(a.userId)
  await db.streamerDevice.update({ where: { id: a.device.id }, data: { lastUsedAt: new Date(), lastIp: ip.slice(0, 64), ...(version && /^[0-9A-Za-z.\-]{1,20}$/.test(version) ? { appVersion: version } : {}) } })
  return NextResponse.json({ cookie })
}
