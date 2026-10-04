import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { banIpAddress, extractIp, isBannableIp } from "@/lib/ban-engine"
import { isIP } from "net"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/bans
 * 
 * Admin paneli: IP banları, evasion logları ve kullanıcı IP geçmişlerini listele
 * 
 * Query params:
 * - type: "ip-bans" | "evasion-logs" | "user-ips" | "stats"
 * - userId: (optional) belirli bir kullanıcının IP'lerini göster
 * - page: sayfa numarası (default: 1)
 */
export async function GET(req: Request) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response

    const url = new URL(req.url)
    const type = url.searchParams.get("type") || "stats"
    const userId = url.searchParams.get("userId")
    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = 50
    const skip = (page - 1) * limit

    switch (type) {
      case "ip-bans": {
        const [bans, total] = await Promise.all([
          db.ipBan.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          db.ipBan.count()
        ])
        return NextResponse.json({ bans, total, page })
      }

      case "evasion-logs": {
        const [logs, total] = await Promise.all([
          db.banEvasionLog.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          db.banEvasionLog.count()
        ])
        return NextResponse.json({ logs, total, page })
      }

      case "user-ips": {
        if (!userId) {
          return NextResponse.json({ error: "userId parameter required" }, { status: 400 })
        }
        const ipLogs = await db.userIpLog.findMany({
          where: { userId },
          orderBy: { lastSeenAt: "desc" },
        })
        return NextResponse.json({ ipLogs })
      }

      case "stats": {
        const [
          totalIpBans,
          activeIpBans,
          totalEvasionAttempts,
          recentEvasions,
          bannedUsers,
        ] = await Promise.all([
          db.ipBan.count(),
          db.ipBan.count({ where: { isActive: true } }),
          db.banEvasionLog.count(),
          db.banEvasionLog.count({
            where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
          }),
          db.user.count({ where: { banned: true } }),
        ])

        return NextResponse.json({
          totalIpBans,
          activeIpBans,
          totalEvasionAttempts,
          recentEvasions24h: recentEvasions,
          bannedUsers,
        })
      }

      default:
        return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
    }
  } catch (error: any) {
    console.error("[ADMIN_BANS_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/bans
 * 
 * Manuel IP ban ekleme
 * Body: { ipAddress: string, reason: string, expiresAt?: string }
 */
export async function POST(req: Request) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response

    const body = await req.json().catch(() => ({}))
    const ipAddress = typeof body.ipAddress === "string" ? body.ipAddress.trim() : ""
    const reason = cleanReason(body.reason)
    const expiresAt = body.expiresAt

    if (!ipAddress || reason.length < 3) {
      return NextResponse.json({ error: "IP adresi ve neden gerekli." }, { status: 400 })
    }
    if (!isIP(ipAddress)) {
      return NextResponse.json({ error: "Geçersiz IP adresi." }, { status: 400 })
    }
    if (!isBannableIp(ipAddress)) {
      return NextResponse.json({ error: "Yerel/özel ağ adresleri engellenemez (herkesi etkilerdi)." }, { status: 400 })
    }
    if (ipAddress === extractIp(req)) {
      return NextResponse.json({ error: "Kendi IP adresinizi engelleyemezsiniz." }, { status: 400 })
    }
    if (expiresAt && (isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() < Date.now())) {
      return NextResponse.json({ error: "Bitiş tarihi gelecekte olmalı." }, { status: 400 })
    }

    await banIpAddress(
      ipAddress,
      reason,
      undefined,
      g.admin.id,
      expiresAt ? new Date(expiresAt) : undefined
    )

    await db.auditLog.create({
      data: {
        actorId: g.admin.id,
        action: "MANUAL_IP_BAN",
        targetId: ipAddress,
        reason,
      }
    })

    return NextResponse.json({ success: true, message: `IP ${ipAddress} banned` })
  } catch (error: any) {
    console.error("[ADMIN_IP_BAN_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/bans
 * 
 * IP ban kaldırma
 * Body: { banId: string }
 */
export async function DELETE(req: Request) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response

    const { banId } = await req.json()

    if (!banId) {
      return NextResponse.json({ error: "banId is required" }, { status: 400 })
    }

    const ban = await db.ipBan.findUnique({ where: { id: banId } })
    if (!ban) {
      return NextResponse.json({ error: "Ban not found" }, { status: 404 })
    }

    await db.ipBan.update({
      where: { id: banId },
      data: { isActive: false }
    })

    await db.auditLog.create({
      data: {
        actorId: g.admin.id,
        action: "REMOVE_IP_BAN",
        targetId: ban.ipAddress,
        reason: `IP ban lifted for ${ban.ipAddress}`,
      }
    })

    return NextResponse.json({ success: true, message: `IP ban ${ban.ipAddress} removed` })
  } catch (error: any) {
    console.error("[ADMIN_IP_UNBAN_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
