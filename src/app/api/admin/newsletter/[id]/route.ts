import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// DELETE — removes the address completely (a data-deletion request under KVKK)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  await db.newsletterSubscriber.deleteMany({ where: { id: params.id } })
  await db.auditLog.create({ data: { actorId: a.admin.id, action: "NEWSLETTER_DELETE", targetId: params.id } })
  return NextResponse.json({ success: true })
}
