import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AdminTabs } from "@/components/admin-tabs"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  // Only what the server-rendered tabs (applications, trials, finance) need; every other tab loads its own data.
  const [pendingApplications, recentActions, paidBookings, trialTeachers, approvedRows] = await Promise.all([
    db.teacherApplication.findMany({ where: { status: "PENDING" }, include: { user: { select: { name: true, email: true, image: true } } }, orderBy: { submittedAt: "desc" } }),
    db.teacherApplication.findMany({ where: { status: { in: ["APPROVED", "REJECTED"] } }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { reviewedAt: "desc" }, take: 10 }),
    db.booking.findMany({ where: { status: { in: ["CONFIRMED", "COMPLETED"] } }, select: { price: true, teacher: { select: { commissionRate: true, stripeConnectId: true } } } }),
    db.teacher.findMany({ where: { isTrialMode: true }, include: { user: { select: { name: true, email: true, createdAt: true } } }, orderBy: { id: "desc" } }),
    db.teacher.findMany({ where: { isTrialMode: false }, include: { user: { select: { name: true, email: true } } }, orderBy: { id: "desc" }, take: 100 }),
  ])

  let totalVolume = 0
  let platformRevenue = 0
  let pendingPayouts = 0
  for (const b of paidBookings) {
    totalVolume += b.price
    const comm = b.price * b.teacher.commissionRate
    platformRevenue += comm
    if (!b.teacher.stripeConnectId) pendingPayouts += b.price - comm
  }

  const approvedTeachers = approvedRows.map((t) => ({ id: t.id, name: t.user.name, email: t.user.email, trialReviewedAt: t.trialReviewedAt }))

  return (
    <AdminTabs
      pendingApplications={JSON.parse(JSON.stringify(pendingApplications))}
      recentActions={JSON.parse(JSON.stringify(recentActions))}
      financials={{ totalVolume, platformRevenue, pendingPayouts }}
      trialTeachers={JSON.parse(JSON.stringify(trialTeachers))}
      approvedTeachers={JSON.parse(JSON.stringify(approvedTeachers))}
    />
  )
}
