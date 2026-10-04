import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardLayout>{children}</DashboardLayout>
    </Suspense>
  )
}
