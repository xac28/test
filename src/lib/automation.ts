import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { notify, notifyAdminsInApp } from "@/lib/notifications"
import { SITE_URL } from "@/lib/site"
import { renderMail, sendCampaign, unsubscribeUrl } from "@/lib/newsletter"
import { LOW_STOCK, UNPAID_ORDER_DAYS, formatKurus } from "@/lib/shop"
import { NEWS_CATEGORIES, NON_EDITORIAL_CATEGORIES } from "@/lib/articles"
import { OPEN_STATUSES } from "@/lib/reports"
import { notifyNewContent } from "@/lib/content-notify"

const HOUR = 3_600_000
const DAY = 24 * HOUR

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string))
const when = (d: Date) => d.toLocaleString("tr-TR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Istanbul" })
const frame = (inner: string) => `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0c2a4a"><h2 style="letter-spacing:.28em;font-weight:500">AYA</h2>${inner}</div>`

/** In-app notification first (it always works), then the e-mail (best effort). */
async function tell(user: { id: string; email: string | null }, title: string, body: string, href: string) {
  await notify({ userId: user.id, type: "SYSTEM", title, body, href })
  if (user.email) await sendEmail({ to: user.email, subject: `AYA: ${title}`, html: frame(`<p>${esc(body)}</p><p><a href="${SITE_URL}${href}" style="color:#1f62bf">Ayrıntılar</a></p>`) })
}

export interface ReminderResult { lessons24: number; lessons1h: number; workshops24: number; workshops1h: number; reviewAsks: number }

/**
 * Reminders 24 h and 1 h before a lesson or live workshop (student and teacher), and one review request after a completed lesson.
 * Every message is claimed in the database first (`updateMany … where mark is null`), so two overlapping runs never send twice.
 */
export async function runReminders(now = new Date()): Promise<ReminderResult> {
  const out: ReminderResult = { lessons24: 0, lessons1h: 0, workshops24: 0, workshops1h: 0, reviewAsks: 0 }
  const stages = [
    { key: "24" as const, from: new Date(now.getTime() + HOUR), to: new Date(now.getTime() + DAY), label: "yarın" },
    { key: "1h" as const, from: now, to: new Date(now.getTime() + HOUR), label: "1 saat içinde" },
  ]

  for (const st of stages) {
    const field = st.key === "24" ? "reminder24At" : "reminder1hAt"
    const bookings = await db.booking.findMany({
      where: { status: "CONFIRMED", startTime: { gt: st.from, lte: st.to }, [field]: null },
      include: { student: { select: { id: true, name: true, email: true } }, teacher: { include: { user: { select: { id: true, name: true, email: true } } } } },
      take: 500,
    })
    for (const b of bookings) {
      const claimed = await db.booking.updateMany({ where: { id: b.id, [field]: null }, data: { [field]: now } })
      if (claimed.count === 0) continue
      await tell(b.student, `Dersin ${st.label}`, `${b.teacher.user.name ?? "Eğitmeninle"} dersin ${when(b.startTime)} saatinde başlıyor. Kamera ve mikrofonunu önceden kontrol et.`, "/dashboard")
      await tell(b.teacher.user, `Dersin ${st.label}`, `${b.student.name ?? "Öğrencinle"} dersin ${when(b.startTime)} saatinde başlıyor.`, "/teach")
      out[st.key === "24" ? "lessons24" : "lessons1h"]++
    }

    const enrollments = await db.workshopEnrollment.findMany({
      where: { status: "CONFIRMED", [field]: null, workshop: { status: "PUBLISHED", mode: "LIVE", startsAt: { gt: st.from, lte: st.to } } },
      include: { user: { select: { id: true, email: true } }, workshop: { select: { title: true, slug: true, startsAt: true } } },
      take: 1000,
    })
    for (const e of enrollments) {
      const claimed = await db.workshopEnrollment.updateMany({ where: { id: e.id, [field]: null }, data: { [field]: now } })
      if (claimed.count === 0) continue
      await tell(e.user, `Atölyen ${st.label}`, `“${e.workshop.title}” atölyesi ${when(e.workshop.startsAt!)} saatinde başlıyor.`, `/atolyeler/${e.workshop.slug}`)
      out[st.key === "24" ? "workshops24" : "workshops1h"]++
    }
  }

  // review request: 2 hours to 7 days after a completed lesson, once, only when there is no review yet
  const done = await db.booking.findMany({
    where: { status: "COMPLETED", endTime: { gt: new Date(now.getTime() - 7 * DAY), lte: new Date(now.getTime() - 2 * HOUR) }, reviewAskedAt: null, review: null },
    include: { student: { select: { id: true, email: true } }, teacher: { include: { user: { select: { name: true } } } } },
    take: 500,
  })
  for (const b of done) {
    const claimed = await db.booking.updateMany({ where: { id: b.id, reviewAskedAt: null }, data: { reviewAskedAt: now } })
    if (claimed.count === 0) continue
    await tell(b.student, "Dersin nasıldı?", `${b.teacher.user.name ?? "Eğitmenin"} ile dersini değerlendirir misin? Birkaç kelime, diğer öğrencilere yardımcı olur.`, "/dashboard")
    out.reviewAsks++
  }
  return out
}

