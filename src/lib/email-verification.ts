import crypto from "crypto"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SITE_URL } from "@/lib/site"
import { sendEmail } from "@/lib/email"

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
export const VERIFY_COOLDOWN_MS = 60 * 1000

const identifier = (userId: string) => `verify:${userId}`
export const hashVerifyToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex")
export const verifyLink = (token: string) => `${SITE_URL}/verify-email?token=${token}`

/** Is the "verified e-mail" requirement switched on? (off by default so that development and old accounts keep working) */
export const emailVerificationRequired = () => process.env.REQUIRE_EMAIL_VERIFICATION === "true"

/** Creates a fresh one-day link (older ones die) and mails it. Returns false when the cooldown says "not yet". */
export async function sendVerification(user: { id: string; email: string | null; name?: string | null }): Promise<boolean> {
  if (!user.email) return false
  const latest = await db.verificationToken.findFirst({ where: { identifier: identifier(user.id) }, orderBy: { expires: "desc" } })
  if (latest && latest.expires.getTime() - VERIFY_TTL_MS > Date.now() - VERIFY_COOLDOWN_MS) return false
  await db.verificationToken.deleteMany({ where: { identifier: identifier(user.id) } })
  const token = crypto.randomBytes(32).toString("hex")
  await db.verificationToken.create({ data: { identifier: identifier(user.id), token: hashVerifyToken(token), expires: new Date(Date.now() + VERIFY_TTL_MS) } })
  const link = verifyLink(token)
  const who = user.name ? ` ${user.name}` : ""
  const sent = await sendEmail({
    to: user.email,
    subject: "AYA: e-posta adresini doğrula",
    text: `Merhaba${who},\n\nAYA hesabını doğrulamak için bağlantıya tıkla (24 saat geçerli):\n${link}\n\nBu hesabı sen açmadıysan e-postayı yok sayabilirsin.\n\nAYA`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#17433f"><h2 style="font-weight:400">AYA</h2><p>Merhaba${who},</p><p>Hesabını doğrulamak için aşağıdaki düğmeye tıkla. Bağlantı <strong>24 saat</strong> geçerlidir.</p><p><a href="${link}" style="display:inline-block;background:#e2684a;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">E-postamı doğrula</a></p><p style="color:#4d6764;font-size:14px">Düğme çalışmıyorsa şu adresi tarayıcına yapıştır:<br>${link}</p><p style="color:#4d6764;font-size:14px">Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.</p></div>`,
  })
  if (!sent.success && process.env.NODE_ENV !== "production") console.warn(`[EMAIL_VERIFY] ${user.email}: ${link}`)
  return true
}

/** Consumes a link. Returns the verified user's id, or null for a wrong / expired / spent link. */
export async function consumeVerification(token: string): Promise<string | null> {
  if (token.length < 20 || token.length > 200) return null
  const row = await db.verificationToken.findUnique({ where: { token: hashVerifyToken(token) } })
  if (!row || !row.identifier.startsWith("verify:") || row.expires <= new Date()) return null
  const claimed = await db.verificationToken.deleteMany({ where: { token: row.token } }) // the delete is the claim: only one request gets count 1
  if (claimed.count !== 1) return null
  const userId = row.identifier.slice("verify:".length)
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true } })
  if (!user || user.deletedAt) return null
  await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } })
  return userId
}

/** For routes that need a verified address (only when REQUIRE_EMAIL_VERIFICATION=true). */
export async function emailGate(userId: string): Promise<NextResponse | null> {
  if (!emailVerificationRequired()) return null
  const row = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true } })
  if (row?.emailVerified) return null
  return NextResponse.json({ error: "Bu işlem için e-posta adresini doğrulaman gerekiyor. Gelen kutundaki bağlantıya tıkla ya da panelden yeniden gönder.", code: "EMAIL_UNVERIFIED" }, { status: 403 })
}
