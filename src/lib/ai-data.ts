import { db } from "@/lib/db"
import { notSuspended } from "@/lib/policy"
import { GuideTeacher } from "@/lib/ai-guide"
import { TEACHERS } from "@/lib/teachers"

/** Approved teachers (never trial teachers, banned or suspended ones) plus the demo teachers, in the shape the guide works with. */
export async function getGuideTeachers(): Promise<GuideTeacher[]> {
  const dbTeachers = await db.teacher.findMany({
    where: { isTrialMode: false, user: { banned: false, ...notSuspended() } },
    include: { user: { select: { name: true, country: true } }, bookings: { where: { status: "COMPLETED" }, include: { review: true } } },
    orderBy: { user: { createdAt: "desc" } },
    take: 1000,
  })
  const real: GuideTeacher[] = dbTeachers.map((t) => {
    const reviews = t.bookings.filter((b) => b.review && b.review.status === "VISIBLE").map((b) => b.review!)
    let specs: string[] = []
    try {
      specs = t.specialties ? JSON.parse(t.specialties) : []
    } catch {}
    return {
      id: t.id,
      name: t.user.name || "Eğitmen",
      country: t.user.country || "",
      specialties: specs.join(", "),
      rating: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 5,
      reviewCount: reviews.length,
      hourlyRate: t.hourlyRate,
      studentsCount: t.bookings.length,
      href: `/teachers/${t.id}`,
    }
  })
  const demo: GuideTeacher[] = TEACHERS.map((t) => ({
    id: t.slug,
    name: t.name,
    country: t.country,
    specialties: t.styles.join(", "),
    rating: t.rating,
    reviewCount: t.reviewCount,
    hourlyRate: t.pricePerClassUSD,
    studentsCount: t.studentsCount,
    href: `/teachers/${t.slug}`,
  }))
  return [...real, ...demo]
}
