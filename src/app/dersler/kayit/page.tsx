import { auth } from "@/auth"
import { RecordedLessonsView } from "@/components/recorded-lessons-view"

export const dynamic = "force-dynamic"
export const metadata = { title: "Ders kayıtları" }

export default async function RecordedLessonsPage() {
  const session = await auth().catch(() => null)
  const role = !session?.user ? null : session.user.role === "TEACHER" || session.user.role === "ADMIN" ? "teacher" : "student"
  return <RecordedLessonsView role={role} />
}
