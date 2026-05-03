"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface LiveRoom {
  id: string
  roomName: string
  title: string
  isActive: boolean
  createdAt: string
}

export function GoLiveButton({ activeLiveRoom }: { activeLiveRoom: LiveRoom | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState("Live Yoga Session")

  const handleGoLive = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/room/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to start live session")
        return
      }

      const roomData = await res.json()
      // Store room data in sessionStorage for the live page
      sessionStorage.setItem("liveRoomData", JSON.stringify(roomData))
      router.push("/live")
    } catch {
      alert("Network error")
    } finally {
      setLoading(false)
    }
  }

  const handleEndLive = async () => {
    if (!activeLiveRoom || !confirm("Are you sure you want to end this live session?")) return
    
    try {
      await fetch("/api/room/instant", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveRoomId: activeLiveRoom.id }),
      })
      window.location.reload()
    } catch {
      alert("Failed to end session")
    }
  }

  if (activeLiveRoom) {
    return (
      <div className="glass-card p-6 rounded-3xl border-2 border-green-300/50 bg-green-50/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
              <span className="text-green-700 font-semibold text-lg">Currently Live</span>
            </div>
            <span className="text-sage-500 text-sm">
              "{activeLiveRoom.title}" — Started {new Date(activeLiveRoom.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleEndLive}
              className="bg-red-500 text-white px-5 py-2.5 rounded-full font-medium hover:bg-red-600 transition btn-press text-sm"
            >
              End Session
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 rounded-3xl border border-sage-100/50">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="text-xl font-display text-sage-900 mb-1">Go Live Now</h3>
          <p className="text-sage-500 text-sm">Start an instant live session — no booking required</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title..."
            className="flex-1 sm:w-56 px-4 py-2.5 rounded-xl border border-sage-200 bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
          />
          <button
            onClick={handleGoLive}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-green-700 transition disabled:opacity-50 btn-press flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>🔴 Go Live</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
