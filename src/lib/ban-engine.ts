/**
 * 🛡️ AYA Ban Engine — IP Ban & Evasion Detection System
 * 
 * Merkezi ban motoru. Tüm ban kontrolleri, IP loglama ve evasion tespiti
 * bu modül üzerinden yapılır. Auth, register ve admin endpoint'leri bu
 * modülü kullanır.
 * 
 * Capabilities:
 * ─ IP ban kontrolü (kalıcı + süreli)
 * ─ Kullanıcı IP geçmişi loglama
 * ─ Ban evasion tespiti (IP, email pattern, telefon)
 * ─ Ban uygulandığında tüm bilinen IP'leri otomatik banlama
 * ─ Evasion girişimlerini loglama
 */

import { db } from "@/lib/db"
import { endLiveRoom } from "@/lib/live-rooms"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BanCheckResult {
  banned: boolean
  reason?: string
  matchType?: "IP_BAN" | "USER_BAN" | "EVASION_IP" | "EVASION_EMAIL" | "EVASION_PHONE"
  matchedUserId?: string
}

export interface EvasionCheckInput {
  ip: string
  email?: string | null
  phone?: string | null
  name?: string | null
  userAgent?: string | null
}

// ─── IP Extraction ──────────────────────────────────────────────────────────

/**
 * Request'ten gerçek IP adresini çıkarır.
 * Proxy/load balancer arkasında da doğru çalışır.
 */
export function extractIp(req: Request): string {
  // X-Forwarded-For zincirindeki ilk IP (gerçek client)
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim()
    if (firstIp && firstIp !== "::1") return firstIp
  }

  // X-Real-IP (Nginx)
  const realIp = req.headers.get("x-real-ip")
  if (realIp && realIp !== "::1") return realIp

  // Fallback
  return "127.0.0.1"
}

/**
 * Automatic IP bans must never hit loopback / private / unknown addresses: behind a proxy or a
 * shared network those belong to everybody, and banning them would lock every user out.
 */
export function isBannableIp(ip: string): boolean {
  if (!ip || ip === "unknown" || ip === "::1" || ip === "localhost") return false
  if (/^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) return false
  const m = /^172\.(\d+)\./.exec(ip)
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return false
  if (/^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) return false
  return true
}

// ─── IP Ban Check ───────────────────────────────────────────────────────────

/**
 * Bir IP adresinin banlı olup olmadığını kontrol eder.
 * Süresi dolmuş banları otomatik devre dışı bırakır.
 */
export async function isIpBanned(ip: string): Promise<BanCheckResult> {
  try {
    const bans = await db.ipBan.findMany({
      where: {
        ipAddress: ip,
        isActive: true,
      }
    })

    if (bans.length === 0) {
      return { banned: false }
    }

    // Süresi dolmuş banları temizle
    const now = new Date()
    const activeBan = bans.find(ban => {
      if (ban.expiresAt && ban.expiresAt < now) {
        // Süresi dolmuş — devre dışı bırak (async, bloklamaz)
        db.ipBan.update({
          where: { id: ban.id },
          data: { isActive: false }
        }).catch(() => {})
        return false
      }
      return true
    })

    if (!activeBan) {
      return { banned: false }
    }

    return {
      banned: true,
      reason: activeBan.reason || "IP adresi banlanmış",
      matchType: "IP_BAN",
      matchedUserId: activeBan.bannedUserId || undefined,
    }
  } catch (error) {
    console.error("[BAN_ENGINE] IP ban check error:", error)
    return { banned: false } // Hata durumunda geçişe izin ver (fail-open)
  }
}

// ─── User Ban Check ─────────────────────────────────────────────────────────

/**
 * Bir kullanıcının email'i üzerinden ban kontrolü.
 * Kullanıcı var ve banned=true ise engeller.
 */
export async function isUserBanned(email: string): Promise<BanCheckResult> {
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, banned: true, banReason: true }
    })

    if (user && user.banned) {
      return {
        banned: true,
        reason: user.banReason || "Hesabınız askıya alınmıştır",
        matchType: "USER_BAN",
        matchedUserId: user.id,
      }
    }

    return { banned: false }
  } catch {
    return { banned: false }
  }
}

