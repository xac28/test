import { auth } from "@/auth"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Studio } from "@/components/live/studio"
import { db } from "@/lib/db"

export const metadata = { title: "Yayın Stüdyosu · AYA" }
export const dynamic = "force-dynamic"

export default async function StudioPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/live/studio")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/live")
  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id }, select: { isTrialMode: true } })
  return (
    <Suspense fallback={null}>
      <Studio trial={!!teacher?.isTrialMode && session.user.role === "TEACHER"} />
    </Suspense>
  )
}
