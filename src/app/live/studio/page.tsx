import { auth } from "@/auth"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Studio } from "@/components/live/studio"

export const metadata = { title: "Yayın Stüdyosu · AYA" }
export const dynamic = "force-dynamic"

export default async function StudioPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/live/studio")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/live")
  return (
    <Suspense fallback={null}>
      <Studio />
    </Suspense>
  )
}
