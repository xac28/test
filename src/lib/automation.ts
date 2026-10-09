import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { notify, notifyAdminsInApp } from "@/lib/notifications"
import { SITE_URL } from "@/lib/site"
import { sendCampaign } from "@/lib/newsletter"
import { LOW_STOCK, formatKurus } from "@/lib/shop"
import { NEWS_CATEGORIES, NON_EDITORIAL_CATEGORIES } from "@/lib/articles"
import { OPEN_STATUSES } from "@/lib/reports"

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

export interface AdminDigest { items: { label: string; count: number; href: string }[]; total: number; emailed: boolean }

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
  let emailed = false
  if (total > 0) {
    await notifyAdminsInApp("Günlük özet", items.map((i) => `${i.count} ${i.label.toLowerCase()}`).join(", ").slice(0, 380), "/admin")
    if (process.env.ADMIN_EMAIL) {
      const r = await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `AYA günlük özet: ${total} bekleyen iş`,
        html: frame(`<p>Günaydın! Bekleyen işler:</p><ul>${items.map((i) => `<li><a href="${SITE_URL}${i.href}" style="color:#1f62bf">${i.count} · ${esc(i.label)}</a></li>`).join("")}</ul><p style="color:#5a6f87;font-size:13px">Son 24 saatte ${newUsers} yeni üye.</p>`),
      })
      emailed = !!r.success
    }
  }
  return { items, total, emailed }
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
