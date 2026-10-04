import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import TrialRoom from "@/components/trial-room"
import { trialRoleFor } from "@/lib/trial"

export const dynamic = "force-dynamic"
export const metadata = { title: "Deneme Yayını" }

export default async function TrialRoomPage({ params }: { params: { teacherId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/room/trial/${params.teacherId}`)

  const teacher = await db.teacher.findUnique({ where: { id: params.teacherId } })
  const role = teacher ? trialRoleFor({ id: session.user.id, role: session.user.role as string }, teacher) : null
  if (!teacher || !role) {
    // already approved teachers / strangers: back to their own area
    redirect(session.user.role === "TEACHER" ? "/teach" : "/dashboard")
  }
  return <TrialRoom teacherId={teacher.id} />
}
