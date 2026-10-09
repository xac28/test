import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"
import { nextPayoutStatus, PAYOUT_STATUS_LABEL_TR } from "@/lib/payouts"

// PATCH /api/admin/payouts/:id  { action: "approve" | "reject" | "mark_paid", note? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await resolveUser(req)
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { action, note } = await req.json().catch(() => ({}))
    const payout = await db.payoutRequest.findUnique({
      where: { id: params.id },
      include: { teacher: { include: { user: true } } },
    })
    if (!payout) return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 })

    const next = nextPayoutStatus(payout.status, action)
    if (!next) {
      return NextResponse.json(
        { error: `Bu talep "${PAYOUT_STATUS_LABEL_TR[payout.status] ?? payout.status}" durumunda; bu işlem yapılamaz.` },
        { status: 409 }
      )
    }
    if (next === "REJECTED" && (!note || !String(note).trim())) {
      return NextResponse.json({ error: "Reddetme sebebi gerekli." }, { status: 400 })
    }

    // Conditional update: two admins clicking at once cannot both apply a transition
    const updated = await db.payoutRequest.updateMany({
      where: { id: payout.id, status: payout.status },
      data: {
        status: next,
        adminNote: note ? String(note).slice(0, 500) : payout.adminNote,
        reviewerId: admin.id,
        reviewedAt: new Date(),
        ...(next === "PAID" ? { paidAt: new Date() } : {}),
      },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: "Talep başka bir yönetici tarafından güncellendi." }, { status: 409 })
    }

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: `PAYOUT_${action.toUpperCase()}`,
        targetId: payout.id,
        reason: `${payout.amount} ${payout.currency} → ${PAYOUT_STATUS_LABEL_TR[next]}${note ? `: ${note}` : ""}`,
      },
    })

    if (payout.teacher.user.email) {
      sendEmail({
        to: payout.teacher.user.email,
        subject: `AYA ödeme talebiniz: ${PAYOUT_STATUS_LABEL_TR[next]}`,
        html: `<p>Merhaba ${payout.teacher.user.name ?? ""},</p><p>${payout.amount.toFixed(2)} ${payout.currency} tutarındaki ödeme talebiniz <b>${PAYOUT_STATUS_LABEL_TR[next]}</b>.</p>${note ? `<p>Not: ${String(note).replace(/</g, "&lt;")}</p>` : ""}`,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, status: next })
  } catch (error) {
    console.error("[ADMIN_PAYOUT_PATCH_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
