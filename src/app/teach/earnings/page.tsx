import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { PayoutRequestPanel } from "@/components/payout-request-panel"

export const dynamic = "force-dynamic"

export default async function TeacherEarningsPage() {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="text-xs font-bold tracking-widest uppercase text-sage-500 mb-2">Kazançlar</p>
        <h1 className="font-display text-4xl text-ink">Hakediş ve ödeme talepleri</h1>
        <p className="text-ink/60 mt-2 max-w-xl">
          Tamamlanan derslerin komisyon düşülmüş tutarı burada birikir. Çekmek istediğiniz tutar için talep oluşturun; yönetici onayından sonra ödemeniz yapılır.
        </p>
      </div>
      <PayoutRequestPanel />
    </div>
  )
}
