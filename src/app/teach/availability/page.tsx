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
    <div className="space-y-8 animate-fade-in">
      <div className="glass-card p-8 rounded-3xl border border-sage-100/50">
        <p className="text-sage-500 text-sm font-medium tracking-wider uppercase mb-1">Schedule</p>
        <h1 className="text-4xl font-display text-sage-900 gradient-text">Availability</h1>
        <p className="text-sage-500 mt-2">Set your weekly availability for students to book</p>
      </div>

      <AvailabilityManager
        teacherId={teacher.id}
        initialSlots={JSON.parse(JSON.stringify(teacher.availability))}
      />
    </div>
  )
}
