import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { applyFullBan, applyFullUnban } from "@/lib/ban-engine"

/**
 * POST /api/admin/users/[id]/ban
 * 
 * Admin kullanıcıyı banlar:
 * - Hesap soft-ban (banned=true)
 * - Kullanıcının tüm bilinen IP'leri otomatik banlanır
 * - Tüm aktif oturumlar düşürülür (session kill)
 * - Aktif booking'ler iptal edilir
 * - Audit log kaydı oluşturulur
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response

    const body = await req.json().catch(() => ({}))
    const reason = cleanReason(body.reason)
    if (reason.length < 3) {
      return NextResponse.json({ error: "Yasaklama nedeni gerekli (en az 3 karakter)." }, { status: 400 })
    }
    const { id } = await params

    // Admin kendini banlayamaz
    if (id === g.admin.id) {
      return NextResponse.json({ error: "Cannot ban yourself" }, { status: 400 })
    }

    // Hedef kullanıcıyı kontrol et
    const targetUser = await db.user.findUnique({
      where: { id }
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (targetUser.role === "ADMIN") {
      return NextResponse.json({ error: "Cannot ban another admin" }, { status: 403 })
    }

    if (targetUser.banned) {
      return NextResponse.json({ error: "User is already banned" }, { status: 409 })
    }

    // 🛡️ Full ban uygula (user ban + IP ban + session kill)
    const result = await applyFullBan(id, reason, g.admin.id)

    return NextResponse.json({ 
      success: true, 
      message: "User has been banned from the platform",
      details: {
        ipsBanned: result.ipsBanned,
        sessionsClosed: result.sessionsClosed,
      }
    })
  } catch (error: any) {
    console.error("[BAN_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[id]/ban
 * 
 * Admin kullanıcının banını kaldırır:
 * - banned=false
 * - İlişkili IP banları devre dışı bırakılır
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response

    const { id } = await params

    const targetUser = await db.user.findUnique({
      where: { id }
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!targetUser.banned) {
      return NextResponse.json({ error: "User is not banned" }, { status: 409 })
    }

    const result = await applyFullUnban(id, g.admin.id)

    return NextResponse.json({ 
      success: true, 
      message: "User has been unbanned",
      details: {
        ipsUnbanned: result.ipsUnbanned,
      }
    })
  } catch (error: any) {
    console.error("[UNBAN_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
