/**
 * Paid memberships through iyzico's subscription API (iyzico charges the card every period by itself).
 *
 *   checkout  → our PENDING row + iyzico's hosted subscription form (pricing plan created on first use)
 *   callback  → we ask iyzico what happened to the form token (never trusting the browser), then ACTIVE
 *   webhook   → iyzico says "something happened to subscription X": we fetch X from iyzico and sync it
 *   cron      → safety net: re-syncs subscriptions near their period end, closes stale checkouts, expires plans
 *   cancel    → iyzico stops charging; the member keeps the period already paid for
 *
 * Modes follow the shop (see lib/iyzico): "live" with keys, "mock" (IYZICO_MOCK=1, never in production) for tests, "off".
 */
import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { iyzicoMode, tl } from "@/lib/iyzico"
import { logEvent } from "@/lib/event-log"
import {
  type BillingInterval, type PaidPlan, type PlanId,
  PLAN_LABEL, INTERVAL_LABEL, PREMIUM_MONTHLY_PASSES,
  addInterval, effectivePlan, monthKey, planPriceKurus,
} from "@/lib/subscriptions"

export class SubscriptionError extends Error {
  constructor(message: string, public code: string = "SUBSCRIPTION", public status = 400) { super(message) }
}

const baseUrl = () => process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com"
const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret"
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(`sub:${payload}`).digest("base64url")

async function client() {
  const Iyzipay = (await import("iyzipay")).default as any
  return new Iyzipay({ apiKey: process.env.IYZICO_API_KEY, secretKey: process.env.IYZICO_SECRET_KEY, uri: baseUrl() })
}

/** Calls an iyzipay resource method and resolves with iyzico's body, rejecting on transport errors or a non-success status. */
async function iyz(resource: string, method: string, params: Record<string, unknown>): Promise<any> {
  const c = await client()
  return new Promise((resolve, reject) => {
    c[resource][method](params, (err: any, body: any) => {
      if (err) return reject(new SubscriptionError(err.message || "iyzico'ya ulaşılamadı.", "PROVIDER", 502))
      if (!body || body.status !== "success") return reject(new SubscriptionError(body?.errorMessage || "iyzico isteği reddetti.", "PROVIDER", 502))
      resolve(body)
    })
  })
}

