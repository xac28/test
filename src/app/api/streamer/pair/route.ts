import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { DEVICE_TTL_MS, hashSecret, MAX_DEVICES, newDeviceToken, normalizePairCode, streamerEligibility } from "@/lib/streamer"
import { logEvent } from "@/lib/event-log"

export const dynamic = "force-dynamic"

// POST /api/streamer/pair { code, deviceName, appVersion } → { token, expiresAt, user }
// Called by the desktop app (no session yet). Strictly rate-limited: a code is only worth guessing for ten minutes.
export async function POST(req: Request) {
  const ip = extractIp(req)
  const limit = rateLimit(`streamer-pair:${ip}`, { maxRequests: 8, windowMs: 60_000 })
  if (!limit.allowed) return NextResponse.json({ error: "Çok fazla deneme. Biraz bekleyip tekrar dene.", retryAfterMs: limit.retryAfterMs }, { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } })

  const body = await req.json().catch(() => ({}))
  const code = normalizePairCode(body.code)
  const deviceName = (typeof body.deviceName === "string" ? body.deviceName : "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80) || "Windows bilgisayarı"
  const appVersion = typeof body.appVersion === "string" && /^[0-9A-Za-z.\-]{1,20}$/.test(body.appVersion) ? body.appVersion : null
  const invalid = () => NextResponse.json({ error: "Kod geçersiz ya da süresi dolmuş. Web sitesindeki Yayın uygulaması sayfasından yeni bir kod al.", code: "CODE_INVALID" }, { status: 400 })
  if (!code) return invalid()

  const pairing = await db.streamerPairing.findUnique({ where: { codeHash: hashSecret(code) } })
  if (!pairing || pairing.usedAt || pairing.expiresAt <= new Date()) {
    await logEvent({ type: "SECURITY", level: "warn", message: "Yayın uygulaması eşleştirme: geçersiz kod denendi", ip })
    return invalid()
  }
  // claim the code first: two requests with the same code must not both win
  const claimed = await db.streamerPairing.updateMany({ where: { id: pairing.id, usedAt: null }, data: { usedAt: new Date() } })
  if (claimed.count !== 1) return invalid()

  const el = await streamerEligibility(pairing.userId)
  if (!el.ok) {
    await logEvent({ type: "SECURITY", level: "warn", message: `Yayın uygulaması eşleştirme reddedildi (${el.reason})`, userId: pairing.userId, ip })
    return NextResponse.json({ error: el.message, code: el.reason }, { status: 403 })
  }
  const active = await db.streamerDevice.count({ where: { userId: pairing.userId, revokedAt: null, expiresAt: { gt: new Date() } } })
  if (active >= MAX_DEVICES) return NextResponse.json({ error: `Bu hesapta en fazla ${MAX_DEVICES} cihaz bağlı olabilir.`, code: "TOO_MANY_DEVICES" }, { status: 409 })

  const token = newDeviceToken()
  const expiresAt = new Date(Date.now() + DEVICE_TTL_MS)
  const device = await db.streamerDevice.create({ data: { userId: pairing.userId, tokenHash: hashSecret(token), name: deviceName, appVersion, expiresAt, lastIp: ip.slice(0, 64) } })
  const user = await db.user.findUnique({ where: { id: pairing.userId }, select: { name: true } })
  await logEvent({ type: "SECURITY", message: `Yayın uygulaması eşleştirildi: ${deviceName}`, userId: pairing.userId, ip, meta: { deviceId: device.id } })
  return NextResponse.json({ token, expiresAt, user: { name: user?.name ?? null } })
}
