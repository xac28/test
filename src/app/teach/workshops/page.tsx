import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { WorkshopManager, ManagedWorkshop } from "@/components/workshop-manager"
import { workshopState } from "@/lib/workshops"

export const dynamic = "force-dynamic"
export const metadata = { title: "Atölyelerim" }

export default async function TeacherWorkshopsPage() {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/dashboard")

  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } })
  const rows = teacher
    ? await db.workshop.findMany({
        where: { teacherId: teacher.id },
        include: { enrollments: { select: { status: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : []

  const now = new Date()
  const items: ManagedWorkshop[] = rows.map((w) => ({
    id: w.id,
    slug: w.slug,
    title: w.title,
    category: w.category,
    mode: w.mode,
    status: w.status,
    state: workshopState(w, now),
    startsAt: w.startsAt ? w.startsAt.toISOString() : null,
    durationMin: w.durationMin,
    capacity: w.capacity,
    priceUsd: w.priceUsd,
    active: w.enrollments.filter((e) => e.status !== "CANCELLED").length,
  }))

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="font-display text-3xl md:text-[2.5rem] leading-[1.1]">Atölyeleriniz</h1>
        <p className="text-sage-600 mt-2 max-w-xl">
          Canlı ya da kayıtlı atölyeler oluşturun, katılımcıları ve ödeme onaylarını buradan yönetin. Canlı atölyeleri “Yayınla” ile stüdyodan başlatırsınız; yalnızca onaylı katılımcılar izleyebilir.
        </p>
      </div>
      {teacher ? <WorkshopManager initial={items} /> : <p className="text-sage-600">Eğitmen profili bulunamadı.</p>}
    </div>
  )
}
