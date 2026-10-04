"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { X } from "lucide-react"
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react"
import { RoomOptions } from "livekit-client"
import "@livekit/components-styles"

interface LiveRoomData {
  roomUrl: string
  roomName: string
  token: string
  liveRoomId: string
  role: string
}

function LiveContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const liveRoomId = searchParams.get("id")
  const [roomData, setRoomData] = useState<LiveRoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const roomOptions: RoomOptions = {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: { width: 1920, height: 1080, frameRate: 60 },
    },
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    },
    publishDefaults: {
      videoEncoding: { maxBitrate: 5_000_000, maxFramerate: 60 },
    },
  }

  useEffect(() => {
    if (liveRoomId) {
      // Reconnect to existing room — fetch token
      setLoading(false)
      setError("Reconnection not yet implemented. Start a new session from your dashboard.")
    }
  }, [liveRoomId])

  // This component receives data from the teach dashboard via state
  useEffect(() => {
    const stored = sessionStorage.getItem("liveRoomData")
    if (stored) {
      setRoomData(JSON.parse(stored))
      sessionStorage.removeItem("liveRoomData")
      setLoading(false)
    } else if (!liveRoomId) {
      setLoading(false)
      setError("No live room data found. Please start from your teacher dashboard.")
    }
  }, [liveRoomId])

  const handleEndSession = async () => {
    if (roomData?.liveRoomId) {
      await fetch("/api/room/instant", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveRoomId: roomData.liveRoomId }),
      })
    }
    router.push("/teach")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-sage-300 border-t-sage-600 rounded-full animate-spin" />
        <p className="text-sage-300 text-lg font-display tracking-wide">Starting your live session...</p>
      </div>
    )
  }

  if (error || !roomData) {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
          <X className="text-red-400" size={40} />
        </div>
        <h2 className="text-2xl text-white font-display">Unable to Start</h2>
        <p className="text-sage-400 text-center max-w-md">{error}</p>
        <button
          onClick={() => router.push("/teach")}
          className="mt-4 bg-sage-600 text-white px-6 py-3 rounded-full hover:bg-sage-500 transition"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-[#111] flex flex-col overflow-hidden" data-lk-theme="default">
      <header className="h-14 bg-black/50 backdrop-blur border-b border-white/10 flex items-center justify-between px-6 z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg text-white tracking-widest">AYA</span>
          <span className="h-4 w-px bg-white/20" />
          <span className="text-white/60 text-sm">Live Session</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-white/80 text-sm font-medium">LIVE HD</span>
          </div>
          <button
            onClick={handleEndSession}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full text-sm font-medium transition"
          >
            End Session
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <LiveKitRoom
          video={true}
          audio={true}
          token={roomData.token}
          serverUrl={roomData.roomUrl}
          options={roomOptions}
          onDisconnected={handleEndSession}
          className="h-full w-full"
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </main>
    </div>
  )
}

export default function LivePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-sage-300 border-t-sage-600 rounded-full animate-spin" />
        <p className="text-sage-300 text-lg">Loading...</p>
      </div>
    }>
      <LiveContent />
    </Suspense>
  )
}
