"use client"

import { useEffect, useState, useRef } from "react"
import { useRoomContext, useDataChannel } from "@livekit/components-react"
import { Shield, MessageSquareOff, MessageSquare, UserX, AlertTriangle, Video, StopCircle, Activity, Circle } from "lucide-react"
import { Clock } from "lucide-react"
import { AiPostureAssist } from "./ai-posture-assist"
import { ReportDialog } from "./report-dialog"
import { RoomRecorder, RecorderState } from "@/lib/room-recorder"
import { formatElapsed } from "@/lib/recording-client"

export function LiveRoomManager({ role, endTime, bookingId, liveRoomId }: { role: "teacher" | "student", endTime?: string, bookingId?: string, liveRoomId?: string }) {
  const room = useRoomContext()
  const [chatEnabled, setChatEnabled] = useState(true)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [recState, setRecState] = useState<RecorderState>("idle")
  const [recError, setRecError] = useState<string | null>(null)
  const [recElapsed, setRecElapsed] = useState(0)
  const [recordingReady, setRecordingReady] = useState(false)
  const [teacherRecording, setTeacherRecording] = useState(false) // student side: is the teacher recording?
  const lastRecPing = useRef(0)
  const recorderRef = useRef<RoomRecorder | null>(null)
  const [showAiPosture, setShowAiPosture] = useState(false)
  const [reporting, setReporting] = useState(false)
  const isRecording = recState === "recording"

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
        
        // Recording notice from the teacher (heartbeat every few seconds while recording)
        if (data.type === "RECORDING_STATE") {
          lastRecPing.current = data.recording ? Date.now() : 0
          setTeacherRecording(!!data.recording)
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
    setRecError(null)
    if (!recorderRef.current) {
      recorderRef.current = new RoomRecorder(room, (state, detail) => {
        setRecState(state)
        if (state === "error") setRecError(detail || "Kayıt hatası")
      })
    }
    const recorder = recorderRef.current

    if (recorder.state === "recording") {
      try {
        const result = await recorder.stop()
        if (result) setRecordingReady(true)
      } catch (e: any) {
        setRecError(e?.message || "Kayıt tamamlanamadı")
      }
      broadcastRecording(false)
      return
    }

    try {
      await recorder.start(liveRoomId ? { liveRoomId } : { bookingId: bookingId! })
      setRecordingReady(false)
      broadcastRecording(true)
    } catch (e: any) {
      setRecError(e?.message || "Kayıt başlatılamadı")
    }
  }

  const broadcastRecording = (recording: boolean) => {
    const payload = JSON.stringify({ type: "RECORDING_STATE", recording })
    send(new TextEncoder().encode(payload), { reliable: true })
  }

  // Teacher: elapsed timer + heartbeat so late joiners also see the notice
  useEffect(() => {
    if (role !== "teacher" || !isRecording) return
    const tick = setInterval(() => {
      setRecElapsed(recorderRef.current?.elapsedSec ?? 0)
    }, 1000)
    const beat = setInterval(() => broadcastRecording(true), 8000)
    return () => {
      clearInterval(tick)
      clearInterval(beat)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, isRecording])

  // Student: the notice disappears if the heartbeat stops (teacher closed the tab)
  useEffect(() => {
    if (role !== "student") return
    const t = setInterval(() => {
      if (lastRecPing.current && Date.now() - lastRecPing.current > 25000) {
        lastRecPing.current = 0
        setTeacherRecording(false)
      }
    }, 5000)
    return () => clearInterval(t)
  }, [role])

  // Stop and upload what we have if the teacher leaves the room page
  useEffect(() => {
    return () => {
      const r = recorderRef.current
      if (r && r.state === "recording") r.stop().catch(() => {})
    }
  }, [])

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
            data-testid="record-lesson"
            onClick={toggleRecording}
            disabled={recState === "starting" || recState === "stopping" || (!bookingId && !liveRoomId)}
            className={`flex items-center gap-2 w-full p-2.5 rounded-xl transition text-sm disabled:opacity-60 ${isRecording ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            {isRecording ? <StopCircle size={16} /> : <Video size={16} />}
            {recState === "starting" ? "Başlatılıyor…" : recState === "stopping" ? "Yükleniyor…" : isRecording ? `Kaydı Bitir · ${formatElapsed(recElapsed)}` : "Dersi Kaydet"}
          </button>
          {recError && <p className="text-xs text-red-300" role="alert">{recError}</p>}
          {recordingReady && (
            <p className="text-xs text-sage-300">
              Kayıt hazır. Panelinizdeki “Ders Kayıtları” bölümünden indirebilirsiniz (30 gün saklanır).
            </p>
          )}

          <button 
            onClick={kickAllStudents}
            className="flex items-center gap-2 w-full p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition text-sm"
          >
            <UserX size={16} />
            Timeout / Kick All
          </button>
        </div>
      )}

      {/* Recording notice — visible to everyone in the room */}
      {(isRecording || teacherRecording) && (
        <div data-testid="rec-indicator" className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-black/70 backdrop-blur text-white text-xs font-medium px-3 py-1.5 rounded-full border border-red-500/40">
          <Circle size={10} className="fill-red-500 text-red-500 animate-pulse" />
          {role === "teacher" ? `KAYITTA · ${formatElapsed(recElapsed)}` : "Bu ders kaydediliyor"}
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
      {bookingId && (
        <button
          data-testid="report-lesson"
          onClick={() => setReporting(true)}
          className="absolute bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-200 backdrop-blur border border-red-500/30 transition shadow-lg text-sm font-medium"
        >
          <AlertTriangle size={16} />
          Sorun Bildir
        </button>
      )}
      {reporting && bookingId && (
        <ReportDialog targetType="BOOKING" targetId={bookingId} subject="Bu ders" theme="dark" onClose={() => setReporting(false)} />
      )}
    </>
  )
}
