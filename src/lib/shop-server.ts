import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { SITE_URL } from "@/lib/site"
import { notifyRestock } from "@/lib/automation"
import {
  LOW_STOCK, ORDER_STATUS_LABEL, OrderStatusId, PAY_METHOD_LABEL, UNPAID_ORDER_DAYS,
  calcTotals, canTransition, formatKurus, makeOrderCode, nextStatuses,
} from "@/lib/shop"

/** An error whose message is safe to show to the customer. */
export class ShopError extends Error {}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string))
const frame = (inner: string) => `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0c2a4a"><h2 style="letter-spacing:.28em;font-weight:500">AYA</h2>${inner}</div>`

interface OrderWithItems {
  id: string; code: string; email: string; name: string; phone: string; address: string; city: string; note: string | null
  payMethod: string; status: string; subtotalKurus: number; shippingKurus: number; totalKurus: number; trackingNo: string | null
  items: { name: string; unitKurus: number; quantity: number }[]
}

const itemsTable = (o: OrderWithItems) =>
  `<table style="width:100%;border-collapse:collapse;font-size:14px">${o.items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #d4e3f3">${esc(i.name)} × ${i.quantity}</td><td style="padding:6px 0;border-bottom:1px solid #d4e3f3;text-align:right">${formatKurus(i.unitKurus * i.quantity)}</td></tr>`).join("")}