export interface AdminDigest { items: { label: string; count: number; href: string }[]; overdue: { label: string; count: number; href: string }[]; total: number; emailed: boolean }

/** A morning summary for the admins: what is waiting for a decision. Nothing is sent on a quiet day. */
export async function runAdminDigest(now = new Date()): Promise<AdminDigest> {
  const since = new Date(now.getTime() - DAY)
  const [applications, reports, posts, payouts, support, aiUnknown, orders, lowStock, newUsers] = await Promise.all([
    db.teacherApplication.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: { in: OPEN_STATUSES } } }),
    db.post.count({ where: { status: "PENDING" } }),
    db.payoutRequest.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: "OPEN", awaitingStaff: true } }),
    db.aiInteraction.count({ where: { kind: "unknown", taught: false, dismissed: false } }),
    db.order.count({ where: { status: { in: ["PENDING_PAYMENT", "PAID"] } } }),
    db.product.count({ where: { status: "PUBLISHED", stock: { lte: LOW_STOCK } } }),
    db.user.count({ where: { createdAt: { gte: since } } }),
  ])
  const items = [
    { label: "Eğitmen başvurusu bekliyor", count: applications, href: "/admin?tab=applications" },
    { label: "Açık rapor", count: reports, href: "/admin?tab=reports" },
    { label: "Onay bekleyen fotoğraf", count: posts, href: "/admin?tab=community" },
    { label: "Ödeme talebi", count: payouts, href: "/admin?tab=payouts" },
    { label: "Canlı destek yanıt bekliyor", count: support, href: "/admin?tab=support" },
    { label: "Rehberin bilmediği soru", count: aiUnknown, href: "/admin?tab=ai" },
    { label: "Açık sipariş (ödeme/hazırlık)", count: orders, href: "/admin?tab=orders" },
    { label: "Stoğu azalan ürün", count: lowStock, href: "/admin?tab=products" },
  ].filter((i) => i.count > 0)
  const total = items.reduce((n, i) => n + i.count, 0)
  const overdue = await overdueItems(now)
  let emailed = false
  if (total > 0) {
    const late = overdue.length ? ` · GECİKEN: ${overdue.map((i) => `${i.count} ${i.label.toLowerCase()}`).join(", ")}` : ""
    await notifyAdminsInApp("Günlük özet", (items.map((i) => `${i.count} ${i.label.toLowerCase()}`).join(", ") + late).slice(0, 380), "/admin")
    if (process.env.ADMIN_EMAIL) {
      const r = await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `AYA günlük özet: ${total} bekleyen iş`,
        html: frame(`<p>Günaydın! Bekleyen işler:</p><ul>${items.map((i) => `<li><a href="${SITE_URL}${i.href}" style="color:#1f62bf">${i.count} · ${esc(i.label)}</a></li>`).join("")}</ul>${overdue.length ? `<p style="color:#b42318"><strong>Geciken işler</strong></p><ul>${overdue.map((i) => `<li><a href="${SITE_URL}${i.href}" style="color:#b42318">${i.count} · ${esc(i.label)}</a></li>`).join("")}</ul>` : ""}<p style="color:#5a6f87;font-size:13px">Son 24 saatte ${newUsers} yeni üye.</p>`),
      })
      emailed = !!r.success
    }
  }
  return { items, overdue, total, emailed }
}