async function getSetting(key: string) {
  return (await db.appSetting.findUnique({ where: { key } }))?.value ?? null
}
async function setSetting(key: string, value: string) {
  await db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

/**
 * iyzico pricing plan for plan × interval at today's price. IYZICO_PLAN_<PLAN>_<INTERVAL> pins a plan made in the
 * iyzico panel; otherwise one is created on first use and remembered (a new price creates a new plan, old
 * subscribers keep theirs). The key includes the API host so sandbox and live references never mix.
 */
export async function ensurePricingPlan(plan: PaidPlan, interval: BillingInterval): Promise<string> {
  const pinned = process.env[`IYZICO_PLAN_${plan}_${interval}`]
  if (pinned) return pinned
  const price = planPriceKurus(plan, interval)
  const host = new URL(baseUrl()).host
  const key = `iyzico:${host}:plan:${plan}:${interval}:${price}`
  const known = await getSetting(key)
  if (known) return known

  const productKey = `iyzico:${host}:product`
  let product = await getSetting(productKey)
  if (!product) {
    const name = "AYA Üyelik"
    try {
      product = (await iyz("subscriptionProduct", "create", { locale: "tr", conversationId: "aya-product", name, description: "AYA Premium ve Sınırsız üyelik" })).data.referenceCode as string
    } catch {
      // already created (e.g. settings were reset): find it by name
      const list = await iyz("subscriptionProduct", "retrieveList", { locale: "tr", page: 1, count: 100 })
      product = (list.data?.items ?? []).find((p: any) => p.name === name)?.referenceCode ?? null
      if (!product) throw new SubscriptionError("Üyelik ürünü iyzico'da oluşturulamadı.", "PROVIDER", 502)
    }
    await setSetting(productKey, product!)
  }
  const created = await iyz("subscriptionPricingPlan", "create", {
    locale: "tr", conversationId: `aya-${plan}-${interval}`, productReferenceCode: product,
    name: `${PLAN_LABEL[plan]} ${INTERVAL_LABEL[interval]} ${tl(price)} TL`,
    price: tl(price), currencyCode: "TRY", paymentInterval: interval, paymentIntervalCount: 1, planPaymentType: "RECURRING",
  })
  const ref = created.data.referenceCode as string
  await setSetting(key, ref)
  return ref
}

/** Mirrors the paid period onto the user row that every page reads. */
async function mirrorOntoUser(tx: Prisma.TransactionClient, userId: string, plan: PaidPlan, periodEnd: Date | null) {
  await tx.user.update({ where: { id: userId }, data: { subscriptionPlan: plan, subscriptionEnds: periodEnd } })
}

export interface CheckoutInput { plan: PaidPlan; interval: BillingInterval; name: string; email: string; gsm: string; city: string; address: string }

/** Opens a checkout: returns iyzico's form (or the local mock form) to show on the page. */
export async function startSubscriptionCheckout(userId: string, input: CheckoutInput, opts: { callbackUrl: string }): Promise<{ subscriptionId: string; html: string }> {
  const mode = iyzicoMode()
  if (mode === "off") throw new SubscriptionError("Kartla ödeme şu an kullanılamıyor; abonelik başlatılamadı.", "PAYMENTS_OFF", 503)

  const current = await db.subscription.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } })
  if (current) throw new SubscriptionError("Zaten aktif bir aboneliğin var. Plan değiştirmek için önce mevcut aboneliği iptal et; ödediğin dönem sonuna kadar sürer.", "ALREADY_ACTIVE", 409)
  // cancelled, but the paid period is still running: a new subscription now would charge the same days twice
  if ((await currentPlan(userId)) !== "FREE") throw new SubscriptionError("Ödediğin dönem henüz bitmedi. Dönem sonunda yeniden abone olabilirsin.", "PERIOD_RUNNING", 409)
  // an earlier, abandoned checkout is closed so only one form is ever open
  await db.subscription.updateMany({ where: { userId, status: "PENDING" }, data: { status: "FAILED" } })

  const priceKurus = planPriceKurus(input.plan, input.interval)
  const sub = await db.subscription.create({ data: { userId, plan: input.plan, interval: input.interval, priceKurus, provider: mode === "mock" ? "mock" : "iyzico" } })

  if (mode === "mock") {
    const token = (r: "ok" | "fail") => {
      const payload = Buffer.from(JSON.stringify({ s: sub.id, r, n: crypto.randomBytes(4).toString("hex") })).toString("base64url")
      return `mock.${payload}.${sign(payload)}`
    }
    const form = (r: "ok" | "fail", label: string, testid: string) =>
      `<form method="POST" action="/api/subscriptions/callback" style="margin:8px 0"><input type="hidden" name="token" value="${token(r)}"><button type="submit" data-testid="${testid}" style="padding:10px 18px;border-radius:10px;border:1px solid #0c2a4a">${label}</button></form>`
    return { subscriptionId: sub.id, html: `<div data-testid="mock-sub-checkout"><p>Test abonelik ödemesi: ${PLAN_LABEL[input.plan]} ${INTERVAL_LABEL[input.interval]} (${tl(priceKurus)} TL)</p>${form("ok", "Ödemeyi onayla", "mock-sub-ok")}${form("fail", "Ödemeyi reddet", "mock-sub-fail")}</div>` }
  }

  try {
    const pricingPlanRef = await ensurePricingPlan(input.plan, input.interval)
    const [first, ...rest] = input.name.trim().split(/\s+/)
    const addr = { contactName: input.name.trim(), city: input.city, country: "Turkey", address: input.address }
    const r = await iyz("subscriptionCheckoutForm", "initialize", {
      locale: "tr", conversationId: sub.id, callbackUrl: opts.callbackUrl, pricingPlanReferenceCode: pricingPlanRef, subscriptionInitialStatus: "ACTIVE",
      customer: { name: first, surname: rest.join(" ") || first, identityNumber: "11111111111", email: input.email, gsmNumber: input.gsm, billingAddress: addr, shippingAddress: addr },
    })
    await db.subscription.update({ where: { id: sub.id }, data: { pricingPlanRef, checkoutToken: String(r.token).slice(0, 120) } })
    return { subscriptionId: sub.id, html: r.checkoutFormContent }
  } catch (e) {
    await db.subscription.update({ where: { id: sub.id }, data: { status: "FAILED" } })
    throw e
  }
}

