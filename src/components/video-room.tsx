"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react"
import { RoomOptions, VideoPresets } from "livekit-client"
import "@livekit/components-styles"
import { LiveRoomManager } from "./live-room-manager"
import { AntiPiracy } from "./anti-piracy"

interface RoomData {
  roomUrl: string
  roomName: string
  token: string
  role: "teacher" | "student"
  booking: {
    id: string
    startTime: string
    endTime: string
    teacherName: string
    studentName: string
  }
}

export default function VideoRoom({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Enterprise Quality Configuration
  const roomOptions: RoomOptions = {
    adaptiveStream: true, // Optimizes bandwidth based on what is visible
    dynacast: true, // Automatically manages video layers for different connection speeds
    videoCaptureDefaults: {
      resolution: {
        width: 1920,
        height: 1080,
        frameRate: 60,
      },
      deviceId: "",
    },
    audioCaptureDefaults: {
      autoGainControl: true, // Normalizes voice volumes
      echoCancellation: true, // Removes echo
      noiseSuppression: true, // Removes background noise
    },
    publishDefaults: {
      videoEncoding: {
        maxBitrate: 5_000_000, // 5 Mbps high-quality bitrate for 1080p60
        maxFramerate: 60,      // 60 FPS support for smooth motion
      },
    },
  }

  // Join room API
  useEffect(() => {
    async function joinRoom() {
      try {
        const res = await fetch("/api/room/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to join room")
        }

        const data: RoomData = await res.json()
        setRoomData(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    joinRoom()
  }, [bookingId])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-sage-300 border-t-sage-600 rounded-full animate-spin" />
        <p className="text-sage-300 text-lg font-display tracking-wide">Preparing your enterprise room...</p>
      </div>
    )
  }

  // Error state
  if (error || !roomData) {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
          <X className="text-red-400" size={40} />
        </div>
        <h2 className="text-2xl text-white font-display">Unable to Join</h2>
        <p className="text-sage-400 text-center max-w-md">{error}</p>
        <button
          onClick={() => router.push("/dashboard")}
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
          <span className="font-display text-lg text-white tracking-widest">NAMASTE</span>
          <span className="h-4 w-px bg-white/20" />
          <span className="text-white/60 text-sm">
            {roomData.role === "teacher" ? roomData.booking.studentName : roomData.booking.teacherName}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-white/80 text-sm font-medium">LIVE HD</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <LiveKitRoom
          video={true}
          audio={true}
          token={roomData.token}
          serverUrl={roomData.roomUrl}
          options={roomOptions}
          onDisconnected={() => router.push("/dashboard")}
          className="h-full w-full relative"
        >
          {/* Viewer-side protection only: the teacher is the one who may record (official, server-side recording) */}
          {roomData.role === "student" && <AntiPiracy userName={roomData.booking.studentName} />}
          <VideoConference />
          <RoomAudioRenderer />
          <LiveRoomManager role={roomData.role} endTime={roomData.booking.endTime} bookingId={roomData.booking.id} />
        </LiveKitRoom>
      </main>
    </div>
  )
}
