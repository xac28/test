import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { ORDER_STATUS_LABEL, OrderStatusId } from "@/lib/shop"
import { ShopError, setOrderStatus } from "@/lib/shop-server"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const order = await db.order.findUnique({ where: { id: params.id }, include: { items: true } })
  return order ? NextResponse.json({ order }) : NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 })
}

// POST { status?, trackingNo?, adminNote? } — moves the order along its path and/or edits the notes
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const body = await req.json().catch(() => ({}))
  try {
    if (typeof body.status === "string") {
      if (!(body.status in ORDER_STATUS_LABEL)) return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 })
      const order = await setOrderStatus(params.id, body.status as OrderStatusId, {
        actorId: a.admin.id,
        trackingNo: typeof body.trackingNo === "string" ? body.trackingNo : undefined,
        adminNote: typeof body.adminNote === "string" ? body.adminNote : undefined,
        reason: cleanReason(body.reason, 120),
      })
      return NextResponse.json({ success: true, order })
    }
    const order = await db.order.update({
      where: { id: params.id },
      data: {
        ...(typeof body.adminNote === "string" ? { adminNote: cleanReason(body.adminNote, 300) || null } : {}),
        ...(typeof body.trackingNo === "string" ? { trackingNo: body.trackingNo.trim().slice(0, 60) || null } : {}),
      },
      include: { items: true },
    })
    return NextResponse.json({ success: true, order })
  } catch (e) {
    if (e instanceof ShopError) return NextResponse.json({ error: e.message }, { status: 409 })
    console.error("[ADMIN_ORDER]", e)
    return NextResponse.json({ error: "Sipariş güncellenemedi" }, { status: 500 })
  }
}
