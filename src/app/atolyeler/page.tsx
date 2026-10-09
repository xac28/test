import { db } from "@/lib/db"
import WorkshopsView from "@/components/workshops-view"
import { seatsLeft, workshopState } from "@/lib/workshops"

export const dynamic = "force-dynamic"
export const metadata = { title: "Atölyeler" }

export default async function WorkshopsPage({ searchParams }: { searchParams: { mode?: string; category?: string; past?: string } }) {
  const mode = searchParams.mode === "LIVE" || searchParams.mode === "RECORDED" ? searchParams.mode : null
  const category = searchParams.category || null
  const past = searchParams.past === "1"
  const now = new Date()

  const rows = await db.workshop
    .findMany({
      where: { status: "PUBLISHED", ...(mode ? { mode } : {}), ...(category ? { category } : {}) },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        enrollments: { select: { status: true } },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    })
    .catch(() => [])

  const items = rows
    .map((w) => ({
      slug: w.slug,
      title: w.title,
      subtitle: w.subtitle,
      category: w.category,
      level: w.level,
      mode: w.mode,
      state: workshopState(w, now),
      startsAt: w.startsAt ? w.startsAt.toISOString() : null,
      durationMin: w.durationMin,
      priceUsd: w.priceUsd,
      seatsLeft: seatsLeft(w.capacity, w.enrollments),
      coverUrl: w.coverUrl,
      teacher: { name: w.teacher.user.name },
    }))
    .filter((w) => (past ? w.state === "ended" : w.state !== "ended"))

  return <WorkshopsView items={items} filters={{ mode, category, past }} />
}
