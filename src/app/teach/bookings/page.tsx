import { PageHeader, Panel, EmptyNote, Dot, quietBtn } from "@/components/panel/ui"
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
    <div className="pb-12 space-y-0">
      <PageHeader title="Derslerim" description={bookings.length ? `${bookings.length} ders listeleniyor, en yeniler üstte.` : undefined} />

      {bookings.length === 0 ? (
        <Panel><EmptyNote title="Henüz ders yok">Öğrenciler profilin üzerinden randevu aldığında dersler burada listelenir.</EmptyNote></Panel>
      ) : (
        <ul className="rounded-xl border border-rule bg-paper divide-y divide-rule" data-testid="teacher-bookings">
          {bookings.map((b) => (
            <li key={b.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div>
                <p className="text-sm font-medium text-ink">{b.student.name}</p>
                <p className="text-[13px] text-sage-500">
                  {b.startTime.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] text-sage-700">
                  <Dot tone={b.status === "CONFIRMED" ? "ok" : b.status === "PENDING" ? "wait" : "off"} /> {STATUS_TR[b.status]}
                </span>
                {b.status === "CONFIRMED" && (
                  <Link href={`/room?bookingId=${b.id}`} className={quietBtn}>
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