<tr><td style="padding:6px 0">Kargo</td><td style="text-align:right">${o.shippingKurus ? formatKurus(o.shippingKurus) : "Ücretsiz"}</td></tr>
<tr><td style="padding:6px 0"><strong>Toplam</strong></td><td style="text-align:right"><strong>${formatKurus(o.totalKurus)}</strong></td></tr></table>`

export const orderUrl = (o: { code: string }) => `${SITE_URL}/shop/siparis/${o.code}`

async function mailCustomer(o: OrderWithItems, subject: string, lead: string) {
  const bank = o.payMethod === "havale" && o.status === "PENDING_PAYMENT"
    ? `<p style="background:#eef5fe;padding:14px;border-radius:12px;font-size:14px"><strong>Ödeme bilgileri</strong><br>${process.env.SHOP_ACCOUNT_NAME ? `Hesap sahibi: ${esc(process.env.SHOP_ACCOUNT_NAME)}<br>` : ""}${process.env.SHOP_IBAN ? `IBAN: ${esc(process.env.SHOP_IBAN)}<br>` : "IBAN bilgisi ayrıca e-postayla iletilecektir.<br>"}Açıklama: <strong>${esc(o.code)}</strong><br>${UNPAID_ORDER_DAYS} gün içinde ödenmeyen siparişler iptal edilir.</p>`
    : ""
  const track = o.trackingNo ? `<p>Kargo takip no: <strong>${esc(o.trackingNo)}</strong></p>` : ""
  return sendEmail({
    to: o.email,
    subject,
    html: frame(`<p>Merhaba ${esc(o.name)},</p><p>${lead}</p><p>Sipariş no: <strong>${esc(o.code)}</strong></p>${itemsTable(o)}${bank}${track}<p><a href="${orderUrl(o)}" style="color:#1f62bf">Siparişimi görüntüle</a></p>`),
  })
}

async function mailAdmin(subject: string, html: string) {
  const to = process.env.ADMIN_EMAIL
  if (to) await sendEmail({ to, subject, html: frame(html) })
}

export interface CreateOrderData {
  name: string; email: string; phone: string; address: string; city: string; note: string | null
  payMethod: "havale" | "kapida"; items: { productId: string; quantity: number }[]
}

/** Reserves the stock and writes the order in one transaction; nothing is kept when any line is out of stock. */
export async function createOrder(data: CreateOrderData, userId: string | null) {
  const order = await db.$transaction(async (tx) => {
    const ids = data.items.map((i) => i.productId)
    const products = await tx.product.findMany({ where: { id: { in: ids }, status: "PUBLISHED" } })
    if (products.length !== ids.length) throw new ShopError("Sepetteki bir ürün artık satışta değil. Sepeti güncelleyin.")
    const byId = new Map(products.map((p) => [p.id, p]))
    const lines = data.items.map((i) => ({ p: byId.get(i.productId)!, quantity: i.quantity }))
    for (const l of lines) {
      const res = await tx.product.updateMany({ where: { id: l.p.id, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } })
      if (res.count === 0) throw new ShopError(`“${l.p.name}” için yeterli stok yok.`)
    }
    const totals = calcTotals(lines.map((l) => ({ unitKurus: l.p.priceKurus, quantity: l.quantity })))
    for (let attempt = 0; ; attempt++) {
      try {
        return await tx.order.create({
          data: {
            code: makeOrderCode(), userId, email: data.email, name: data.name, phone: data.phone, address: data.address, city: data.city, note: data.note,
            payMethod: data.payMethod, subtotalKurus: totals.subtotal, shippingKurus: totals.shipping, totalKurus: totals.total,
            items: { create: lines.map((l) => ({ productId: l.p.id, name: l.p.name, unitKurus: l.p.priceKurus, quantity: l.quantity })) },
          },
          include: { items: true },
        })
      } catch (e: any) {
        if (e?.code !== "P2002" || attempt >= 4) throw e // only a code clash is worth retrying
      }
    }
  })

  await mailCustomer(order, `AYA siparişiniz alındı (${order.code})`, "Siparişinizi aldık, teşekkürler.")
  await mailAdmin(`Yeni sipariş ${order.code}`, `<p><strong>${esc(order.name)}</strong> (${esc(order.email)}) yeni bir sipariş verdi.</p>${itemsTable(order)}<p>Ödeme: ${PAY_METHOD_LABEL[order.payMethod]}<br><a href="${SITE_URL}/admin?tab=orders">Siparişlere git</a></p>`)
  const low = await db.product.findMany({ where: { id: { in: order.items.map((i) => i.productId!).filter(Boolean) }, stock: { lte: LOW_STOCK } }, select: { name: true, stock: true } })
  if (low.length) await mailAdmin("Stok azalıyor", `<p>Şu ürünlerde stok azaldı:</p><ul>${low.map((p) => `<li>${esc(p.name)}: ${p.stock} adet</li>`).join("")}</ul>`)
  return order
}

const STATUS_MAIL: Partial<Record<OrderStatusId, [string, string]>> = {
  PAID: ["Ödemeniz alındı", "Ödemenizi aldık; siparişiniz hazırlanıyor."],
  SHIPPED: ["Siparişiniz kargoya verildi", "Siparişiniz kargoya verildi."],
  DELIVERED: ["Siparişiniz teslim edildi", "Siparişiniz teslim edildi. Keyifle kullanın!"],
  CANCELLED: ["Siparişiniz iptal edildi", "Siparişiniz iptal edildi. Bir sorunuz varsa bu e-postayı yanıtlayabilirsiniz."],
}

/** Moves an order along its allowed path; cancelling puts the stock back exactly once. */
export async function setOrderStatus(orderId: string, to: OrderStatusId, opts: { actorId?: string | null; trackingNo?: string; adminNote?: string; reason?: string } = {}) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } })
  if (!order) throw new ShopError("Sipariş bulunamadı.")
  const from = order.status as OrderStatusId
  if (!canTransition(from, to, order.payMethod)) {
    throw new ShopError(`Bu sipariş “${ORDER_STATUS_LABEL[from]}” durumundan “${ORDER_STATUS_LABEL[to]}” durumuna geçirilemez.`)
  }
  const trackingNo = opts.trackingNo?.trim().slice(0, 60)
  if (to === "SHIPPED" && !trackingNo && !order.trackingNo) throw new ShopError("Kargoya verirken takip numarası girin.")

  const backInStock: string[] = []
  const updated = await db.$transaction(async (tx) => {
    if (to === "CANCELLED" && !order.stockRestored) {
      for (const i of order.items) {
        if (!i.productId) continue
        const before = await tx.product.findUnique({ where: { id: i.productId }, select: { stock: true } })
        await tx.product.updateMany({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } })
        if (before && before.stock <= 0) backInStock.push(i.productId)
      }
    }
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        ...(to === "CANCELLED" ? { stockRestored: true } : {}),
        ...(trackingNo ? { trackingNo } : {}),
        ...(opts.adminNote !== undefined ? { adminNote: opts.adminNote.trim().slice(0, 300) || null } : {}),
      },
      include: { items: true },
    })
  })
  if (opts.actorId) {
    await db.auditLog.create({ data: { actorId: opts.actorId, action: `ORDER_${to}`, targetId: order.id, reason: `${order.code}${opts.reason ? `: ${opts.reason}` : ""}`.slice(0, 300) } })
  }
  if (backInStock.length) await notifyRestock(backInStock).catch((e) => console.error("[RESTOCK]", e))
  const m = STATUS_MAIL[to]
  if (m) await mailCustomer(updated, `${m[0]} (${updated.code})`, m[1])
  return updated
}

/** Cron job: cancels bank-transfer orders nobody paid for, which releases their stock. */
export async function cancelStaleOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - UNPAID_ORDER_DAYS * 86_400_000)
  const stale = await db.order.findMany({ where: { status: "PENDING_PAYMENT", payMethod: "havale", createdAt: { lte: cutoff } }, select: { id: true } })
  let cancelled = 0
  for (const o of stale) {
    try {
      await setOrderStatus(o.id, "CANCELLED", { reason: "Süresinde ödenmedi" })
      cancelled++
    } catch (e) {
      console.error("[SHOP_CRON] cancel failed", o.id, e)
    }
  }
  return { cancelled, checked: stale.length }
}

export { nextStatuses }
