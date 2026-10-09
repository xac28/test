import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { SITE_URL } from "@/lib/site"
import { randomBytes } from "crypto"

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const normalizeEmail = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "")

const token = () => randomBytes(18).toString("hex")

/** Adds an address (or re-activates one that unsubscribed). Idempotent. */
export async function subscribe(email: string, source?: string) {
  const row = await db.newsletterSubscriber.findUnique({ where: { email } })
  if (!row) {
    return db.newsletterSubscriber.create({ data: { email, unsubscribeToken: token(), source: source?.slice(0, 60) || null } })
  }
  return db.newsletterSubscriber.update({
    where: { email },
    data: { unsubscribedAt: null, unsubscribeToken: row.unsubscribeToken ?? token() },
  })
}

export async function unsubscribeByToken(t: string): Promise<boolean> {
  if (!/^[a-z0-9]{16,64}$/i.test(t)) return false
  const res = await db.newsletterSubscriber.updateMany({ where: { unsubscribeToken: t, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } })
  if (res.count > 0) return true
  return (await db.newsletterSubscriber.count({ where: { unsubscribeToken: t } })) > 0
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string))

/** Plain text (blank line = paragraph, bare URLs become links) in the AYA mail frame, with an unsubscribe footer. */
export function renderMail(body: string, unsubUrl: string, cta?: { label: string; href: string }) {
  const paras = body.trim().split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px;line-height:1.6">${esc(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1f62bf">$1</a>')}</p>`,
  ).join("")
  const button = cta ? `<p style="margin:24px 0"><a href="${esc(cta.href)}" style="background:#2f7de1;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${esc(cta.label)}</a></p>` : ""
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0c2a4a">
<h2 style="letter-spacing:.28em;font-weight:500;color:#0c2a4a">AYA</h2>${paras}${button}
<hr style="border:none;border-top:1px solid #d4e3f3;margin:28px 0 12px">
<p style="font-size:12px;color:#5a6f87">Bu e-postayı AYA bültenine abone olduğunuz için aldınız. <a href="${esc(unsubUrl)}" style="color:#5a6f87">Abonelikten çık</a></p></div>`
  const text = `${body.trim()}\n\n${cta ? `${cta.label}: ${cta.href}\n\n` : ""}Abonelikten çık: ${unsubUrl}`
  return { html, text }
}

export const unsubscribeUrl = (t: string) => `${SITE_URL}/bulten/ayril?t=${t}`

export const smtpConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS)

export interface CampaignInput {
  subject: string
  body: string
  kind: "manual" | "article" | "podcast" | "product" | "digest" | "restock"
  refId?: string
  cta?: { label: string; href: string }
  createdById?: string
  /** send to these subscribers only (still skipping the ones who unsubscribed) */
  onlyIds?: string[]
}

/** Sends to every active subscriber (a few at a time) and records the result. Without SMTP nothing is sent and the log says so. */
export async function sendCampaign(c: CampaignInput) {
  const subs = await db.newsletterSubscriber.findMany({ where: { unsubscribedAt: null, ...(c.onlyIds ? { id: { in: c.onlyIds } } : {}) }, select: { id: true, email: true, unsubscribeToken: true } })
  if (!smtpConfigured()) {
    const campaign = await db.newsletterCampaign.create({ data: { subject: c.subject.slice(0, 200), body: c.body, kind: c.kind, refId: c.refId, createdById: c.createdById, skipped: true } })
    return { campaign, sent: 0, failed: 0, skipped: true, recipients: subs.length }
  }
  let sent = 0, failed = 0
  const queue = [...subs]
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      let t = s.unsubscribeToken
      if (!t) {
        t = token()
        await db.newsletterSubscriber.update({ where: { id: s.id }, data: { unsubscribeToken: t } })
      }
      const m = renderMail(c.body, unsubscribeUrl(t), c.cta)
      const r = await sendEmail({ to: s.email, subject: c.subject, html: m.html, text: m.text })
      if (r.success) sent++
      else failed++
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  const campaign = await db.newsletterCampaign.create({ data: { subject: c.subject.slice(0, 200), body: c.body, kind: c.kind, refId: c.refId, createdById: c.createdById, sentCount: sent, failedCount: failed } })
  return { campaign, sent, failed, skipped: false, recipients: subs.length }
}

/** One test mail to the admin's own address. */
export async function sendTest(to: string, subject: string, body: string, cta?: { label: string; href: string }) {
  const m = renderMail(body, `${SITE_URL}/bulten/ayril?t=test`, cta)
  return sendEmail({ to, subject: `[TEST] ${subject}`, html: m.html, text: m.text })
}
