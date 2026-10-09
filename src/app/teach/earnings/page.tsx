import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/panel/ui"
import { PayoutRequestPanel } from "@/components/payout-request-panel"

export const dynamic = "force-dynamic"

export default async function TeacherEarningsPage() {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="pb-12">
      <PageHeader title="Kazançlar" description="Tamamlanan derslerin komisyon düşülmüş tutarı burada birikir. Çekmek istediğin tutar için talep oluştur; yönetici onayından sonra ödemen yapılır." />
      <PayoutRequestPanel />
    </div>
  )
}
