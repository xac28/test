import { db } from "@/lib/db"
import { notSuspended } from "@/lib/policy"
import type { Teacher } from "@/lib/teachers"
import type { Level, YogaStyle } from "@/lib/constants"

const STYLE_MAP: Record<string, YogaStyle> = {
  "face yoga": "hatha",
  "yin yoga": "yin",
  "fasyal yoga": "hatha",
  vinyasa: "vinyasa",
  "hatha yoga": "hatha",
  "mindfulness & meditation": "meditation",
}

const SLOT_DAYS = 14
const HOUR = 3_600_000

/** Hourly bookable slots from the teacher's weekly availability (UTC, like the demo data), minus taken ones. */
export async function upcomingSlots(teacherId: string): Promise<string[]> {
  const [rules, taken] = await Promise.all([
    db.availability.findMany({ where: { teacherId } }),
    db.booking.findMany({
      where: { teacherId, status: { in: ["PENDING", "CONFIRMED"] }, startTime: { gte: new Date() } },
      select: { startTime: true },
    }),
  ])
  const takenSet = new Set(taken.map((b) => b.startTime.getTime()))
  const now = Date.now()
  const out: string[] = []
  const day0 = new Date()
  day0.setUTCHours(0, 0, 0, 0)
  for (let d = 0; d <= SLOT_DAYS; d++) {
    const day = new Date(day0.getTime() + d * 24 * HOUR)
    for (const r of rules.filter((x) => x.dayOfWeek === day.getUTCDay())) {
      const startH = parseInt(r.startTime.split(":")[0], 10)
      const endH = parseInt(r.endTime.split(":")[0], 10)
      if (!Number.isFinite(startH) || !Number.isFinite(endH)) continue
      for (let h = startH; h < endH; h++) {
        const t = day.getTime() + h * HOUR
        if (t > now + HOUR && !takenSet.has(t)) out.push(new Date(t).toISOString())
      }
    }
  }
  return out.sort()
}

/** The public profile of an approved, database-backed teacher in the same shape as the static demo teachers. */
export async function getDbTeacherProfile(idOrSlug: string): Promise<Teacher | null> {
  const t = await db.teacher.findFirst({
    where: { isTrialMode: false, user: notSuspended(), OR: [{ id: idOrSlug }, { userId: idOrSlug }] },
    include: {
      user: { select: { name: true, image: true, country: true, firstName: true, lastName: true } },
      bookings: { where: { status: "COMPLETED" }, include: { review: true } },
    },
  })
  if (!t) return null
  let specialties: string[] = []
  try {
    specialties = t.specialties ? JSON.parse(t.specialties) : []
  } catch {}
  const reviews = t.bookings.filter((b) => b.review && b.review.status === "VISIBLE").map((b) => b.review!)
  const rating = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 5
  const name = t.user.name || `${t.user.firstName ?? ""} ${t.user.lastName ?? ""}`.trim() || "Eğitmen"
  const bio = t.bio || "AYA'da ders veren sertifikalı yoga eğitmeni."
  return {
    id: t.id,
    slug: t.id,
    name,
    country: t.user.country || "",
    countryFlag: "🌍",
    avatar: t.user.image || "",
    bio: { en: bio, tr: bio },
    longBio: { en: bio, tr: bio },
    styles: (specialties.map((s) => STYLE_MAP[s.toLowerCase()] || "hatha") as YogaStyle[]).filter((v, i, a) => a.indexOf(v) === i),
    levels: ["beginner", "intermediate"] as Level[],
    yearsExperience: 1,
    languages: [],
    certifications: [],
    rating,
    reviewCount: reviews.length,
    studentsCount: t.bookings.length,
    pricePerClassUSD: t.hourlyRate,
    trialPriceUSD: Math.round(t.hourlyRate * 0.5 * 100) / 100,
    videoIntroUrl: "",
    availability: await upcomingSlots(t.id),
  }
}
