import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notify, notifyAdminsInApp } from "@/lib/notifications"
import { logEvent } from "@/lib/event-log"
import { sendEmail } from "@/lib/email"
import { applyFullBan } from "@/lib/ban-engine"
import { endLiveRoom } from "@/lib/live-rooms"
import { POACH_LABEL_TR, PoachKind, PoachResult, poachKindsLabel, scanPoaching } from "@/lib/poaching"

/**
 * The ladder for taking students off the platform (teachers only):
 *   1st violation  → official warning
 *   2nd violation  → 10 days off (hidden from listings, cannot teach, post or message)
 *   3rd violation  → permanent ban
 * Retrying the same message within 30 minutes is logged but does not count as a new violation, and admins can
 * forgive a violation (e.g. a false positive), which lowers the count again.
 */
import { SUSPEND_DAYS } from "@/lib/policy-ladder"
export { SUSPEND_DAYS }
export const COUNT_WINDOW_MS = 30 * 60_000
export { POLICY_LADDER_TR } from "@/lib/policy-ladder"

export type PolicyAction = "NONE" | "WARNED" | "SUSPENDED" | "BANNED"
export interface PolicyOutcome { strike: number; action: PolicyAction; counted: boolean; until: Date | null; kinds: PoachKind[] }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** An actor for automatic actions in the audit trail: the first admin account. */
async function systemActor(): Promise<string | null> {
  const a = await db.user.findFirst({ where: { role: "ADMIN", banned: false }, orderBy: { createdAt: "asc" }, select: { id: true } })
  return a?.id ?? null
}

export async function activeStrikes(userId: string): Promise<number> {
  return db.policyViolation.count({ where: { userId, counted: true, forgiven: false } })
}

/** Log a blocked attempt and apply the ladder. Never throws to the caller's detriment. */
export async function recordViolation(args: { userId: string; surface: string; poach: PoachResult; text: string }): Promise<PolicyOutcome> {
  const { userId, surface, poach, text } = args
  const kinds = poach.kinds
  const recent = await db.policyViolation.findFirst({ where: { userId, counted: true, createdAt: { gte: new Date(Date.now() - COUNT_WINDOW_MS) } }, select: { id: true, strike: true, action: true } })
  const prior = await activeStrikes(userId)
  const counted = !recent
  const strike = counted ? prior + 1 : Math.max(prior, 1)
  const action: PolicyAction = !counted ? "NONE" : strike >= 3 ? "BANNED" : strike === 2 ? "SUSPENDED" : "WARNED"
  const until = action === "SUSPENDED" ? new Date(Date.now() + SUSPEND_DAYS * 86_400_000) : null

  const row = await db.policyViolation.create({
    data: { userId, surface, kinds: kinds.join(","), excerpt: text.replace(/\s+/g, " ").trim().slice(0, 240), counted, strike: counted ? strike : null, action },
  })
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  logEvent({ type: "SECURITY", level: counted ? "warn" : "info", message: `Platform dışı yönlendirme engellendi (${surface}): ${poachKindsLabel(kinds)}${counted ? ` — ${strike}. ihlal, ${action}` : " — tekrar, sayılmadı"}`, userId, meta: { violationId: row.id, matches: poach.matches } })
  if (!counted) return { strike, action, counted, until: null, kinds }

  const reasonShort = `Platform dışına yönlendirme (${poachKindsLabel(kinds)})`
  if (action === "WARNED") {
    await db.userWarning.create({
      data: {
        userId, issuedById: "system",
        message: `Paylaşmaya çalıştığın içerik platform dışına yönlendirme (${poachKindsLabel(kinds)}) içerdiği için engellendi. AYA'da öğrencilerle iletişim ve ödeme yalnızca platform üzerinden yapılır; sosyal medya, telefon, WhatsApp, kendi kursuna davet gibi paylaşımlar kurallara aykırıdır. Bu 1. ihlalin: resmi uyarı. 2. ihlalde ${SUSPEND_DAYS} gün uzaklaştırılırsın, 3. ihlalde hesabın kalıcı olarak kapatılır.`,
      },
    })
    await notify({ userId, type: "WARNING", title: "Platform dışı yönlendirme uyarısı", body: "İçeriğin engellendi. Tekrarında 10 gün uzaklaştırılırsın.", href: "/dashboard" })
    if (user?.email) sendEmail({ to: user.email, subject: "AYA: Platform kuralları hakkında uyarı", html: `<p>Merhaba ${esc(user.name ?? "")},</p><p>Paylaşmaya çalıştığınız içerik platform dışına yönlendirme içerdiği için engellendi. AYA'da iletişim ve ödemeler yalnızca platform üzerinden yapılır.</p><p><b>Bu 1. ihlaliniz: resmi uyarı.</b> 2. ihlalde ${SUSPEND_DAYS} gün uzaklaştırma, 3. ihlalde kalıcı hesap kapatma uygulanır.</p><p>AYA Ekibi</p>` }).catch(() => {})
  } else if (action === "SUSPENDED") {
    await db.user.update({ where: { id: userId }, data: { suspendedUntil: until, suspensionReason: reasonShort } })
    const teacher = await db.teacher.findUnique({ where: { userId }, select: { id: true } })
    if (teacher) {
      const rooms = await db.liveRoom.findMany({ where: { teacherId: teacher.id, isActive: true }, select: { id: true } })
      for (const r of rooms) await endLiveRoom(r.id).catch(() => {})
    }
    await db.userWarning.create({ data: { userId, issuedById: "system", message: `Platform dışına yönlendirmeyi tekrarladığın için ${SUSPEND_DAYS} gün uzaklaştırıldın (${until!.toLocaleDateString("tr-TR")} tarihine kadar). Bu sürede profilin listelerde görünmez; ders, yayın, atölye açamaz, mesaj ve paylaşım yapamazsın. Bir sonraki ihlalde hesabın kalıcı olarak kapatılır.` } })
    await notify({ userId, type: "WARNING", title: `${SUSPEND_DAYS} gün uzaklaştırıldın`, body: "Platform dışına yönlendirme tekrarlandı. Bir sonraki ihlal kalıcı banla sonuçlanır.", href: "/dashboard" })
    if (user?.email) sendEmail({ to: user.email, subject: "AYA: Hesabınız 10 gün uzaklaştırıldı", html: `<p>Merhaba ${esc(user.name ?? "")},</p><p>Platform dışına yönlendirmeyi tekrarladığınız için hesabınız <b>${SUSPEND_DAYS} gün</b> uzaklaştırıldı (${until!.toLocaleDateString("tr-TR")} tarihine kadar). Bir sonraki ihlalde hesabınız kalıcı olarak kapatılır.</p><p>AYA Ekibi</p>` }).catch(() => {})
    await notifyAdminsInApp("Eğitmen 10 gün uzaklaştırıldı", `${user?.name ?? "Bir eğitmen"}: ${reasonShort}`, "/admin?tab=policy")
  } else if (action === "BANNED") {
    const actor = await systemActor()
    const reason = `Otomatik: platform dışına yönlendirme (3. ihlal) — ${poachKindsLabel(kinds)}`
    if (actor) await applyFullBan(userId, reason, actor).catch(() => {})
    else await db.user.update({ where: { id: userId }, data: { banned: true, banReason: reason, bannedAt: new Date() } })
    await notifyAdminsInApp("Eğitmen kalıcı olarak yasaklandı (otomatik)", `${user?.name ?? "Bir eğitmen"}: 3. platform dışı yönlendirme ihlali`, "/admin?tab=policy")
  }
  return { strike, action, counted, until, kinds }
}

