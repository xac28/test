import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { CSV_LIMIT, pageOf, requireAdmin, wantsCsv } from "@/lib/admin-api"
import { toCsv } from "@/lib/csv"
import { EMAIL_RE, normalizeEmail, sendCampaign, sendTest, smtpConfigured, subscribe } from "@/lib/newsletter"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "active"
  const q = (url.searchParams.get("q") || "").trim()
  const where = {
    ...(status === "active" ? { unsubscribedAt: null } : status === "unsub" ? { unsubscribedAt: { not: null } } : {}),
    ...(q ? { email: { contains: q } } : {}),
  }
  const { page, size, skip } = pageOf(url, 25)

  if (wantsCsv(url)) {
    const rows = await db.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, take: CSV_LIMIT })
    const csv = toCsv(["E-posta", "Kaynak", "Katılma", "Durum"], rows.map((r) => [r.email, r.source ?? "", r.createdAt.toISOString(), r.unsubscribedAt ? "ayrıldı" : "aktif"]))
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="bulten-aboneleri.csv"' } })
  }

  const [subscribers, total, active, unsub, campaigns] = await Promise.all([
    db.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: size }),
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: { not: null } } }),
    db.newsletterCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
  ])
  return NextResponse.json({ subscribers: subscribers.map(({ unsubscribeToken, ...r }) => r), total, page, pageSize: size, counts: { active, unsub }, campaigns, smtp: smtpConfigured() })
}

export async function POST(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const body = await req.json().catch(() => ({}))

  if (body.action === "add") {
    const emails = [...new Set(String(body.emails ?? "").split(/[\s,;]+/).map(normalizeEmail).filter(Boolean))]
    const valid = emails.filter((e) => e.length <= 190 && EMAIL_RE.test(e)).slice(0, 2000)
    for (const e of valid) await subscribe(e, "admin")
    return NextResponse.json({ success: true, added: valid.length, invalid: emails.length - valid.length })
  }

  if (body.action === "send" || body.action === "test") {
    const subject = typeof body.subject === "string" ? body.subject.trim() : ""
    const text = typeof body.body === "string" ? body.body.trim() : ""
    if (subject.length < 3 || subject.length > 200) return NextResponse.json({ error: "Konu 3–200 karakter olmalı." }, { status: 400 })
    if (text.length < 10 || text.length > 20_000) return NextResponse.json({ error: "İleti en az 10 karakter olmalı." }, { status: 400 })
    const ctaLabel = typeof body.ctaLabel === "string" ? body.ctaLabel.trim().slice(0, 60) : ""
    const ctaHref = typeof body.ctaHref === "string" ? body.ctaHref.trim() : ""
    if (ctaHref && !/^https?:\/\/[^\s]+$/i.test(ctaHref)) return NextResponse.json({ error: "Düğme bağlantısı http(s):// ile başlamalı." }, { status: 400 })
    const cta = ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : undefined

    if (body.action === "test") {
      if (!smtpConfigured()) return NextResponse.json({ error: "E-posta (SMTP) ayarı yapılmamış: SMTP_USER ve SMTP_PASS tanımlayın." }, { status: 409 })
      const r = await sendTest(a.admin.email ?? "", subject, text, cta)
      return r.success ? NextResponse.json({ success: true, to: a.admin.email }) : NextResponse.json({ error: "Test e-postası gönderilemedi." }, { status: 502 })
    }
    const result = await sendCampaign({ subject, body: text, kind: "manual", cta, createdById: a.admin.id })
    await db.auditLog.create({ data: { actorId: a.admin.id, action: "NEWSLETTER_SEND", targetId: result.campaign.id, reason: `${subject} (${result.sent}/${result.recipients})`.slice(0, 300) } })
    return NextResponse.json({ success: true, sent: result.sent, failed: result.failed, skipped: result.skipped, recipients: result.recipients })
  }
  return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
}