// ─── IP Logging ─────────────────────────────────────────────────────────────

/**
 * Kullanıcının IP adresini loglar. Aynı IP tekrar görülürse sadece
 * lastSeenAt ve hitCount güncellenir (upsert).
 */
export async function logUserIp(
  userId: string, 
  ip: string, 
  userAgent?: string | null
): Promise<void> {
  try {
    await db.userIpLog.upsert({
      where: {
        userId_ipAddress: { userId, ipAddress: ip }
      },
      update: {
        lastSeenAt: new Date(),
        hitCount: { increment: 1 },
        userAgent: userAgent || undefined,
      },
      create: {
        userId,
        ipAddress: ip,
        userAgent: userAgent || null,
      }
    })
  } catch (error) {
    // IP log hatası kritik değil — uygulamayı durdurma
    console.error("[BAN_ENGINE] IP log error:", error)
  }
}

// ─── Ban Evasion Detection ──────────────────────────────────────────────────

/**
 * Yeni hesap açma girişiminde ban evasion kontrolü yapar.
 * 
 * Kontrol katmanları:
 * 1. IP adresi banlı mı?
 * 2. Bu IP, daha önce banlı bir kullanıcı tarafından kullanılmış mı?
 * 3. Email domain + benzeri isim paterni var mı?
 * 4. Aynı telefon numarasıyla banlı kullanıcı var mı?
 */
export async function checkBanEvasion(input: EvasionCheckInput): Promise<BanCheckResult> {
  const { ip, email, phone, name, userAgent } = input

  // ── Layer 1: Direkt IP ban kontrolü ──
  const ipBanResult = await isIpBanned(ip)
  if (ipBanResult.banned) {
    await logEvasionAttempt(input, "IP_BAN", ipBanResult.matchedUserId)
    return ipBanResult
  }

  // ── Layer 2: Bu IP'yi daha önce banlı bir kullanıcı kullanmış mı? ──
  try {
    const ipLogs = await db.userIpLog.findMany({
      where: { ipAddress: ip }
    })

    if (ipLogs.length > 0) {
      const userIds = ipLogs.map(log => log.userId)
      
      const bannedUsers = await db.user.findMany({
        where: {
          id: { in: userIds },
          banned: true,
        },
        select: { id: true, email: true, banReason: true, phone: true, name: true }
      })

      if (bannedUsers.length > 0) {
        const matchedUser = bannedUsers[0]
        await logEvasionAttempt(input, "EVASION_IP", matchedUser.id)
        
        // Bu IP'yi de banla (gelecekte direkt yakalanması için)
        await banIpAddress(
          ip,
          `Banlı kullanıcı ile aynı IP (${matchedUser.email})`,
          matchedUser.id,
          undefined
        )

        return {
          banned: true,
          reason: "Bu ağdan daha önce kurallara aykırı davranış tespit edilmiştir",
          matchType: "EVASION_IP",
          matchedUserId: matchedUser.id,
        }
      }
    }
  } catch (error) {
    console.error("[BAN_ENGINE] IP evasion check error:", error)
  }

  // ── Layer 3: Telefon numarası kontrolü ──
  if (phone) {
    try {
      const normalizedPhone = normalizePhone(phone)
      if (normalizedPhone) {
        const bannedByPhone = await db.user.findFirst({
          where: {
            phone: normalizedPhone,
            banned: true,
          },
          select: { id: true, email: true, banReason: true }
        })

        if (bannedByPhone) {
          await logEvasionAttempt(input, "PHONE_MATCH", bannedByPhone.id)
          
          // Bu IP'yi de banla
          await banIpAddress(
            ip,
            `Banlı kullanıcı ile aynı telefon (${bannedByPhone.email})`,
            bannedByPhone.id,
            undefined
          )

          return {
            banned: true,
            reason: "Bu bilgilerle daha önce kurallara aykırı davranış tespit edilmiştir",
            matchType: "EVASION_PHONE",
            matchedUserId: bannedByPhone.id,
          }
        }
      }
    } catch (error) {
      console.error("[BAN_ENGINE] Phone evasion check error:", error)
    }
  }

  // ── Layer 4: Email domain + pattern kontrolü ──
  if (email) {
    try {
      // Aynı email kullanıyorsa (email zaten banned check'te yakalanır ama
      // "+" alias trick'i gibi durumları yakalamak için)
      const baseEmail = normalizeEmailForBan(email)
      
      const bannedByEmail = await db.user.findFirst({
        where: {
          banned: true,
          email: { not: null }
        },
        select: { id: true, email: true }
      })

      // E-posta benzerliği kontrolü (gmail+alias gibi)
      if (bannedByEmail?.email) {
        const bannedBaseEmail = normalizeEmailForBan(bannedByEmail.email)
        if (baseEmail === bannedBaseEmail && email !== bannedByEmail.email) {
          await logEvasionAttempt(input, "EMAIL_DOMAIN", bannedByEmail.id)
          
          await banIpAddress(
            ip,
            `Banlı kullanıcı email alias tespiti (${bannedByEmail.email})`,
            bannedByEmail.id,
            undefined
          )

          return {
            banned: true,
            reason: "Bu e-posta bilgileriyle daha önce kurallara aykırı davranış tespit edilmiştir",
            matchType: "EVASION_EMAIL",
            matchedUserId: bannedByEmail.id,
          }
        }
      }
    } catch (error) {
      console.error("[BAN_ENGINE] Email evasion check error:", error)
    }
  }

  return { banned: false }
}

