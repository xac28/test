import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { authenticateDevice, currentRelease } from "@/lib/streamer"

export const dynamic = "force-dynamic"

// GET /api/streamer/me (Bearer = the app's device token) → who the app is signed in as, and the current release
export async function GET(req: Request) {
  const ip = extractIp(req)
  const limit = rateLimit(`streamer-me:${ip}`, { maxRequests: 60, windowMs: 60_000 })
  if (!limit.allowed) return NextResponse.json({ error: "Çok fazla istek." }, { status: 429 })
  const a = await authenticateDevice(req)
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const [user, release] = await Promise.all([db.user.findUnique({ where: { id: a.userId }, select: { name: true, email: true } }), currentRelease()])
  await db.streamerDevice.update({ where: { id: a.device.id }, data: { lastUsedAt: new Date(), lastIp: ip.slice(0, 64) } })
  return NextResponse.json({ user, device: { name: a.device.name, expiresAt: a.device.expiresAt }, release: release ? { version: release.version, minVersion: release.minVersion ?? null } : null })
}
