import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import WorkshopDetailView from "@/components/workshop-detail-view"
import { findWorkshop, presentWorkshop } from "@/lib/workshop-server"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const w = await db.workshop.findFirst({ where: { slug: params.slug, status: "PUBLISHED" }, select: { title: true, subtitle: true } }).catch(() => null)
  return w ? { title: w.title, description: w.subtitle ?? undefined } : { title: "Atölye" }
}

export default async function WorkshopPage({ params }: { params: { slug: string } }) {
  const session = await auth()
  const viewer = session?.user?.id ? { id: session.user.id, role: session.user.role as string } : null

  const w = await findWorkshop(params.slug)
  if (!w) notFound()
  const view = presentWorkshop(w, viewer)
  if (w.status === "DRAFT" && !view.isOwner && viewer?.role !== "ADMIN") notFound()

  const room = await db.liveRoom.findFirst({ where: { workshopId: w.id, isActive: true }, select: { id: true } })

  return (
    <WorkshopDetailView
      workshop={JSON.parse(JSON.stringify(view))}
      loggedIn={!!viewer}
      liveRoomId={room?.id ?? null}
    />
  )
}