/** iyzico's answer for a subscription (detail endpoint answers either the object or a one-item page). */
function readDetail(body: any) {
  const d = body?.data?.items?.[0] ?? body?.data ?? {}
  const orders: any[] = Array.isArray(d.orders) ? d.orders : []
  const paidEnds = orders.filter((o) => o?.orderStatus === "SUCCESS" && o?.endPeriod).map((o) => Number(o.endPeriod)).filter((n) => Number.isFinite(n) && n > 0)
  return {
    status: String(d.subscriptionStatus ?? ""),
    customerRef: d.customerReferenceCode ? String(d.customerReferenceCode) : null,
    pricingPlanRef: d.pricingPlanReferenceCode ? String(d.pricingPlanReferenceCode) : null,
    paidUntil: paidEnds.length ? new Date(Math.max(...paidEnds)) : null,
  }
}

export interface CallbackResult { ok: boolean; reason?: "declined" | "bad-token" | "unknown" | "mismatch" | "provider" }

/** The browser comes back from the payment form with a token: settle the subscription it belongs to. Idempotent. */
export async function completeSubscriptionCheckout(token: string): Promise<CallbackResult> {
  const mode = iyzicoMode()
  if (mode === "off" || !token) return { ok: false, reason: "bad-token" }

  if (mode === "mock") {
    const [tag, payload, sig] = token.split(".")
    if (tag !== "mock" || !payload || !sig || sign(payload) !== sig) return { ok: false, reason: "bad-token" }
    let p: { s: string; r: string }
    try { p = JSON.parse(Buffer.from(payload, "base64url").toString()) } catch { return { ok: false, reason: "bad-token" } }
    const sub = await db.subscription.findUnique({ where: { id: p.s } })
    if (!sub || sub.provider !== "mock") return { ok: false, reason: "unknown" }
    if (sub.status === "ACTIVE") return { ok: true }
    if (sub.status !== "PENDING") return { ok: false, reason: "unknown" }
    if (p.r !== "ok") {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "FAILED" } })
      return { ok: false, reason: "declined" }
    }
    await activate(sub.id, { referenceCode: `mock-${sub.id}`, customerRef: null, periodEnd: addInterval(new Date(), sub.interval as BillingInterval) })
    return { ok: true }
  }

  const sub = await db.subscription.findUnique({ where: { checkoutToken: token.slice(0, 120) } })
  if (!sub) return { ok: false, reason: "unknown" }
  if (sub.status === "ACTIVE") return { ok: true }
  if (sub.status !== "PENDING") return { ok: false, reason: "unknown" }
  let body: any
  try {
    body = await iyz("subscriptionCheckoutForm", "retrieve", { checkoutFormToken: token })
  } catch {
    // iyzico answers "failure" for a declined card too
    await db.subscription.update({ where: { id: sub.id }, data: { status: "FAILED" } })
    return { ok: false, reason: "declined" }
  }
  const d = body.data ?? {}
  const referenceCode = d.referenceCode ? String(d.referenceCode) : null
  if (!referenceCode || d.subscriptionStatus !== "ACTIVE") {
    await db.subscription.update({ where: { id: sub.id }, data: { status: "FAILED" } })
    return { ok: false, reason: "declined" }
  }
  if (sub.pricingPlanRef && d.pricingPlanReferenceCode && d.pricingPlanReferenceCode !== sub.pricingPlanRef) {
    logEvent({ type: "PAYMENT", level: "error", message: `Abonelik plan referansı uyuşmuyor: ${sub.id} beklenen ${sub.pricingPlanRef} gelen ${d.pricingPlanReferenceCode} (${referenceCode})` })
    await db.subscription.update({ where: { id: sub.id }, data: { status: "FAILED", referenceCode } })
    return { ok: false, reason: "mismatch" }
  }
  const start = d.startDate ? new Date(Number(d.startDate)) : new Date()
  await activate(sub.id, { referenceCode, customerRef: d.customerReferenceCode ? String(d.customerReferenceCode) : null, periodEnd: addInterval(Number.isFinite(start.getTime()) ? start : new Date(), sub.interval as BillingInterval) })
  return { ok: true }
}

