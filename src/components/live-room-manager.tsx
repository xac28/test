"use client"

import { useEffect, useState, useRef } from "react"
import { useRoomContext, useDataChannel } from "@livekit/components-react"
import { Shield, MessageSquareOff, MessageSquare, UserX, AlertTriangle, Video, StopCircle, Activity } from "lucide-react"
import { Clock } from "lucide-react"
import { AiPostureAssist } from "./ai-posture-assist"

export function LiveRoomManager({ role, endTime, bookingId }: { role: "teacher" | "student", endTime?: string, bookingId?: string }) {
  const room = useRoomContext()
  const [chatEnabled, setChatEnabled] = useState(true)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [showAiPosture, setShowAiPosture] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  // Set up data channel for real-time commands
  const { send } = useDataChannel(
    "room-controls",
    (msg) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(msg.payload))
        
        // Handle Chat Toggle
        if (data.type === "TOGGLE_CHAT") {
          setChatEnabled(data.enabled)
        }
        
        // Handle Timeout/Kick (Student side only)
        if (data.type === "TIMEOUT" && role === "student") {
          alert(`You have been timed out.\nReason: ${data.reason || "Violation of rules"}`)
          room.disconnect()
          window.location.href = "/dashboard"
        }
      } catch (e) {
        console.error("Data channel error", e)
      }
    }
  )

  // Timer & Warning Logic
  useEffect(() => {
    if (!endTime || !bookingId) return

    const interval = setInterval(() => {
      const end = new Date(endTime).getTime()
      const now = Date.now()
      const diff = end - now

      if (diff <= 0) {
        clearInterval(interval)
        // Time is up, mark as completed
        if (role === "teacher") {
          fetch(`/api/cron/process-bookings`, {
            method: "POST",
            body: JSON.stringify({ bookingId })
          })
        }
        alert("Ders süresi doldu! Teşekkür ederiz.")
        room.disconnect()
        window.location.href = "/dashboard"
      } else {
        setTimeLeft(diff)
        // 10 minutes warning (600,000 ms)
        if (diff <= 600000 && diff > 599000) {
          setShowWarning(true)
          if (role === "teacher") {
            alert("⚠️ DİKKAT: Dersin bitmesine 10 dakika kaldı!")
          } else {
            alert("⏰ Dersin bitmesine 10 dakika kalmıştır.")
          }
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [endTime, bookingId, role, room])

  const toggleChat = () => {
    const newState = !chatEnabled
    setChatEnabled(newState)
    
    // Broadcast state to everyone
    const payload = JSON.stringify({ type: "TOGGLE_CHAT", enabled: newState })
    send(new TextEncoder().encode(payload), { reliable: true })
  }

  const kickAllStudents = () => {
    const reason = prompt("Enter timeout reason (This will be logged):")
    if (reason === null) return // cancelled
    
    const payload = JSON.stringify({ type: "TIMEOUT", reason: reason || "Violation of rules" })
    send(new TextEncoder().encode(payload), { reliable: true })
    
    // Log to server (fire and forget)
    fetch("/api/admin/audit", {
      method: "POST",
      body: JSON.stringify({ action: "TIMEOUT_ROOM", reason, roomName: room.name })
    }).catch(() => {})
  }

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      setIsRecording(false)
      return
    }

    try {
      // Ask user to share their screen (with audio) to record locally
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" })
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        // Automatically download to user's computer
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        document.body.appendChild(a)
        a.style.display = "none"
        a.href = url
        a.download = `Namaste-Ders-Kaydi-${new Date().toISOString().slice(0, 10)}.webm`
        a.click()
        window.URL.revokeObjectURL(url)
        
        // Stop all tracks to remove the "Sharing screen" banner
        stream.getTracks().forEach(track => track.stop())
        setIsRecording(false)
      }

      // If user clicks "Stop Sharing" from browser banner
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop()
        setIsRecording(false)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Recording failed", error)
      alert("Ekran kaydı başlatılamadı. İzinleri kontrol edin.")
    }
  }

  const handleReport = () => {
    const reason = prompt("Please describe the issue or inappropriate behavior:")
    if (!reason) return
    
    fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: room.name, reason })
    })
    .then(res => res.json())
    .then(() => alert("Report submitted successfully. Admins will review this immediately."))
    .catch(() => alert("Failed to submit report. Please contact support."))
  }

  return (
    <>
      {/* Global CSS injection to hide LiveKit Chat if disabled */}
      {!chatEnabled && (
        <style dangerouslySetInnerHTML={{ __html: `
          .lk-chat { display: none !important; }
          button[aria-label="Toggle chat"] { display: none !important; }
        `}} />
      )}

      {/* Teacher / Admin Controls Panel */}
      {role === "teacher" && (
        <div className="absolute top-20 right-6 z-50 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl animate-fade-in flex flex-col gap-3 w-64">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-1">
            <Shield className="text-sage-400" size={18} />
            <h3 className="text-white font-medium text-sm">Host Controls</h3>
          </div>
          
          <button 
            onClick={toggleChat}
            className={`flex items-center justify-between w-full p-2.5 rounded-xl transition text-sm ${chatEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'}`}
          >
            <span className="flex items-center gap-2">
              {chatEnabled ? <MessageSquare size={16} /> : <MessageSquareOff size={16} />}
              {chatEnabled ? "Disable Chat" : "Enable Chat"}
            </span>
            <span className={`w-2 h-2 rounded-full ${chatEnabled ? 'bg-green-400' : 'bg-red-400'}`} />
          </button>

          <button 
            onClick={toggleRecording}
            className={`flex items-center gap-2 w-full p-2.5 rounded-xl transition text-sm ${isRecording ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            {isRecording ? <StopCircle size={16} /> : <Video size={16} />}
            {isRecording ? "Kaydı Durdur & İndir" : "Dersi Kaydet (Lokal)"}
          </button>

          <button 
            onClick={kickAllStudents}
            className="flex items-center gap-2 w-full p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition text-sm"
          >
            <UserX size={16} />
            Timeout / Kick All
          </button>
        </div>
      )}

      {/* Time Warning Toast */}
      {showWarning && timeLeft && timeLeft <= 600000 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-full flex items-center gap-2 animate-bounce shadow-xl backdrop-blur">
          <Clock size={18} />
          <span className="font-medium">
            Son {Math.ceil(timeLeft / 60000)} Dakika
          </span>
        </div>
      )}

      {/* AI Posture Assist (Student Only) */}
      {role === "student" && (
        <>
          <button 
            onClick={() => setShowAiPosture(true)}
            className="absolute bottom-6 left-6 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 transition-all btn-press font-medium"
          >
            <Activity size={18} />
            AI Duruş Asistanı
          </button>
          
          {showAiPosture && <AiPostureAssist onClose={() => setShowAiPosture(false)} />}
        </>
      )}

      {/* Global Report Button (Both Teacher & Student) */}
      <button 
        onClick={handleReport}
        className="absolute bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-200 backdrop-blur border border-red-500/30 transition shadow-lg text-sm font-medium"
      >
        <AlertTriangle size={16} />
        Report Issue
      </button>
    </>
  )
}