// ─── Ban Application ────────────────────────────────────────────────────────

/**
 * Bir IP adresini banlar.
 */
export async function banIpAddress(
  ip: string,
  reason: string,
  bannedUserId?: string,
  bannedByAdminId?: string,
  expiresAt?: Date
): Promise<void> {
  try {
    // Aynı IP zaten banlıysa tekrar ekleme
    const existing = await db.ipBan.findFirst({
      where: {
        ipAddress: ip,
        isActive: true,
      }
    })

    if (existing) return

    await db.ipBan.create({
      data: {
        ipAddress: ip,
        reason,
        bannedUserId: bannedUserId || null,
        bannedByAdminId: bannedByAdminId || null,
        isActive: true,
        expiresAt: expiresAt || null,
      }
    })

    console.log(`[BAN_ENGINE] IP banned: ${ip} — ${reason}`)
  } catch (error) {
    console.error("[BAN_ENGINE] Failed to ban IP:", error)
  }
}

/**
 * Bir kullanıcıyı banlarken tüm bilinen IP'lerini de otomatik banlar.
 * Admin ban endpoint'i bu fonksiyonu çağırır.
 */
export async function applyFullBan(
  userId: string,
  reason: string,
  adminId: string
): Promise<{ ipsBanned: number; sessionsClosed: number }> {
  // 1. Kullanıcıyı soft-ban
  await db.user.update({
    where: { id: userId },
    data: {
      banned: true,
      banReason: reason,
      bannedAt: new Date(),
    }
  })

  // 2. Aktif booking'leri iptal et
  await db.booking.updateMany({
    where: {
      studentId: userId,
      status: { in: ["PENDING", "CONFIRMED"] }
    },
    data: { status: "CANCELLED" }
  })

  // 2b. Eğitmense: öğrencileriyle olan dersleri iptal et, canlı yayınlarını kapat, atölyelerini yayından kaldır
  const teacher = await db.teacher.findUnique({ where: { userId } })
  if (teacher) {
    await db.booking.updateMany({
      where: { teacherId: teacher.id, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    })
    const rooms = await db.liveRoom.findMany({ where: { teacherId: teacher.id, isActive: true }, select: { id: true } })
    for (const r of rooms) await endLiveRoom(r.id).catch(() => {})
    await db.workshop.updateMany({ where: { teacherId: teacher.id, status: "PUBLISHED" }, data: { status: "DRAFT" } })
  }

  // 3. Tüm aktif session'ları sil (anlık oturumu düşür)
  const sessionsResult = await db.session.deleteMany({
    where: { userId }
  })

  // 4. Kullanıcının bilinen tüm IP'lerini banla
  const ipLogs = await db.userIpLog.findMany({
    where: { userId }
  })

  let ipsBanned = 0
  for (const log of ipLogs) {
    if (!isBannableIp(log.ipAddress)) continue
    const existing = await db.ipBan.findFirst({
      where: { ipAddress: log.ipAddress, isActive: true }
    })

    if (!existing) {
      await db.ipBan.create({
        data: {
          ipAddress: log.ipAddress,
          reason: `Auto-ban: Kullanıcı ${userId} banlandı — ${reason}`,
          bannedUserId: userId,
          bannedByAdminId: adminId,
          isActive: true,
        }
      })
      ipsBanned++
    }
  }

  // 5. Audit log
  await db.auditLog.create({
    data: {
      actorId: adminId,
      action: "BAN_USER",
      targetId: userId,
      reason: `${reason} | ${ipsBanned} IP banned, ${sessionsResult.count} sessions closed`,
    }
  })

  console.log(`[BAN_ENGINE] Full ban applied: user=${userId}, IPs=${ipsBanned}, sessions=${sessionsResult.count}`)

  return { ipsBanned, sessionsClosed: sessionsResult.count }
}

/**
 * Bir kullanıcının banını kaldırır ve ilgili IP banlarını devre dışı bırakır.
 */
export async function applyFullUnban(
  userId: string,
  adminId: string
): Promise<{ ipsUnbanned: number }> {
  // 1. Kullanıcı banını kaldır
  await db.user.update({
    where: { id: userId },
    data: {
      banned: false,
      banReason: null,
      bannedAt: null,
    }
  })

  // 2. Bu kullanıcıyla ilişkili IP banlarını kaldır
  const result = await db.ipBan.updateMany({
    where: {
      bannedUserId: userId,
      isActive: true,
    },
    data: { isActive: false }
  })

  // 3. Audit log
  await db.auditLog.create({
    data: {
      actorId: adminId,
      action: "UNBAN_USER",
      targetId: userId,
      reason: `Unbanned — ${result.count} IP bans lifted`,
    }
  })

  console.log(`[BAN_ENGINE] Full unban: user=${userId}, IPs unbanned=${result.count}`)

  return { ipsUnbanned: result.count }
}

// ─── Evasion Logging ────────────────────────────────────────────────────────

/**
 * Ban evasion girişimini loglar. Admin panelden izlenebilir.
 */
async function logEvasionAttempt(
  input: EvasionCheckInput,
  matchType: string,
  matchedUserId?: string
): Promise<void> {
  try {
    await db.banEvasionLog.create({
      data: {
        ipAddress: input.ip,
        attemptedEmail: input.email || null,
        attemptedName: input.name || null,
        attemptedPhone: input.phone || null,
        matchType,
        matchedUserId: matchedUserId || null,
        blocked: true,
        userAgent: input.userAgent || null,
      }
    })
    console.log(`[BAN_ENGINE] 🚨 Evasion attempt blocked: ${matchType} from ${input.ip}`)
  } catch (error) {
    console.error("[BAN_ENGINE] Failed to log evasion:", error)
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Gmail/Outlook "+" alias trick'ini normalleştirir.
 * örn: user+spam@gmail.com → user@gmail.com
 */
function normalizeEmailForBan(email: string): string {
  const [localPart, domain] = email.toLowerCase().split("@")
  if (!domain) return email.toLowerCase()

  // Gmail: noktaları kaldır + alias'ı kaldır
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const cleanLocal = localPart.split("+")[0].replace(/\./g, "")
    return `${cleanLocal}@gmail.com`
  }

  // Diğer sağlayıcılar: sadece + alias'ı kaldır
  const cleanLocal = localPart.split("+")[0]
  return `${cleanLocal}@${domain}`
}

/**
 * Telefon numarasını normalleştirir.
 */
function normalizePhone(phone: string): string | null {
  // Sadece rakamları al
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) return null

  // Türkiye numara formatı: 05xx → 90 5xx
  if (digits.startsWith("0") && digits.length === 11) {
    return "90" + digits.slice(1)
  }
  if (digits.startsWith("90") && digits.length === 12) {
    return digits
  }

  return digits
}
