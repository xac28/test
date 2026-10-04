import { db } from "@/lib/db"
import { canAccessContent, seatsLeft, workshopState } from "@/lib/workshops"

/** Find by cuid or slug. */
export async function findWorkshop(idOrSlug: string) {
  return db.workshop.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      teacher: { include: { user: { select: { id: true, name: true, image: true } } } },
      enrollments: { select: { userId: true, status: true } },
    },
  })
}

type Found = NonNullable<Awaited<ReturnType<typeof findWorkshop>>>

/** Public shape of a workshop for one viewer — the video URL only for owner/admin/confirmed enrollee. */
export function presentWorkshop(w: Found, viewer: { id: string; role: string } | null, now: Date = new Date()) {
  const isOwner = !!viewer && w.teacher.userId === viewer.id
  const isAdmin = viewer?.role === "ADMIN"
  const mine = viewer ? w.enrollments.find((e) => e.userId === viewer.id) : undefined
  const hasAccess = canAccessContent({ isOwner, isAdmin, enrollmentStatus: mine?.status })
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    subtitle: w.subtitle,
    description: w.description,
    category: w.category,
    level: w.level,
    mode: w.mode,
    status: w.status,
    state: workshopState(w, now),
    startsAt: w.startsAt,
    durationMin: w.durationMin,
    priceUsd: w.priceUsd,
    capacity: w.capacity,
    seatsLeft: seatsLeft(w.capacity, w.enrollments),
    coverUrl: w.coverUrl,
    teacher: { id: w.teacher.id, name: w.teacher.user.name, image: w.teacher.user.image },
    isOwner,
    myEnrollment: mine ? mine.status : null,
    videoUrl: hasAccess ? w.videoUrl : null,
    hasAccess,
  }
}
