import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// DELETE — removes the address completely (a data-deletion request under KVKK)
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  await db.newsletterSubscriber.deleteMany({ where: { id: params.id } })
  await db.auditLog.create({ data: { actorId: a.admin.id, action: "NEWSLETTER_DELETE", targetId: params.id } })
  return NextResponse.json({ success: true })
}