/** ISO week label: 2026-W41 */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const year = t.getUTCFullYear()
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7)
  return `${year}-W${String(week).padStart(2, "0")}`
}

/** Once a week: what is new on the site, mailed to the subscribers. Skipped when nothing is new or this week was already sent. */
export async function runWeeklyDigest(now = new Date()) {
  const refId = `digest-${isoWeek(now)}`
  if (await db.newsletterCampaign.count({ where: { refId, kind: "digest" } })) return { sent: false, reason: "already-sent" as const, refId }
  const since = new Date(now.getTime() - 7 * DAY)
  const [articles, news, episodes, products, workshops] = await Promise.all([
    db.article.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since }, category: { notIn: NON_EDITORIAL_CATEGORIES } }, select: { title: true, slug: true }, orderBy: { publishedAt: "desc" }, take: 5 }),
    db.article.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since }, category: { in: [...NEWS_CATEGORIES] } }, select: { title: true, slug: true }, orderBy: { publishedAt: "desc" }, take: 5 }),
    db.podcastEpisode.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since } }, select: { title: true, slug: true }, orderBy: { publishedAt: "desc" }, take: 3 }),
    db.product.findMany({ where: { status: "PUBLISHED", stock: { gt: 0 }, createdAt: { gte: since } }, select: { name: true, slug: true, priceKurus: true }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.workshop.findMany({ where: { status: "PUBLISHED", mode: "LIVE", startsAt: { gt: now, lte: new Date(now.getTime() + 14 * DAY) } }, select: { title: true, slug: true, startsAt: true }, orderBy: { startsAt: "asc" }, take: 4 }),
  ])
  const newThings = articles.length + news.length + episodes.length + products.length
  if (newThings === 0) return { sent: false, reason: "nothing-new" as const, refId }
  const lines: string[] = ["Bu hafta AYA’da neler oldu:"]
  const section = (title: string, rows: string[]) => { if (rows.length) lines.push("", title, ...rows.map((r) => `- ${r}`)) }
  section("Yeni yazılar", articles.map((a) => `${a.title}: ${SITE_URL}/icerikler/${a.slug}`))
  section("Duyurular ve haberler", news.map((a) => `${a.title}: ${SITE_URL}/icerikler/${a.slug}`))
  section("Podcast", episodes.map((e) => `${e.title}: ${SITE_URL}/podcast/${e.slug}`))
  section("Shop’ta yeni", products.map((p) => `${p.name} (${formatKurus(p.priceKurus)}): ${SITE_URL}/shop/urun/${p.slug}`))
  section("Yaklaşan canlı atölyeler", workshops.map((w) => `${w.title} — ${w.startsAt!.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" })}: ${SITE_URL}/atolyeler/${w.slug}`))
  const r = await sendCampaign({ subject: `AYA bu hafta: ${newThings} yeni içerik`, body: lines.join("\n"), kind: "digest", refId, cta: { label: "AYA’yı aç", href: SITE_URL } })
  return { sent: !r.skipped, reason: r.skipped ? ("no-smtp" as const) : ("ok" as const), refId, recipients: r.recipients }
}

/**
 * "Back in stock": tells the visitors who asked on the sold-out product page (newsletter source `shop:<slug>`).
 * Each of them is told once: their source is marked `…:notified` before the mail goes out.
 */
export async function notifyRestock(productIds: string[]) {
  let told = 0
  for (const id of productIds) {
    const p = await db.product.findUnique({ where: { id }, select: { name: true, slug: true, stock: true, status: true, priceKurus: true } })
    if (!p || p.status !== "PUBLISHED" || p.stock <= 0) continue
    const source = `shop:${p.slug}`
    const waiting = await db.newsletterSubscriber.findMany({ where: { source, unsubscribedAt: null }, select: { id: true } })
    if (!waiting.length) continue
    const ids = waiting.map((w) => w.id)
    const claimed = await db.newsletterSubscriber.updateMany({ where: { id: { in: ids }, source }, data: { source: `${source}:notified` } })
    if (claimed.count === 0) continue
    await sendCampaign({ subject: `Tekrar stokta: ${p.name}`, body: `Beklediğin ürün tekrar stokta: ${p.name} (${formatKurus(p.priceKurus)}). Stoklar sınırlı.`, kind: "restock", refId: id, onlyIds: ids, cta: { label: "Ürüne bak", href: `${SITE_URL}/shop/urun/${p.slug}` } })
    told += claimed.count
  }
  return told
}