async function activate(subscriptionId: string, info: { referenceCode: string; customerRef: string | null; periodEnd: Date }) {
  await db.$transaction(async (tx) => {
    const claimed = await tx.subscription.updateMany({
      where: { id: subscriptionId, status: "PENDING" },
      data: { status: "ACTIVE", referenceCode: info.referenceCode, customerRef: info.customerRef, currentPeriodEnd: info.periodEnd, lastSyncedAt: new Date() },
    })
    if (claimed.count !== 1) return // a second callback for the same checkout changes nothing
    const sub = await tx.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })
    await mirrorOntoUser(tx, sub.userId, sub.plan as PaidPlan, info.periodEnd)
  })
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId }, select: { userId: true, plan: true, interval: true, priceKurus: true } })
  if (sub) logEvent({ type: "PAYMENT", message: `Yeni abonelik: ${PLAN_LABEL[sub.plan as PaidPlan]} ${INTERVAL_LABEL[sub.interval as BillingInterval]} (${tl(sub.priceKurus)} TL)`, userId: sub.userId })
}

/** Reads one subscription back from iyzico and brings our row (and the user's plan) in line with it. */
export async function syncSubscription(subscriptionId: string): Promise<void> {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } })
  if (!sub || !sub.referenceCode || sub.provider !== "iyzico" || iyzicoMode() !== "live") return
  const info = readDetail(await iyz("subscription", "retrieve", { subscriptionReferenceCode: sub.referenceCode }))
  const periodEnd = info.paidUntil && (!sub.currentPeriodEnd || info.paidUntil > sub.currentPeriodEnd) ? info.paidUntil : sub.currentPeriodEnd
  const status = ["ACTIVE", "CANCELED", "UNPAID", "EXPIRED"].includes(info.status) ? info.status : sub.status
  await db.$transaction(async (tx) => {
    await tx.subscription.update({ where: { id: sub.id }, data: { status, currentPeriodEnd: periodEnd, lastSyncedAt: new Date(), customerRef: info.customerRef ?? sub.customerRef } })
    const latest = await tx.subscription.findFirst({ where: { userId: sub.userId, status: { in: ["ACTIVE", "CANCELED", "UNPAID", "EXPIRED"] } }, orderBy: { createdAt: "desc" }, select: { id: true } })
    if (latest?.id === sub.id) await mirrorOntoUser(tx, sub.userId, sub.plan as PaidPlan, periodEnd)
  })
}

/** iyzico's notification: only the reference is used, and only to know which subscription to fetch from iyzico. */
export async function handleSubscriptionWebhook(body: any): Promise<boolean> {
  const ref = typeof body?.subscriptionReferenceCode === "string" ? body.subscriptionReferenceCode.slice(0, 80) : null
  if (!ref) return false
  const sub = await db.subscription.findUnique({ where: { referenceCode: ref }, select: { id: true } })
  if (!sub) return false
  await syncSubscription(sub.id)
  return true
}

/** Stops future charges. The member keeps the plan until the end of the period already paid for. */
export async function cancelSubscription(userId: string): Promise<{ until: Date | null }> {
  const sub = await db.subscription.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } })
  if (!sub) throw new SubscriptionError("İptal edilecek aktif bir abonelik bulunamadı.", "NOT_FOUND", 404)
  if (sub.provider === "iyzico") {
    if (iyzicoMode() !== "live") throw new SubscriptionError("Ödeme sağlayıcısına şu an ulaşılamıyor, lütfen sonra tekrar dene.", "PAYMENTS_OFF", 503)
    await iyz("subscription", "cancel", { subscriptionReferenceCode: sub.referenceCode })
  }
  await db.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED", canceledAt: new Date() } })
  logEvent({ type: "PAYMENT", message: `Abonelik iptal edildi: ${PLAN_LABEL[sub.plan as PaidPlan]} (dönem sonu ${sub.currentPeriodEnd?.toISOString().slice(0, 10) ?? "-"})`, userId })
  return { until: sub.currentPeriodEnd }
}

