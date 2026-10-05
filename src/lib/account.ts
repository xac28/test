import { db } from "@/lib/db"

export const DELETE_PHRASE = "HESABIMI SİL"

/** Things that must be settled before an account can be closed. Empty list = the account may be deleted. */
export async function deletionBlockers(userId: string): Promise<string[]> {
  const now = new Date()
  const out: string[] = []
  const teacher = await db.teacher.findUnique({ where: { userId }, select: { id: true } })
  const upcoming = await db.booking.count({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, endTime: { gt: now }, OR: [{ studentId: userId }, ...(teacher ? [{ teacherId: teacher.id }] : [])] },
  })
  if (upcoming) out.push(`${upcoming} yaklaşan ders rezervasyonun var; önce iptal et ya da tamamlanmasını bekle.`)
  const enrolled = await db.workshopEnrollment.count({ where: { userId, status: { in: ["RESERVED", "CONFIRMED"] }, workshop: { OR: [{ startsAt: null }, { startsAt: { gt: now } }], status: "PUBLISHED" } } }).catch(() => 0)
  if (enrolled) out.push(`${enrolled} yaklaşan atölye kaydın var.`)
  if (teacher) {
    const payouts = await db.payoutRequest.count({ where: { teacherId: teacher.id, status: "PENDING" } })
    if (payouts) out.push("Bekleyen bir ödeme talebin var; sonuçlanmasını bekle.")
    const live = await db.liveRoom.count({ where: { teacherId: teacher.id, isActive: true } })
    if (live) out.push("Açık bir canlı yayının var; önce yayını bitir.")
    const workshops = await db.workshop.count({ where: { teacherId: teacher.id, status: "PUBLISHED", OR: [{ startsAt: null }, { startsAt: { gt: now } }], enrollments: { some: { status: { in: ["RESERVED", "CONFIRMED"] } } } } })
    if (workshops) out.push(`Katılımcısı olan ${workshops} yayındaki atölyen var; önce iptal et ya da tamamlanmasını bekle.`)
  }
  return out
}

/**
 * Closes the account: personal data and content are removed, the row itself stays (anonymised and blocked) so that
 * bookings, payments and moderation records keep pointing at something. Signing in is impossible afterwards.
 */
export async function anonymizeUser(userId: string) {
  const teacher = await db.teacher.findUnique({ where: { userId }, select: { id: true } })
  await db.$transaction(async (tx) => {
    await tx.like.deleteMany({ where: { userId } })
    await tx.comment.deleteMany({ where: { authorId: userId } })
    await tx.post.deleteMany({ where: { authorId: userId } })
    await tx.notification.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })
    await tx.account.deleteMany({ where: { userId } })
    await tx.passwordResetToken.deleteMany({ where: { userId } })
    if (teacher) {
      await tx.teacherVideo.deleteMany({ where: { teacherId: teacher.id } })
      await tx.availability.deleteMany({ where: { teacherId: teacher.id } })
      await tx.teacher.update({ where: { id: teacher.id }, data: { bio: null, specialties: null, isTrialMode: true } })
    }
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Silinmiş kullanıcı", email: `silinmis-${userId}@aya.invalid`, password: null, image: null,
        firstName: null, lastName: null, dateOfBirth: null, phone: null, address: null, country: null, passportId: null, interests: null,
        expoPushToken: null, badges: null,
        banned: true, banReason: "Hesap kullanıcı tarafından silindi", bannedAt: new Date(), deletedAt: new Date(),
      },
    })
  })
}

/** Everything AYA keeps about a person, for the "download my data" button. */
export async function exportUserData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, image: true, firstName: true, lastName: true, dateOfBirth: true, phone: true, address: true, country: true, passportId: true, interests: true,
      createdAt: true, termsAcceptedAt: true, termsVersion: true, subscriptionPlan: true, points: true, currentStreak: true, longestStreak: true, badges: true,
    },
  })
  const teacher = await db.teacher.findUnique({ where: { userId }, select: { id: true, bio: true, hourlyRate: true, specialties: true, isTrialMode: true, videos: { select: { title: true, videoUrl: true, createdAt: true } } } })
  const [bookings, posts, comments, reviews, enrollments, notifications, tickets, warnings, violations] = await Promise.all([
    db.booking.findMany({ where: { OR: [{ studentId: userId }, ...(teacher ? [{ teacherId: teacher.id }] : [])] }, select: { id: true, startTime: true, endTime: true, status: true, price: true, studentId: true, teacherId: true, createdAt: true }, take: 5000 }),
    db.post.findMany({ where: { authorId: userId }, select: { id: true, content: true, image: true, status: true, createdAt: true }, take: 5000 }),
    db.comment.findMany({ where: { authorId: userId }, select: { id: true, postId: true, content: true, createdAt: true }, take: 5000 }),
    db.review.findMany({ where: { booking: { studentId: userId } }, select: { id: true, rating: true, comment: true, status: true, createdAt: true }, take: 5000 }),
    db.workshopEnrollment.findMany({ where: { userId }, select: { workshopId: true, status: true, createdAt: true }, take: 5000 }),
    db.notification.findMany({ where: { userId }, select: { type: true, title: true, body: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.supportTicket.findMany({ where: { userId }, select: { id: true, subject: true, status: true, createdAt: true, messages: { where: { role: { not: "NOTE" } }, select: { role: true, content: true, createdAt: true } } }, take: 200 }),
    db.userWarning.findMany({ where: { userId }, select: { message: true, createdAt: true }, take: 200 }),
    db.policyViolation.findMany({ where: { userId }, select: { surface: true, kinds: true, excerpt: true, strike: true, action: true, createdAt: true }, take: 200 }),
  ])
  return { exportedAt: new Date().toISOString(), note: "AYA'nın hakkında tuttuğu veriler. Şifre ve güvenlik kayıtları (IP geçmişi) dışarıda bırakılmıştır.", user, teacher, bookings, posts, comments, reviews, workshopEnrollments: enrollments, notifications, supportTickets: tickets, warnings, policyViolations: violations }
}
