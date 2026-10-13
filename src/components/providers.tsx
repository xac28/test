"use client"

import { SessionProvider } from "next-auth/react"
import { MotionConfig } from "framer-motion"
import { ScrollProgress } from "@/components/motion"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* "user": visitors who asked their system for less motion get no travelling/scaling animation anywhere */}
      <MotionConfig reducedMotion="user">
        <ScrollProgress />
        {children}
      </MotionConfig>
    </SessionProvider>
  )
}
