import { NextResponse } from "next/server"
import path from "path"
import { createReadStream } from "fs"
import { Readable } from "stream"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import { currentRelease, DOWNLOAD_DIR, streamerEligibility } from "@/lib/streamer"
import { logEvent } from "@/lib/event-log"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// GET /api/streamer/download → the installer, for approved teachers only (the file lives outside public/, it has no static URL)
export async function GET(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const el = await streamerEligibility(user.id)
  if (!el.ok) {
    await logEvent({ type: "SECURITY", level: "warn", message: `Yayın uygulaması indirme reddedildi (${el.reason})`, userId: user.id, ip: extractIp(req) })
    return NextResponse.json({ error: el.message, code: el.reason }, { status: 403 })
  }
  const r = await currentRelease()
  if (!r) return NextResponse.json({ error: "Kurulum dosyası henüz yüklenmemiş. Yöneticiyle iletişime geç.", code: "NOT_AVAILABLE" }, { status: 404 })
  await logEvent({ type: "SECURITY", message: `Yayın uygulaması indirildi (${r.version})`, userId: user.id, ip: extractIp(req) })
  const stream = Readable.toWeb(createReadStream(path.join(DOWNLOAD_DIR, r.file))) as unknown as ReadableStream
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(r.size),
      "Content-Disposition": `attachment; filename="${r.file.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
