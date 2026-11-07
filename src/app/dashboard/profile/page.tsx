import { PageHeader } from "@/components/panel/ui"
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
    <div className="pb-12 space-y-6">
      <PageHeader title={user.profileCompleted ? "Profilim" : "Profilini tamamla"} description="Yoga yolculuğunu sana göre şekillendirmemize yardım et." />

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
