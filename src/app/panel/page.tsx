import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { homePathFor } from "@/lib/home-path"

export const dynamic = "force-dynamic"

// "/panel" = "my panel": sends admins to the admin panel, teachers to the teacher panel, students to the student panel
export default async function PanelRedirect() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=%2Fpanel")
  redirect(homePathFor(session.user.role))
}
