import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { checkNewBadges, BADGES } from "@/lib/badges"
import { NextResponse } from "next/server"

// ── FIX #1: Cron endpoint artık CRON_SECRET ile korunuyor ──
export async function POST(req: Request) {
  try {
    // Auth: Bearer token veya query param ile CRON_SECRET doğrulaması
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error("[CRON] CRON_SECRET environment variable is not set")
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }

    const token = authHeader?.replace("Bearer ", "")
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized — invalid cron secret" }, { status: 401 })
    }

    const { bookingId } = await req.json()

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 })
    }

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        teacher: { include: { user: true } },
        student: true,
      }
    })

    if (!booking || booking.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Invalid booking or already processed" }, { status: 400 })
    }

    // 1. Mark as COMPLETED
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "COMPLETED" }
    })

    // 2. Gamification: Update student's streak, points, and badges
    const student = booking.student
    const now = new Date()
    const lastSession = student.lastSessionDate
    let newStreak = 1

    if (lastSession) {
      const diffHours = (now.getTime() - lastSession.getTime()) / (1000 * 60 * 60)
      if (diffHours <= 48) {
        // Within 48 hours = streak continues
        newStreak = student.currentStreak + 1
      }
      // If more than 48h, streak resets to 1
    }

    const longestStreak = Math.max(student.longestStreak, newStreak)
    const newPoints = student.points + 50 // 50 points per session

    // Count total completed sessions for badge checks
    const totalSessions = await db.booking.count({
      where: { studentId: student.id, status: "COMPLETED" }
    })

    const totalReviews = await db.review.count({
      where: { booking: { studentId: student.id } }
    })

    const currentBadges: string[] = student.badges ? JSON.parse(student.badges) : []
    const sessionHour = new Date(booking.startTime).getHours()

    const newBadgeIds = checkNewBadges(currentBadges, {
      totalSessions,
      currentStreak: newStreak,
      totalReviews,
      sessionHour,
    })

    const allBadges = [...currentBadges, ...newBadgeIds]

    await db.user.update({
      where: { id: student.id },
      data: {
        points: newPoints,
        currentStreak: newStreak,
        longestStreak: longestStreak,
        lastSessionDate: now,
        badges: JSON.stringify(allBadges),
      }
    })

    // 3. Build new badge notification for email
    const badgeHtml = newBadgeIds.length > 0
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
           <p style="font-size:18px;font-weight:bold;color:#166534;margin:0 0 8px 0;">🎉 Yeni Rozet${newBadgeIds.length > 1 ? 'ler' : ''} Kazandınız!</p>
           ${newBadgeIds.map(id => {
             const b = BADGES.find(x => x.id === id)
             return b ? `<span style="display:inline-block;background:white;border-radius:50px;padding:6px 16px;margin:4px;font-size:14px;border:1px solid #d1d5db;">${b.icon} ${b.nametr}</span>` : ''
           }).join('')}
         </div>`
      : ''

    // 4. Send email to student asking for a review
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #faf6f0; padding: 40px; border-radius: 16px;">
        <h2 style="color: #2c3e38; margin-bottom: 20px;">Dersiniz Sona Erdi! 🧘‍♀️</h2>
        <p style="color: #4a5c56; font-size: 16px; line-height: 1.6;">
          Merhaba ${booking.student.name},<br><br>
          <b>${booking.teacher.user.name}</b> ile olan yoga seansınız tamamlandı. Umarız bedeniniz ve zihniniz için harika bir deneyim olmuştur.
        </p>

        <div style="background:white;border-radius:12px;padding:16px;margin:20px 0;text-align:center;border:1px solid #e2e8f0;">
          <p style="font-size:14px;color:#64748b;margin:0 0 4px 0;">Mevcut Seri</p>
          <p style="font-size:36px;font-weight:bold;color:#3b5249;margin:0;">🔥 ${newStreak} Gün</p>
          <p style="font-size:13px;color:#94a3b8;margin:4px 0 0 0;">${newPoints} Puan · ${allBadges.length} Rozet</p>
        </div>

        ${badgeHtml}

        <p style="color: #4a5c56; font-size: 16px; line-height: 1.6;">
          Öğretmeninizi <b>5 yıldız üzerinden</b> değerlendirerek hem ona destek olabilir hem de diğer öğrencilere rehberlik edebilirsiniz.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background-color: #3b5249; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">
            ⭐ Dersi Değerlendir
          </a>
        </div>
      </div>
    `

    if (booking.student.email) {
      await sendEmail({
        to: booking.student.email,
        subject: `🔥 ${newStreak} Gün Seri! Dersinizi Değerlendirin`,
        html: emailHtml
      })
    }

    return NextResponse.json({ success: true, streak: newStreak, newBadges: newBadgeIds })
  } catch (error) {
    console.error("[CRON_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
