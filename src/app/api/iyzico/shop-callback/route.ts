import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { SITE_URL } from "@/lib/site"
import { sendEmail } from "@/lib/email"
import { logEvent } from "@/lib/event-log"
import { retrieveShopCheckout } from "@/lib/iyzico"
import { setOrderStatus } from "@/lib/shop-server"

export const dynamic = "force-dynamic"

const back = (code: string | null, result: "ok" | "hata" | "iptal") =>
  NextResponse.redirect(code ? `${SITE_URL}/shop/siparis/${code}?odeme=${result}` : `${SITE_URL}/shop`, 303)

/**
 * The payment provider sends the customer back here with a token. We ask the provider what happened (never trusting the browser),
 * compare code and amount with our order, and only then mark it paid. A payment that arrives after the order was cancelled
 * (the customer took too long) is reported to the admins, because the money has to be returned.
 */
export async function POST(req: Request) {
  let code: string | null = null
  try {
    const form = await req.formData()
    const token = String(form.get("token") ?? "")
    if (!token) return back(null, "hata")
    const r = await retrieveShopCheckout(token)
    code = r.code
    if (!code) return back(null, "hata")
    const o = await db.order.findUnique({ where: { code } })
    if (!o || o.payMethod !== "kart") return back(null, "hata")
    if (!r.ok) return back(code, "hata")
    if (r.paidKurus !== o.totalKurus) {
      logEvent({ type: "PAYMENT", level: "error", message: `Kart ödemesi tutarı uyuşmuyor: ${o.code} beklenen ${o.totalKurus} alınan ${r.paidKurus} (${r.paymentId})` })
      if (process.env.ADMIN_EMAIL) await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `AYA Shop: ${o.code} ödeme tutarı uyuşmuyor`, html: `<p>${o.code} için alınan tutar (${r.paidKurus / 100} TL) sipariş tutarıyla (${o.totalKurus / 100} TL) aynı değil. Ödeme referansı: ${r.paymentId}. Sipariş onaylanmadı; lütfen kontrol edin.</p>` })
      return back(code, "hata")
    }
    if (o.status === "PENDING_PAYMENT") {
      // claim first: two callbacks for the same payment mark it paid once
      const claimed = await db.order.updateMany({ where: { id: o.id, status: "PENDING_PAYMENT" }, data: { paymentRef: (r.paymentId ?? "").slice(0, 80) || null } })
      if (claimed.count === 1) await setOrderStatus(o.id, "PAID", { reason: `Kart ödemesi ${r.paymentId ?? ""}`.trim() }).catch((e) => console.error("[SHOP_CALLBACK] status", e))
      return back(code, "ok")
    }
    if (o.status === "CANCELLED") {
      await db.order.update({ where: { id: o.id }, data: { paymentRef: (r.paymentId ?? "").slice(0, 80) || null, adminNote: "ÖDEME ALINDI ama sipariş iptal edilmişti: iade gerekli" } })
      logEvent({ type: "PAYMENT", level: "error", message: `Kart ödemesi iptal edilmiş siparişe geldi: ${o.code} (${r.paymentId}) — iade gerekli` })
      if (process.env.ADMIN_EMAIL) await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `AYA Shop: ${o.code} iptal edilmiş, ama ödeme alındı`, html: `<p>${o.code} siparişi süresinde ödenmediği için iptal edilmişti, fakat ödeme sonradan alındı (${r.paidKurus / 100} TL, referans ${r.paymentId}). Tutarı müşteriye iade edin ya da siparişi yeniden açın.</p>` })
      return back(code, "iptal")
    }
    return back(code, "ok") // already paid / shipped: a second callback changes nothing
  } catch (e) {
    console.error("[SHOP_CALLBACK]", e)
    return back(code, "hata")
  }
}
