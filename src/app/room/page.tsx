"use client"

import VideoRoom from "@/components/video-room"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function RoomContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get("bookingId")

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-sage-900 flex items-center justify-center">
        <p className="text-sage-400">No booking ID provided.</p>
      </div>
    )
  }

  return <VideoRoom bookingId={bookingId} />
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-sage-900 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-sage-300 border-t-sage-600 rounded-full animate-spin" />
        <p className="text-sage-300 text-lg">Loading...</p>
      </div>
    }>
      <RoomContent />
    </Suspense>
  )
}