// ───────────────────────── scheduled publishing ─────────────────────────

export interface PublishResult { articles: number; episodes: number; products: number; announced: number }

/**
 * Publishes every draft whose `scheduledAt` has come (articles, podcast episodes, products). Each item is claimed with
 * `updateMany … where status = DRAFT and scheduledAt = the value we read`, so overlapping runs publish it once, and an admin
 * who changed or cancelled the schedule in the meantime wins. Items flagged "tell the subscribers" are announced right after.
 */
export async function runScheduledPublish(now = new Date()): Promise<PublishResult> {
  const out: PublishResult = { articles: 0, episodes: 0, products: 0, announced: 0 }
  const kinds = [
    { kind: "article" as const, table: db.article as any, live: { publishedAt: now }, key: "articles" as const },
    { kind: "podcast" as const, table: db.podcastEpisode as any, live: { publishedAt: now }, key: "episodes" as const },
    { kind: "product" as const, table: db.product as any, live: {}, key: "products" as const },
  ]
  for (const { kind, table, live, key } of kinds) {
    const due: { id: string; scheduledAt: Date; scheduledNotify: boolean }[] = await table.findMany({
      where: { status: "DRAFT", scheduledAt: { lte: now } },
      select: { id: true, scheduledAt: true, scheduledNotify: true },
      orderBy: { scheduledAt: "asc" },
      take: 50,
    })
    for (const row of due) {
      const claimed = await table.updateMany({ where: { id: row.id, status: "DRAFT", scheduledAt: row.scheduledAt }, data: { status: "PUBLISHED", scheduledAt: null, scheduledNotify: false, ...live } })
      if (claimed.count !== 1) continue
      out[key]++
      if (row.scheduledNotify) {
        const sent = await notifyNewContent(kind, row.id).catch((e) => (console.error("[SCHEDULED_NOTIFY]", kind, e), null))
        if (sent) out.announced++
      }
    }
  }
  return out
}

// ───────────────────────── unpaid orders & inactive students ─────────────────────────

/**
 * A bank-transfer order that has waited a day for its payment gets one reminder, with the time that is left before the
 * automatic cancellation (UNPAID_ORDER_DAYS). Claimed first, so it is sent once even when two runs overlap.
 */
export async function runUnpaidOrderReminders(now = new Date()): Promise<number> {
  const remindAfter = new Date(now.getTime() - DAY)
  const alive = new Date(now.getTime() - UNPAID_ORDER_DAYS * DAY)
  const orders = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", payMethod: "havale", payReminderAt: null, createdAt: { lte: remindAfter, gt: alive } },
    select: { id: true, code: true, email: true, userId: true, totalKurus: true, createdAt: true },
    take: 100,
  })
  let sent = 0
  for (const o of orders) {
    const claimed = await db.order.updateMany({ where: { id: o.id, payReminderAt: null, status: "PENDING_PAYMENT" }, data: { payReminderAt: now } })
    if (claimed.count !== 1) continue
    sent++
    const hoursLeft = Math.max(1, Math.round((o.createdAt.getTime() + UNPAID_ORDER_DAYS * DAY - now.getTime()) / HOUR))
    const left = hoursLeft >= 24 ? `${Math.round(hoursLeft / 24)} gün` : `${hoursLeft} saat`
    const href = `/shop/siparis/${o.code}`
    const text = `${o.code} numaralı siparişin için havale/EFT ödemeni bekliyoruz (${formatKurus(o.totalKurus)}). Yaklaşık ${left} içinde ödeme gelmezse sipariş otomatik iptal edilir ve ürünler stoğa döner.`
    if (o.userId) await notify({ userId: o.userId, type: "SYSTEM", title: "Siparişin ödeme bekliyor", body: text, href })
    if (o.email) await sendEmail({ to: o.email, subject: `AYA Shop: ${o.code} siparişin ödeme bekliyor`, html: frame(`<p>${esc(text)}</p><p><a href="${SITE_URL}${href}" style="color:#1f62bf">Sipariş ve ödeme bilgileri</a></p><p style="color:#5a6f87;font-size:13px">Ödemeyi yaptıysan bu mesajı yok sayabilirsin; kontrol edip siparişini hazırlayacağız.</p>`) })
  }
  return sent
}