/** Cron: re-sync subscriptions whose period is ending (missed webhooks), close abandoned checkouts, expire mock ones. */
export async function subscriptionMaintenance(now: Date = new Date()) {
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const due = await db.subscription.findMany({ where: { status: "ACTIVE", currentPeriodEnd: { lte: soon } }, select: { id: true, provider: true }, take: 200 })
  let synced = 0, expired = 0
  for (const s of due) {
    if (s.provider === "iyzico") {
      try { await syncSubscription(s.id); synced++ } catch (e) { console.error("[SUB_SYNC]", s.id, e) }
    }
  }
  // mock subscriptions never renew by themselves
  expired += (await db.subscription.updateMany({ where: { provider: "mock", status: "ACTIVE", currentPeriodEnd: { lt: now } }, data: { status: "EXPIRED" } })).count
  const stale = await db.subscription.updateMany({ where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 6 * 60 * 60 * 1000) } }, data: { status: "FAILED" } })
  return { synced, expired, abandoned: stale.count }
}

export interface MembershipSummary {
  plan: PlanId
  periodEnd: string | null
  subscription: { id: string; plan: PaidPlan; interval: BillingInterval; status: string; priceKurus: number; currentPeriodEnd: string | null; canceledAt: string | null } | null
  passes: { used: number; limit: number | null; month: string } | null
}

export async function membershipSummary(userId: string): Promise<MembershipSummary> {
  const [user, sub] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { subscriptionPlan: true, subscriptionEnds: true } }),
    db.subscription.findFirst({ where: { userId, status: { in: ["ACTIVE", "CANCELED", "UNPAID"] } }, orderBy: { createdAt: "desc" } }),
  ])
  const plan = effectivePlan(user)
  const month = monthKey()
  const used = plan === "FREE" ? 0 : await db.subscriptionPass.count({ where: { userId, month } })
  return {
    plan,
    periodEnd: plan === "FREE" ? null : user?.subscriptionEnds?.toISOString() ?? null,
    subscription: sub ? { id: sub.id, plan: sub.plan as PaidPlan, interval: sub.interval as BillingInterval, status: sub.status, priceKurus: sub.priceKurus, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null, canceledAt: sub.canceledAt?.toISOString() ?? null } : null,
    passes: plan === "FREE" ? null : { used, limit: plan === "PREMIUM" ? PREMIUM_MONTHLY_PASSES : null, month },
  }
}

export async function currentPlan(userId: string): Promise<PlanId> {
  return effectivePlan(await db.user.findUnique({ where: { id: userId }, select: { subscriptionPlan: true, subscriptionEnds: true } }))
}

export type PassCheck = { ok: true; via: "UNLIMITED" | "PASS" } | { ok: false; code: "MEMBERS_ONLY" | "PASS_LIMIT"; error: string }

/**
 * May this member enter a students-only broadcast they are not a student of? Sınırsız: always. Premium: if they already
 * entered this broadcast, or have a pass left this month (taking one). The user row is locked so two quick joins
 * into different broadcasts cannot both take the last pass.
 */
export async function useMembershipForBroadcast(userId: string, liveRoomId: string): Promise<PassCheck> {
  const plan = await currentPlan(userId)
  if (plan === "UNLIMITED") return { ok: true, via: "UNLIMITED" }
  if (plan !== "PREMIUM") return { ok: false, code: "MEMBERS_ONLY", error: "Bu yayın eğitmenin öğrencilerine ve Premium / Sınırsız üyelere özel." }
  const month = monthKey()
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`
    const existing = await tx.subscriptionPass.findUnique({ where: { userId_liveRoomId: { userId, liveRoomId } } })
    if (existing) return { ok: true, via: "PASS" } as const
    const used = await tx.subscriptionPass.count({ where: { userId, month } })
    if (used >= PREMIUM_MONTHLY_PASSES) {
      return { ok: false, code: "PASS_LIMIT", error: `Bu ayki ${PREMIUM_MONTHLY_PASSES} özel yayın hakkını kullandın. Sınırsız plana geçebilir ya da ay başını bekleyebilirsin.` } as const
    }
    await tx.subscriptionPass.create({ data: { userId, liveRoomId, month } })
    return { ok: true, via: "PASS" } as const
  })
}
