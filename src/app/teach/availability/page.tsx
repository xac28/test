import { PageHeader } from "@/components/panel/ui"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AvailabilityManager } from "@/components/availability-manager"

export default async function AvailabilityPage() {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/dashboard")

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: { availability: true },
  })

  if (!teacher) redirect("/become-teacher")

  return (
    <div className="pb-12">
      <PageHeader title="Müsaitlik" description="Öğrencilerin randevu alabileceği haftalık saatlerini seç." />

      <AvailabilityManager
        teacherId={teacher.id}
        initialSlots={JSON.parse(JSON.stringify(teacher.availability))}
      />
    </div>
  )
}