export interface WinbackResult { nudged: number; emailed: number }

/**
 * Students who joined at least three weeks ago and have not booked a lesson or workshop for a month get one friendly nudge
 * (at most one per 60 days): what is coming up and the half-price trial lesson. The bell always gets it; an e-mail only goes to
 * those who also subscribed to the newsletter (they agreed to hear from us), with the unsubscribe link.
 */
export async function runWinback(now = new Date(), limit = 100): Promise<WinbackResult> {
  const out: WinbackResult = { nudged: 0, emailed: 0 }
  const since30 = new Date(now.getTime() - 30 * DAY)
  const candidates = await db.user.findMany({
    where: {
      role: "STUDENT", banned: false, deletedAt: null, email: { not: null }, createdAt: { lte: new Date(now.getTime() - 21 * DAY) },
      OR: [{ winbackAt: null }, { winbackAt: { lte: new Date(now.getTime() - 60 * DAY) } }],
      bookings: { none: { OR: [{ createdAt: { gte: since30 } }, { startTime: { gte: now } }] } },
      workshopEnrollments: { none: { createdAt: { gte: since30 } } },
    },
    select: { id: true, name: true, email: true, winbackAt: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  })
  if (!candidates.length) return out
  const [workshops, article] = await Promise.all([
    db.workshop.findMany({ where: { status: "PUBLISHED", mode: "LIVE", startsAt: { gte: now, lte: new Date(now.getTime() + 14 * DAY) } }, select: { title: true, startsAt: true }, orderBy: { startsAt: "asc" }, take: 3 }),
    db.article.findFirst({ where: { status: "PUBLISHED", category: { notIn: NON_EDITORIAL_CATEGORIES } }, select: { title: true, slug: true }, orderBy: { publishedAt: "desc" } }),
  ])
  const lines = [
    ...(workshops.length ? [`Önümüzdeki 2 haftada ${workshops.length === 3 ? "3+" : workshops.length} canlı atölye var; ilki: ${workshops[0].title} (${when(workshops[0].startsAt!)}).`] : []),
    ...(article ? [`Yeni yazı: ${article.title}.`] : []),
    "İlk deneme dersin her eğitmende yarı fiyat.",
  ]
  for (const u of candidates) {
    const claimed = await db.user.updateMany({ where: { id: u.id, OR: [{ winbackAt: null }, { winbackAt: { lte: new Date(now.getTime() - 60 * DAY) } }] }, data: { winbackAt: now } })
    if (claimed.count !== 1) continue
    out.nudged++
    const first = (u.name ?? "").trim().split(/\s+/)[0]
    const body = `${first ? `${first}, ` : ""}seni bir süredir aramızda göremedik. ${lines.join(" ")}`
    await notify({ userId: u.id, type: "SYSTEM", title: "Seni özledik", body, href: "/atolyeler" })
    const sub = u.email ? await db.newsletterSubscriber.findFirst({ where: { email: u.email.toLowerCase(), unsubscribedAt: null }, select: { unsubscribeToken: true } }) : null
    if (sub?.unsubscribeToken && u.email) {
      const m = renderMail(`${body}\n\nSana uygun bir ders ya da atölye bulmak için Rehber'e yazabilirsin.`, unsubscribeUrl(sub.unsubscribeToken), { label: "AYA'ya göz at", href: `${SITE_URL}/atolyeler` })
      const r = await sendEmail({ to: u.email, subject: "AYA: seni özledik", html: m.html, text: m.text })
      if (r.success) out.emailed++
    }
  }
  return out
}


// ───────────────────────── service levels: things that wait too long ─────────────────────────

/** How long each kind of request may wait before it counts as overdue. */
export const SLA = { applicationHours: 48, applicantReassureHours: 72, supportHours: 24, reportHours: 72, payoutHours: 72, postHours: 24 }

/** What has waited past its limit right now (counts only; used by the daily summary). */
export async function overdueItems(now = new Date()): Promise<{ label: string; count: number; href: string }[]> {
  const ago = (h: number) => new Date(now.getTime() - h * HOUR)
  const [applications, support, reports, payouts, posts] = await Promise.all([
    db.teacherApplication.count({ where: { status: "PENDING", submittedAt: { lte: ago(SLA.applicationHours) } } }),
    db.supportTicket.count({ where: { status: "OPEN", awaitingStaff: true, lastMessageAt: { lte: ago(SLA.supportHours) } } }),
    db.report.count({ where: { status: { in: OPEN_STATUSES }, createdAt: { lte: ago(SLA.reportHours) } } }),
    db.payoutRequest.count({ where: { status: "PENDING", createdAt: { lte: ago(SLA.payoutHours) } } }),
    db.post.count({ where: { status: "PENDING", createdAt: { lte: ago(SLA.postHours) } } }),
  ])
  return [
    { label: `Eğitmen başvurusu ${SLA.applicationHours} saattir bekliyor`, count: applications, href: "/admin?tab=applications" },
    { label: `Destek talebi ${SLA.supportHours} saattir yanıtsız`, count: support, href: "/admin?tab=support" },
    { label: `Rapor ${SLA.reportHours} saattir açık`, count: reports, href: "/admin?tab=reports" },
    { label: `Ödeme talebi ${SLA.payoutHours} saattir bekliyor`, count: payouts, href: "/admin?tab=payouts" },
    { label: `Fotoğraf ${SLA.postHours} saattir onay bekliyor`, count: posts, href: "/admin?tab=community" },
  ].filter((i) => i.count > 0)
}

export interface SlaResult { adminAlerts: number; applicantNudges: number }

/**
 * Teacher applications: the admins get one alert per application that waited 48 hours, and the applicant one reassurance after
 * 72 hours ("still being reviewed"). Both are claimed first, so nothing is sent twice.
 */
export async function runSlaWatch(now = new Date()): Promise<SlaResult> {
  const out: SlaResult = { adminAlerts: 0, applicantNudges: 0 }
  const ago = (h: number) => new Date(now.getTime() - h * HOUR)
  const late = await db.teacherApplication.findMany({
    where: { status: "PENDING", slaAlertedAt: null, submittedAt: { lte: ago(SLA.applicationHours) } },
    select: { id: true, user: { select: { name: true } }, submittedAt: true },
    take: 50,
  })
  for (const a of late) {
    const claimed = await db.teacherApplication.updateMany({ where: { id: a.id, status: "PENDING", slaAlertedAt: null }, data: { slaAlertedAt: now } })
    if (claimed.count !== 1) continue
    out.adminAlerts++
    const days = Math.max(2, Math.round((now.getTime() - a.submittedAt.getTime()) / DAY))
    await notifyAdminsInApp("Eğitmen başvurusu bekliyor", `${a.user.name ?? "Bir aday"} ${days} gündür yanıt bekliyor.`, "/admin?tab=applications")
  }
  const waiting = await db.teacherApplication.findMany({
    where: { status: "PENDING", applicantNudgedAt: null, submittedAt: { lte: ago(SLA.applicantReassureHours) } },
    select: { id: true, user: { select: { id: true, email: true } } },
    take: 50,
  })
  for (const a of waiting) {
    const claimed = await db.teacherApplication.updateMany({ where: { id: a.id, status: "PENDING", applicantNudgedAt: null }, data: { applicantNudgedAt: now } })
    if (claimed.count !== 1) continue
    out.applicantNudges++
    await tell(a.user, "Başvurun inceleniyor", "Eğitmen başvurun hâlâ ekibimizin incelemesinde; beklettiğimiz için üzgünüz. Sonuç çıktığında burada ve e-postayla haber vereceğiz.", "/become-teacher")
  }
  return out
}
