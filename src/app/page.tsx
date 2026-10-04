import { db } from "@/lib/db"
import HomeView, { HomeData } from "@/components/home-view"
import { listActiveBroadcasts } from "@/lib/live-rooms"
import { seatsLeft, workshopState } from "@/lib/workshops"

export const dynamic = "force-dynamic"

async function loadHome(): Promise<HomeData> {
  try {
    const [rooms, workshopRows, articleRows, teacherRows] = await Promise.all([
      listActiveBroadcasts().catch(() => []),
      db.workshop.findMany({
        where: { status: "PUBLISHED", OR: [{ mode: "RECORDED" }, { startsAt: { gte: new Date(Date.now() - 60 * 60_000) } }] },
        include: {
          teacher: { include: { user: { select: { name: true } } } },
          enrollments: { select: { status: true } },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
        take: 12,
      }),
      db.article.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, title: true, excerpt: true, category: true, coverUrl: true, publishedAt: true, author: { select: { name: true } } },
        orderBy: { publishedAt: "desc" },
        take: 3,
      }),
      db.teacher.findMany({
        where: { isTrialMode: false, user: { banned: false } },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { id: "desc" },
        take: 4,
      }),
    ])

    const now = new Date()
    const workshops = workshopRows
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
      .filter((w) => w.state !== "ended")
      .slice(0, 3)

    const live = rooms[0]
    return {
      live: live ? { id: live.id, title: live.title, viewers: live.viewerCount, teacher: live.teacher.name } : null,
      workshops,
      articles: articleRows.map((a) => ({ ...a, publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null })),
      teachers: teacherRows.map((t) => {
        let specialties: string[] = []
        try {
          specialties = t.specialties ? JSON.parse(t.specialties) : []
        } catch {}
        return { id: t.id, name: t.user.name || "Eğitmen", image: t.user.image, bio: t.bio, specialties }
      }),
    }
  } catch (e) {
    console.error("[HOME_LOAD_ERROR]", e)
    return { live: null, workshops: [], articles: [], teachers: [] }
  }
}

export default async function HomePage() {
  return <HomeView data={await loadHome()} />
}