/** What the person who triggered it is told. */
export function violationMessage(o: PolicyOutcome): string {
  const what = poachKindsLabel(o.kinds)
  if (!o.counted) return `Bu içerik platform dışına yönlendirme (${what}) içerdiği için yine yayınlanmadı. (Aynı denemenin tekrarı yeni ihlal sayılmadı.)`
  if (o.action === "WARNED") return `Bu içerik platform dışına yönlendirme (${what}) içerdiği için yayınlanmadı. AYA'da öğrencilerle iletişim ve ödeme yalnızca platform üzerinden yapılır. Bu 1. ihlalin: resmi uyarı aldın. 2. ihlalde ${SUSPEND_DAYS} gün uzaklaştırılırsın, 3. ihlalde hesabın kalıcı olarak kapatılır.`
  if (o.action === "SUSPENDED") return `Platform dışına yönlendirmeyi tekrarladığın için ${SUSPEND_DAYS} gün uzaklaştırıldın (${o.until!.toLocaleDateString("tr-TR")} tarihine kadar). Bir sonraki ihlalde hesabın kalıcı olarak kapatılır.`
  return "Platform dışına yönlendirmeyi üçüncü kez tekrarladığın için hesabın kalıcı olarak kapatıldı."
}

/** Scan text a teacher is about to publish; null = fine, otherwise the violation was recorded. */
export async function enforceTeacherText(user: { id: string; role?: string | null }, texts: (string | null | undefined)[], surface: string): Promise<{ status: number; error: string; code: "POLICY"; policy: PolicyOutcome } | null> {
  if (user.role !== "TEACHER") return null
  const joined = texts.filter((t): t is string => !!t && !!t.trim()).join(" \n ")
  if (!joined) return null
  const poach = scanPoaching(joined, { teacher: true })
  if (poach.clean) return null
  const policy = await recordViolation({ userId: user.id, surface, poach, text: joined })
  return { status: policy.action === "BANNED" || policy.action === "SUSPENDED" ? 403 : 422, error: violationMessage(policy), code: "POLICY", policy }
}

export async function suspensionOf(userId: string): Promise<{ until: Date; reason: string | null } | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { suspendedUntil: true, suspensionReason: true } })
  return u?.suspendedUntil && u.suspendedUntil.getTime() > Date.now() ? { until: u.suspendedUntil, reason: u.suspensionReason } : null
}

/** 403 for a suspended teacher who tries to act (teach, post, message). */
export async function suspensionGate(userId: string): Promise<NextResponse | null> {
  const s = await suspensionOf(userId)
  if (!s) return null
  return NextResponse.json({ error: `Hesabın ${s.until.toLocaleDateString("tr-TR")} tarihine kadar uzaklaştırıldı: bu sürede bu işlemi yapamazsın.`, code: "SUSPENDED", until: s.until }, { status: 403 })
}

/** Prisma filter: teachers that are not currently suspended (for listings, search, recommendations). */
export const notSuspended = () => ({ OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: new Date() } }] })

export { POACH_LABEL_TR }
