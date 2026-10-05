import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { StreamerPanel } from "@/components/streamer-panel"
import { currentRelease, streamerEligibility } from "@/lib/streamer"

export const dynamic = "force-dynamic"

export default async function StreamerPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/teach/uygulama")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/dashboard")
  const [el, release] = await Promise.all([streamerEligibility(session.user.id), currentRelease()])
  return (
    <StreamerPanel
      eligible={el.ok}
      reason={el.ok ? null : el.message ?? null}
      release={release ? { version: release.version, file: release.file, size: release.size, sha256: release.sha256, builtAt: release.builtAt } : null}
    />
  )
}
