import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

const STATUS_TR: Record<string, string> = {
  PENDING: "Beklemede",
  CONFIRMED: "Onaylandı",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
}

export default async function TeacherBookingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/dashboard")

  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } })
  const bookings = teacher
    ? await db.booking.findMany({
        where: { teacherId: teacher.id },
        include: { student: { select: { name: true } } },
        orderBy: { startTime: "desc" },
        take: 100,
      })
    : []

  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="text-xs font-bold tracking-widest uppercase text-sage-500 mb-2">Derslerim</p>
        <h1 className="font-display text-4xl text-ink">Tüm dersler</h1>
      </div>

      {bookings.length === 0 ? (
        <p className="text-ink/60">Henüz ders yok.</p>
      ) : (
        <ul className="rounded-3xl border border-sage-200/70 bg-white divide-y divide-sage-100" data-testid="teacher-bookings">
          {bookings.map((b) => (
            <li key={b.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-ink">{b.student.name}</p>
                <p className="text-sm text-ink/60">
                  {b.startTime.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sage-50 border border-sage-200 text-sage-800">
                  {STATUS_TR[b.status]}
                </span>
                {b.status === "CONFIRMED" && (
                  <Link href={`/room?bookingId=${b.id}`} className="text-sm bg-sage-700 text-white px-4 py-1.5 rounded-full hover:bg-sage-800">
                    Odaya gir
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
