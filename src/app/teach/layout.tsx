import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"

export const metadata = { robots: { index: false, follow: false } }

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardLayout>{children}</DashboardLayout>
    </Suspense>
  )
}
