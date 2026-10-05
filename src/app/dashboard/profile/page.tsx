import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { StudentProfileForm } from "@/components/student-profile-form"
import { AccountDataCard } from "@/components/account-data-card"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user) redirect("/")

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user) redirect("/")

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="glass-card p-8 rounded-3xl border border-sage-100/50">
        <p className="text-sage-500 text-sm font-medium tracking-wider uppercase mb-1">Profilin</p>
        <h1 className="text-4xl font-display text-sage-900 gradient-text">Complete Profilin</h1>
        <p className="text-sage-500 mt-2">Yoga yolculuğunu sana göre şekillendirmemize yardım et</p>
      </div>

      <StudentProfileForm
        initialData={JSON.parse(JSON.stringify({
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          image: user.image || "",
          dateOfBirth: user.dateOfBirth?.toISOString().split("T")[0] || "",
          phone: user.phone || "",
          address: user.address || "",
          country: user.country || "",
          passportId: user.passportId || "",
          interests: user.interests ? JSON.parse(user.interests) : [],
          profileCompleted: user.profileCompleted,
        }))}
      />

      <AccountDataCard />
    </div>
  )
}
