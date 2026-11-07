/**
 * Card payments for the shop through iyzico's hosted checkout form.
 *  - "live": IYZICO_API_KEY and IYZICO_SECRET_KEY are set (IYZICO_BASE_URL defaults to the sandbox; use https://api.iyzipay.com in production)
 *  - "mock": IYZICO_MOCK=1 outside production: a local stand-in with signed tokens, used by the tests and for trying the flow without keys
 *  - "off": nothing configured; the shop does not offer card payment
 * Every successful payment is checked against the order (code and amount) before anything is marked paid.
 */
import crypto from "crypto"

export type IyzicoMode = "live" | "mock" | "off"

/** iyzico's own sandbox keys start with "sandbox-" and are real test keys; only the obvious placeholders are refused */
const real = (v?: string) => !!v && !/^(sandbox-api-key|sandbox-secret-key)$/i.test(v) && !/dummy|change-?me/i.test(v)

export function iyzicoMode(): IyzicoMode {
  if (real(process.env.IYZICO_API_KEY) && real(process.env.IYZICO_SECRET_KEY)) return "live"
  if (process.env.IYZICO_MOCK === "1" && process.env.NODE_ENV !== "production") return "mock"
  return "off"
}

const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret"
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url")
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")

/** "249.90" for 24990 */
export const tl = (kurus: number) => (kurus / 100).toFixed(2)

function mockToken(code: string, kurus: number, outcome: "ok" | "fail") {
  const payload = b64({ c: code, a: kurus, r: outcome, n: crypto.randomBytes(4).toString("hex") })
  return `mock.${payload}.${sign(payload)}`
}

export interface CheckoutOrder {
  code: string
  totalKurus: number
  shippingKurus: number
  email: string
  name: string
  phone: string
  address: string
  city: string
  items: { id: string; name: string; unitKurus: number; quantity: number }[]
}

export interface StartedCheckout { token: string; html: string }

export async function startShopCheckout(order: CheckoutOrder, opts: { callbackUrl: string; ip: string; userId?: string | null }): Promise<StartedCheckout> {
  const mode = iyzicoMode()
  if (mode === "off") throw new Error("Kartla ödeme şu an kullanılamıyor.")
  if (mode === "mock") {
    const form = (outcome: "ok" | "fail", label: string, testid: string) =>
      `<form method="POST" action="/api/iyzico/shop-callback" style="margin:8px 0"><input type="hidden" name="token" value="${mockToken(order.code, order.totalKurus, outcome)}"><button type="submit" data-testid="${testid}" style="padding:10px 18px;border-radius:10px;border:1px solid #0c2a4a">${label}</button></form>`
    return { token: "mock", html: `<div data-testid="mock-checkout"><p>Test ödeme sayfası (${(order.totalKurus / 100).toFixed(2)} TL)</p>${form("ok", "Ödemeyi onayla", "mock-pay-ok")}${form("fail", "Ödemeyi reddet", "mock-pay-fail")}</div>` }
  }
  const Iyzipay = (await import("iyzipay")).default as any
  const client = new Iyzipay({ apiKey: process.env.IYZICO_API_KEY, secretKey: process.env.IYZICO_SECRET_KEY, uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com" })
  const [first, ...rest] = order.name.trim().split(/\s+/)
  const surname = rest.join(" ") || first
  const basket = [
    ...order.items.map((i) => ({ id: i.id, name: i.name.slice(0, 80), category1: "Yoga", itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL, price: tl(i.unitKurus * i.quantity) })),
    ...(order.shippingKurus > 0 ? [{ id: "kargo", name: "Kargo", category1: "Kargo", itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, price: tl(order.shippingKurus) }] : []),
  ]
  const addr = { contactName: order.name, city: order.city, country: "Turkey", address: order.address }
  const request = {
    locale: Iyzipay.LOCALE.TR, conversationId: order.code, price: tl(order.totalKurus), paidPrice: tl(order.totalKurus), currency: Iyzipay.CURRENCY.TRY,
    basketId: order.code, paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT, callbackUrl: opts.callbackUrl, enabledInstallments: [1],
    buyer: { id: opts.userId || `guest-${order.code}`, name: first, surname, gsmNumber: order.phone, email: order.email, identityNumber: "11111111111", registrationAddress: order.address, ip: opts.ip, city: order.city, country: "Turkey" },
    shippingAddress: addr, billingAddress: addr, basketItems: basket,
  }
  return new Promise<StartedCheckout>((resolve, reject) => {
    client.checkoutFormInitialize.create(request, (err: any, result: any) => {
      if (err) return reject(new Error(err.message || "Ödeme başlatılamadı."))
      if (result?.status !== "success") return reject(new Error(result?.errorMessage || "Ödeme başlatılamadı."))
      resolve({ token: result.token, html: result.checkoutFormContent })
    })
  })
}

export interface CheckoutResult { ok: boolean; code: string | null; paidKurus: number; paymentId: string | null; error?: string }

/** Asks the provider (or checks our own signature in mock mode) what happened to a payment token. */
export async function retrieveShopCheckout(token: string): Promise<CheckoutResult> {
  const mode = iyzicoMode()
  if (mode === "off") return { ok: false, code: null, paidKurus: 0, paymentId: null, error: "off" }
  if (mode === "mock") {
    const [tag, payload, sig] = token.split(".")
    if (tag !== "mock" || !payload || !sig || sign(payload) !== sig) return { ok: false, code: null, paidKurus: 0, paymentId: null, error: "bad-token" }
    try {
      const p = JSON.parse(Buffer.from(payload, "base64url").toString())
      return p.r === "ok" ? { ok: true, code: p.c, paidKurus: p.a, paymentId: `mock-${payload.slice(-8)}` } : { ok: false, code: p.c, paidKurus: 0, paymentId: null, error: "declined" }
    } catch {
      return { ok: false, code: null, paidKurus: 0, paymentId: null, error: "bad-token" }
    }
  }
  const Iyzipay = (await import("iyzipay")).default as any
  const client = new Iyzipay({ apiKey: process.env.IYZICO_API_KEY, secretKey: process.env.IYZICO_SECRET_KEY, uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com" })
  return new Promise<CheckoutResult>((resolve) => {
    client.checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, conversationId: "", token }, (err: any, r: any) => {
      if (err || !r) return resolve({ ok: false, code: null, paidKurus: 0, paymentId: null, error: err?.message || "no-answer" })
      const code = typeof r.basketId === "string" ? r.basketId : null
      const ok = r.status === "success" && r.paymentStatus === "SUCCESS"
      resolve({ ok, code, paidKurus: ok ? Math.round(parseFloat(r.paidPrice) * 100) : 0, paymentId: r.paymentId ? String(r.paymentId) : null, error: ok ? undefined : r.errorMessage || r.paymentStatus || "failed" })
    })
  })
}
