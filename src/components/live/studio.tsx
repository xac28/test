"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPreset,
  createLocalAudioTrack,
  createLocalScreenTracks,
  createLocalVideoTrack,
} from "livekit-client"
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Radio,
  Settings2,
  ShieldBan,
  SignalHigh,
  Square as SquareStop,
  Users,
  Wifi,
} from "lucide-react"
import {
  BROADCAST_PRESETS,
  DEFAULT_PRESET_ID,
  QualityPreset,
  getPreset,
  gradeUplink,
  formatBitrate,
  simulcastLayersFor,
  NetworkGrade,
} from "@/lib/live-quality"
import { SLOW_MODE_OPTIONS, formatDuration } from "@/lib/live-chat"
import { RoomRecorder, RecorderState } from "@/lib/room-recorder"
import { useLiveRoom } from "./use-live-room"
import { StaffNoticeBanner } from "./staff-notice"
import { LiveChatPanel } from "./live-chat-panel"

type Phase = "setup" | "starting" | "live" | "ended"

interface Devices {
  cams: MediaDeviceInfo[]
  mics: MediaDeviceInfo[]
}

interface Uplink {
  width?: number
  height?: number
  fps?: number
  bitrate?: number
  grade: NetworkGrade
  limitation?: string
  rtt?: number
}

const GRADE_STYLE: Record<NetworkGrade, { label: string; cls: string }> = {
  good: { label: "Bağlantı iyi", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  fair: { label: "Bağlantı orta", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  poor: { label: "Bağlantı zayıf", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
}

const captureOf = (p: QualityPreset, deviceId?: string) => ({
  deviceId: deviceId || undefined,
  resolution: { width: p.width, height: p.height, frameRate: p.fps },
})

const publishOptsOf = (p: QualityPreset) => {
  const layers = simulcastLayersFor(p)
  return {
    source: Track.Source.Camera,
    name: "camera",
    simulcast: layers.length > 0,
    videoEncoding: { maxBitrate: p.maxBitrate, maxFramerate: p.fps },
    videoSimulcastLayers: layers.map((l) => new VideoPreset(l.width, l.height, l.maxBitrate, l.maxFramerate)),
  }
}

export function Studio({ trial = false }: { trial?: boolean }) {
  const router = useRouter()
  const workshopId = useSearchParams().get("workshop")
  const live = useLiveRoom({ isHost: true })
  const { room } = live

  const [phase, setPhase] = useState<Phase>("setup")
  const [title, setTitle] = useState("Canlı Yoga Dersi")
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [devices, setDevices] = useState<Devices>({ cams: [], mics: [] })
  const [camId, setCamId] = useState("")
  const [micId, setMicId] = useState("")
  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | null>(null)
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null)
  const [camOn, setCamOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [screenTrack, setScreenTrack] = useState<LocalVideoTrack | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [liveRoomId, setLiveRoomId] = useState<string | null>(null)
  const [supervised, setSupervised] = useState(false) // a trial-phase teacher is on air: officials may watch
  const [resume, setResume] = useState<{ title: string; roomUrl: string; token: string; liveRoomId: string; startedAt: string; supervised?: boolean } | null>(null)
  const [tab, setTab] = useState<"chat" | "settings" | "viewers">("chat")
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [peak, setPeak] = useState(0)
  const [uplink, setUplink] = useState<Uplink>({ grade: "good" })
  const [micLevel, setMicLevel] = useState(0)
  const [recState, setRecState] = useState<RecorderState>("idle")
  const [recError, setRecError] = useState<string | null>(null)
  const [recElapsed, setRecElapsed] = useState(0)
  const [recSaved, setRecSaved] = useState(false)

  const previewRef = useRef<HTMLVideoElement>(null)
  const pipRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<RoomRecorder | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(true)
  const preset = getPreset(presetId)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── devices + preview ────────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    try {
      const [cams, mics] = await Promise.all([Room.getLocalDevices("videoinput"), Room.getLocalDevices("audioinput")])
      setDevices({ cams, mics })
    } catch {}
  }, [])

  useEffect(() => {
    let cancelled = false
    let v: LocalVideoTrack | null = null
    let a: LocalAudioTrack | null = null
    ;(async () => {
      // Try video and audio independently so one failing doesn't block the other
      const [vResult, aResult] = await Promise.allSettled([
        createLocalVideoTrack(captureOf(getPreset(DEFAULT_PRESET_ID))),
        createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }),
      ])

      if (cancelled) return

      if (vResult.status === "fulfilled") {
        v = vResult.value
        setVideoTrack(v)
      }
      if (aResult.status === "fulfilled") {
        a = aResult.value
        setAudioTrack(a)
      }

      // Build warning messages for what failed
      const vErr = vResult.status === "rejected" ? vResult.reason : null
      const aErr = aResult.status === "rejected" ? aResult.reason : null

      if (vErr && aErr) {
        const isPermission = vErr?.name === "NotAllowedError" || aErr?.name === "NotAllowedError"
        setMediaError(
          isPermission
            ? "Kamera ve mikrofon izni verilmedi. Tarayıcı adres çubuğundaki izin simgesinden izin verip sayfayı yenileyin."
            : "Kamera ve mikrofon açılamadı. Cihazlarınızı kontrol edin."
        )
      } else if (vErr) {
        // Camera failed but mic works — show soft warning, allow audio-only / screen-share broadcast
        setMediaError("Kamera bulunamadı — ekran paylaşımı veya yalnızca ses ile yayın yapabilirsiniz.")
      } else if (aErr) {
        setMediaError("Mikrofon bulunamadı — yalnızca kamera ile yayın yapabilirsiniz.")
      }

      await loadDevices()
    })()
    return () => {
      cancelled = true
      v?.stop()
      a?.stop()
    }
  }, [loadDevices])

  // Camera preview — skip when screen share is active so both don't fight over the element
  useEffect(() => {
    const el = previewRef.current
    if (!el || !videoTrack || sharing) return
    videoTrack.attach(el)
    return () => { videoTrack.detach(el) }
  }, [videoTrack, sharing])

  // Screen share preview
  useEffect(() => {
    const el = previewRef.current
    if (!el || !screenTrack) return
    screenTrack.attach(el)
    return () => { screenTrack.detach(el) }
  }, [screenTrack])

  // PiP camera when screen sharing
  useEffect(() => {
    const el = pipRef.current
    if (!el || !videoTrack || !sharing) return
    videoTrack.attach(el)
    return () => { videoTrack.detach(el) }
  }, [videoTrack, sharing])

  // Fullscreen change listener
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", h)
    return () => document.removeEventListener("fullscreenchange", h)
  }, [])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // opened from "Atölyeyi başlat": use the workshop's title and tell the host it is a members-only session
  const [workshopTitle, setWorkshopTitle] = useState<string | null>(null)
  useEffect(() => {
    if (!workshopId) return
    fetch(`/api/workshops/${workshopId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.workshop) {
          setWorkshopTitle(d.workshop.title)
          setTitle(d.workshop.title)
        }
      })
      .catch(() => {})
  }, [workshopId])

  // existing live session? offer to resume
  useEffect(() => {
    fetch("/api/room/instant")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.active && setResume(d.active))
      .catch(() => {})
  }, [])

  // microphone level meter
  useEffect(() => {
    if (!audioTrack) return
    let raf = 0
    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(new MediaStream([audioTrack.mediaStreamTrack]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const loop = () => {
      analyser.getByteTimeDomainData(data)
      let peakV = 0
      for (const x of data) peakV = Math.max(peakV, Math.abs(x - 128))
      setMicLevel(Math.min(1, peakV / 90))
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      cancelAnimationFrame(raf)
      src.disconnect()
      ctx.close().catch(() => {})
    }
  }, [audioTrack])

  const changePreset = async (id: string) => {
    setPresetId(id)
    if (!videoTrack) return
    const p = getPreset(id)
    try {
      if (phase === "live" && room) {
        // re-publish so the new encoding + simulcast ladder take effect (viewers resubscribe automatically)
        await room.localParticipant.unpublishTrack(videoTrack, false)
        await videoTrack.restartTrack(captureOf(p, camId))
        await room.localParticipant.publishTrack(videoTrack, publishOptsOf(p))
      } else {
        await videoTrack.restartTrack(captureOf(p, camId))
      }
    } catch (e: any) {
      setMediaError("Kalite değiştirilemedi: " + (e?.message || ""))
    }
  }

  const changeCamera = async (id: string) => {
    setCamId(id)
    try {
      await videoTrack?.restartTrack(captureOf(preset, id))
    } catch (e: any) {
      setMediaError("Kamera değiştirilemedi: " + (e?.message || ""))
    }
  }

  const changeMic = async (id: string) => {
    setMicId(id)
    try {
      await audioTrack?.restartTrack({ deviceId: id, echoCancellation: true, noiseSuppression: true, autoGainControl: true })
    } catch (e: any) {
      setMediaError("Mikrofon değiştirilemedi: " + (e?.message || ""))
    }
  }

  // ── go live / end ────────────────────────────────────────────────────────
  const publishAll = useCallback(
    async (r: Room) => {
      if (videoTrack) await r.localParticipant.publishTrack(videoTrack, publishOptsOf(preset))
      if (audioTrack) await r.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone, name: "mic", dtx: true })
      if (screenTrack) await r.localParticipant.publishTrack(screenTrack, { source: Track.Source.ScreenShare, name: "screen", contentHint: "detail" } as any)
    },
    [videoTrack, audioTrack, screenTrack, preset]
  )

  const goLive = async () => {
    if (!room || (!videoTrack && !audioTrack && !screenTrack)) return
    setStartError(null)
    setPhase("starting")
    try {
      const res = await fetch("/api/room/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ...(workshopId ? { workshopId } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403 && data.code === "TERMS_REQUIRED") return router.replace("/accept-terms?next=/live/studio")
      if (!res.ok) throw new Error(data.error || "Yayın başlatılamadı")
      setLiveRoomId(data.liveRoomId)
      setSupervised(!!data.supervised)
      await live.connect(data.roomUrl, data.token)
      await publishAll(room)
      setStartedAt(Date.now())
      setPhase("live")
    } catch (e: any) {
      setStartError(e?.message || "Yayın başlatılamadı")
      setPhase("setup")
    }
  }

  const resumeLive = async () => {
    if (!resume || !room || !videoTrack) return
    setPhase("starting")
    try {
      setLiveRoomId(resume.liveRoomId)
      setSupervised(!!resume.supervised)
      setTitle(resume.title)
      await live.connect(resume.roomUrl, resume.token)
      await publishAll(room)
      setStartedAt(new Date(resume.startedAt).getTime())
      setResume(null)
      setPhase("live")
    } catch (e: any) {
      setStartError(e?.message || "Yayına dönülemedi")
      setPhase("setup")
    }
  }

  const stopRecordingIfAny = async () => {
    const r = recorderRef.current
    if (r && r.state === "recording") {
      try {
        await r.stop()
        setRecSaved(true)
      } catch {}
    }
  }

  const endLive = async () => {
    if (!confirm("Yayını bitirmek istediğinize emin misiniz? Tüm izleyicilerin bağlantısı kesilir.")) return
    await stopRecordingIfAny()
    if (liveRoomId) {
      await fetch("/api/room/instant", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveRoomId }),
      }).catch(() => {})
    }
    await live.disconnect().catch(() => {})
    if (screenTrack) { screenTrack.stop(); setScreenTrack(null) }
    setSharing(false)
    setPhase("ended")
  }

  // warn before closing the tab while live
  useEffect(() => {
    if (phase !== "live") return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [phase])

  // peak viewers
  useEffect(() => {
    setPeak((p) => Math.max(p, live.viewerCount))
  }, [live.viewerCount])

  // ── in-stream controls ───────────────────────────────────────────────────
  const toggleMic = async () => {
    if (!audioTrack) return
    if (micOn) await audioTrack.mute()
    else await audioTrack.unmute()
    setMicOn(!micOn)
  }
  const toggleCam = async () => {
    if (!videoTrack) return
    if (camOn) await videoTrack.mute()
    else await videoTrack.unmute()
    setCamOn(!camOn)
  }
  const toggleShare = async () => {
    if (sharing) {
      // Stop sharing
      try {
        if (isLive && room && screenTrack) {
          await room.localParticipant.unpublishTrack(screenTrack, true)
        }
      } catch {}
      screenTrack?.stop()
      setScreenTrack(null)
      setSharing(false)
      return
    }

    try {
      const tracks = await createLocalScreenTracks({ audio: false })
      const vt = tracks[0] as LocalVideoTrack
      if (!vt) return

      // When the OS "Stop sharing" overlay is clicked, clean up automatically
      vt.mediaStreamTrack.addEventListener("ended", () => {
        setScreenTrack(null)
        setSharing(false)
      })

      if (isLive && room) {
        await room.localParticipant.publishTrack(vt, {
          source: Track.Source.ScreenShare,
          name: "screen",
          contentHint: "detail",
        } as any)
      }

      setScreenTrack(vt)
      setSharing(true)
    } catch {
      /* user cancelled picker */
    }
  }
  useEffect(() => {
    if (!room) return
    const onUnpub = (pub: { source: Track.Source }) => {
      if (pub.source === Track.Source.ScreenShare) setSharing(false)
    }
    room.on(RoomEvent.LocalTrackUnpublished, onUnpub as any)
    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, onUnpub as any)
    }
  }, [room])

  // ── recording (official, server-side, teacher presses the button) ────────
  const toggleRecording = async () => {
    if (!room || !liveRoomId) return
    setRecError(null)
    if (!recorderRef.current) {
      recorderRef.current = new RoomRecorder(room, (s, detail) => {
        setRecState(s)
        if (s === "error") setRecError(detail || "Kayıt hatası")
      })
    }
    const r = recorderRef.current
    try {
      if (r.state === "recording") {
        await r.stop()
        setRecSaved(true)
      } else {
        setRecSaved(false)
        await r.start({ liveRoomId })
      }
    } catch (e: any) {
      setRecError(e?.message || "Kayıt hatası")
    }
  }
  useEffect(() => {
    if (recState !== "recording") return
    const t = setInterval(() => setRecElapsed(recorderRef.current?.elapsedSec ?? 0), 1000)
    return () => clearInterval(t)
  }, [recState])

  // ── moderation ───────────────────────────────────────────────────────────
  const moderate = async (body: object) => {
    if (!liveRoomId) return
    await fetch(`/api/live/${liveRoomId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {})
  }
  const kick = (identity: string, name: string) => {
    if (confirm(`${name} yayından çıkarılsın mı?`)) moderate({ action: "kick", identity })
  }

  // ── uplink health ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "live" || !videoTrack) return
    let prev: { bytes: number; ts: number } | null = null
    const tick = async () => {
      const stats = await videoTrack.getSenderStats().catch(() => [])
      if (!stats || stats.length === 0) return
      const top = [...stats].sort((a, b) => (b.frameWidth || 0) - (a.frameWidth || 0))[0]
      const bytes = stats.reduce((s, x) => s + ((x as any).bytesSent || 0), 0)
      const ts = (top as any).timestamp ?? Date.now()
      let bitrate: number | undefined
      if (prev && ts > prev.ts) bitrate = ((bytes - prev.bytes) * 8) / ((ts - prev.ts) / 1000)
      prev = { bytes, ts }
      const rtt = (top as any).roundTripTime !== undefined ? (top as any).roundTripTime * 1000 : undefined
      setUplink({
        width: top.frameWidth,
        height: top.frameHeight,
        fps: top.framesPerSecond ? Math.round(top.framesPerSecond) : undefined,
        bitrate,
        limitation: top.qualityLimitationReason,
        rtt,
        grade: gradeUplink({ qualityLimitationReason: top.qualityLimitationReason, roundTripTimeMs: rtt, fps: top.framesPerSecond, targetFps: preset.fps }),
      })
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => clearInterval(id)
  }, [phase, videoTrack, preset.fps])

  const uptime = startedAt ? formatDuration((now - startedAt) / 1000) : "00:00"
  const isLive = phase === "live"

  // ── ended summary ────────────────────────────────────────────────────────
  if (phase === "ended") {
    return (
      <div className="min-h-screen bg-stage text-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <Radio size={36} className="text-white/60" />
        <h1 className="font-display text-4xl">Yayın bitti</h1>
        <p className="text-white/60">Süre {uptime} · en yüksek izleyici sayısı {peak}</p>
        {recSaved && <p className="text-emerald-300 text-sm">Ders kaydınız hazır. Panelinizdeki "Ders Kayıtları" bölümünden indirebilirsiniz (30 gün saklanır).</p>}
        <div className="flex gap-3">
          <Link href="/teach" className="bg-accent hover:bg-accent-dark px-6 py-2.5 rounded-full text-sm font-semibold">Panele dön</Link>
          <button onClick={() => window.location.reload()} className="border border-white/30 hover:bg-white/10 px-6 py-2.5 rounded-full text-sm font-semibold">Yeni yayın</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#0e0e10] text-white flex flex-col overflow-hidden">
      <StaffNoticeBanner notice={live.staffNotice} onDismiss={live.dismissStaffNotice} />

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="h-12 shrink-0 flex items-center gap-3 px-4 bg-[#18181b] border-b border-white/[0.07] z-20">
        <Link href="/teach" className="font-display text-lg tracking-[0.2em] text-white/50 hover:text-white transition-colors shrink-0">AYA</Link>
        <span className="text-white/15 text-lg">|</span>

        {/* Stream title: inline edit pre-live, static when live */}
        {isLive ? (
          <span className="text-sm text-white/75 font-medium truncate max-w-[200px] lg:max-w-sm">{title}</span>
        ) : (
          <input
            data-testid="stream-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Yayın başlığı…"
            className="text-sm bg-transparent border-none focus:outline-none text-white/75 placeholder:text-white/25 min-w-0 w-40 lg:w-64 truncate"
          />
        )}

        {(supervised || trial) && (
          <span data-testid="studio-supervised" className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-saffron-300/15 text-saffron-300 border border-saffron-300/25">
            Deneme · denetimli
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isLive && (
            <>
              <span className={`hidden lg:inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border ${GRADE_STYLE[uplink.grade].cls}`}>
                <Wifi size={11} /> {GRADE_STYLE[uplink.grade].label}
              </span>
              <span data-testid="studio-viewers" className="flex items-center gap-1.5 text-sm text-white/60 tabular-nums">
                <Users size={13} className="text-white/35" /> {live.viewerCount}
              </span>
              <span data-testid="studio-uptime" className="text-sm tabular-nums text-white/60 font-mono hidden sm:block">{uptime}</span>
              <span data-testid="studio-live-badge" className="inline-flex items-center gap-1.5 bg-red-600 text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> CANLI
              </span>
              <button data-testid="end-stream" onClick={endLive} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-white/8 hover:bg-red-600 border border-white/10 hover:border-red-500 transition-colors">
                Yayını bitir
              </button>
            </>
          )}
          {!isLive && (
            <span className="text-[11px] text-white/30 flex items-center gap-1.5 uppercase tracking-wider">
              <Circle size={8} className="fill-white/20 text-white/20" /> Çevrimdışı
            </span>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── Left: preview + controls ───────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">

          {/* Trial notice */}
          {(trial || supervised) && !isLive && (
            <div data-testid="studio-trial-note" className="shrink-0 mx-3 mt-2.5 rounded-lg border border-saffron-300/25 bg-saffron-300/8 px-3.5 py-2.5">
              <p className="font-semibold text-saffron-300 text-[11px] uppercase tracking-wider mb-0.5">Deneme sürecindesin</p>
              <p className="text-white/55 text-xs leading-relaxed">Yayınların yetkililer tarafından canlı izlenir. Başarılı yayın sonrası Onaylı öğretmen rozetini alırsın.</p>
            </div>
          )}

          {/* ── Preview area (takes all remaining height) ───────────── */}
          <div
            ref={containerRef}
            className="flex-1 min-h-0 relative bg-black group overflow-hidden"
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={previewRef}
              data-testid="studio-preview"
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-contain ${sharing ? "" : "-scale-x-100"} ${!sharing && !camOn && videoTrack ? "opacity-0" : ""}`}
            />

            {/* Loading spinner */}
            {!videoTrack && !screenTrack && !mediaError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <Loader2 className="animate-spin text-white/20" size={32} />
              </div>
            )}

            {/* Camera off placeholder */}
            {!sharing && !camOn && videoTrack && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0e0e10]">
                <CameraOff size={44} className="text-white/15" />
                <span className="text-xs text-white/25">Kamera kapalı</span>
              </div>
            )}

            {/* No camera / soft warning */}
            {!videoTrack && !screenTrack && mediaError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0e0e10] px-8">
                <CameraOff size={36} className="text-white/15" />
                <p role="status" className="text-center text-xs text-white/35 max-w-xs">{mediaError}</p>
              </div>
            )}

            {/* Both failed */}
            {!videoTrack && !audioTrack && !screenTrack && mediaError && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0e0e10] px-8">
                <p role="alert" className="text-center text-sm text-amber-300/80 max-w-sm">{mediaError}</p>
              </div>
            )}

            {/* ── PiP camera when screen sharing ─────────────────────── */}
            {sharing && videoTrack && (
              <div className="absolute bottom-14 right-3 w-44 aspect-video rounded-xl overflow-hidden border border-white/15 shadow-2xl bg-black ring-1 ring-black/50">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={pipRef} autoPlay muted playsInline className={`w-full h-full object-cover -scale-x-100 ${!camOn ? "opacity-0" : ""}`} />
                {!camOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0e0e10]">
                    <CameraOff size={16} className="text-white/25" />
                  </div>
                )}
                <span className="absolute bottom-1.5 left-1.5 text-[9px] text-white/50 bg-black/60 px-1.5 py-0.5 rounded">Kamera</span>
              </div>
            )}

            {/* ── Top-left badges ─────────────────────────────────────── */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              {isLive && recState === "recording" && (
                <span data-testid="studio-rec" className="inline-flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-[11px] px-2.5 py-1.5 rounded-full border border-red-500/40">
                  <Circle size={8} className="fill-red-500 text-red-500 animate-pulse" /> REC {formatDuration(recElapsed)}
                </span>
              )}
            </div>

            {/* ── Top-right: quality label + fullscreen ───────────────── */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="text-[11px] bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 text-white/50 border border-white/10">
                {preset.label} · {preset.width}×{preset.height} · {preset.fps}fps
              </span>
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Pencere moduna dön" : "Tam ekran"}
                className="w-8 h-8 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-md border border-white/10 text-white/50 hover:text-white hover:border-white/25 transition-colors"
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>

            {/* ── Screen share badge (centre top) ─────────────────────── */}
            {sharing && screenTrack && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/65 backdrop-blur-sm text-[11px] px-3 py-1.5 rounded-full border border-white/12">
                <MonitorUp size={12} className="text-accent" />
                <span className="text-white/75">Ekran paylaşılıyor</span>
              </div>
            )}

            {/* ── Floating control dock (visible on hover) ─────────────── */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-8 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-200">

              {/* Mic level bar (inline in dock) */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 text-white/40">
                  {micOn ? <Mic size={12} /> : <MicOff size={12} className="text-red-400/70" />}
                </div>
                <div className="flex-1 max-w-[120px] h-1 bg-white/12 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-[width] duration-75" style={{ width: `${micOn ? micLevel * 100 : 0}%` }} />
                </div>
                {isLive && uplink.grade !== "good" && (
                  <span className={`text-[10px] ml-auto ${uplink.grade === "poor" ? "text-red-400" : "text-amber-400"}`}>
                    ⚠ {uplink.grade === "poor" ? "Bağlantı zayıf" : "Bağlantı orta"}
                  </span>
                )}
              </div>

              {/* Main controls row */}
              <div className="flex items-center gap-1.5">
                {/* Mic */}
                <button
                  data-testid="toggle-mic"
                  onClick={audioTrack ? toggleMic : undefined}
                  disabled={!audioTrack}
                  title={micOn ? "Mikrofonu kapat" : "Mikrofonu aç"}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm border text-sm font-medium transition-colors disabled:opacity-40 ${micOn ? "bg-white/10 border-white/10 hover:bg-white/15 text-white" : "bg-red-500/20 border-red-500/30 text-red-300"}`}
                >
                  {micOn ? <Mic size={15} /> : <MicOff size={15} />}
                  <span className="hidden sm:inline text-xs">{micOn ? "Mikrofon" : "Sessiz"}</span>
                </button>

                {/* Camera */}
                {videoTrack ? (
                  <button
                    data-testid="toggle-cam"
                    onClick={toggleCam}
                    title={camOn ? "Kamerayı kapat" : "Kamerayı aç"}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm border text-sm font-medium transition-colors ${camOn ? "bg-white/10 border-white/10 hover:bg-white/15 text-white" : "bg-red-500/20 border-red-500/30 text-red-300"}`}
                  >
                    {camOn ? <Camera size={15} /> : <CameraOff size={15} />}
                    <span className="hidden sm:inline text-xs">{camOn ? "Kamera" : "Kamera kapalı"}</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/4 border border-white/8 text-white/20 cursor-default">
                    <CameraOff size={15} />
                    <span className="hidden sm:inline text-xs">Kamera yok</span>
                  </span>
                )}

                {/* Screen share */}
                <button
                  data-testid="toggle-share"
                  onClick={toggleShare}
                  title={sharing ? "Ekran paylaşımını durdur" : "Ekranı paylaş"}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm border text-sm font-medium transition-colors ${sharing ? "bg-accent border-accent/60 text-white shadow-lg shadow-accent/20" : "bg-white/10 border-white/10 hover:bg-white/15 text-white"}`}
                >
                  <MonitorUp size={15} />
                  <span className="hidden sm:inline text-xs">{sharing ? "Paylaşımı durdur" : "Ekran paylaş"}</span>
                </button>

                {/* Record (live only) */}
                {isLive && (
                  <button
                    data-testid="record-stream"
                    onClick={toggleRecording}
                    disabled={recState === "starting" || recState === "stopping"}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm border text-sm font-medium transition-colors disabled:opacity-50 ${recState === "recording" ? "bg-red-500/25 border-red-500/40 text-red-200" : "bg-white/10 border-white/10 hover:bg-white/15 text-white"}`}
                  >
                    {recState === "recording" ? <SquareStop size={15} /> : <Circle size={15} className="text-red-400" />}
                    <span className="hidden sm:inline text-xs">
                      {recState === "starting" ? "Başlatılıyor…" : recState === "stopping" ? "Yükleniyor…" : recState === "recording" ? `Kaydı bitir` : "Kaydet"}
                    </span>
                  </button>
                )}

                <div className="flex-1" />

                {/* Settings toggle (pre-live) */}
                {!isLive && (
                  <button
                    onClick={() => setShowSettings(s => !s)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg backdrop-blur-sm border border-white/10 bg-white/8 hover:bg-white/12 text-white/60 hover:text-white text-sm transition-colors"
                  >
                    <Settings2 size={14} />
                    <span className="hidden sm:inline text-xs">Ayarlar</span>
                    {showSettings ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Settings drawer (collapsible, pre-live) ─────────────────── */}
          {!isLive && showSettings && (
            <div className="shrink-0 border-t border-white/[0.07] bg-[#18181b] overflow-y-auto" style={{ maxHeight: "clamp(180px, 30vh, 280px)" }}>
              <div className="p-4 space-y-4">
                {workshopTitle && (
                  <p className="text-xs rounded-lg border border-accent/30 bg-accent/8 px-3 py-2" data-testid="workshop-banner">
                    <span className="text-accent font-semibold">Atölye:</span>{" "}
                    <span className="text-white/70">{workshopTitle} — yalnızca onaylı katılımcılar izleyebilir.</span>
                  </p>
                )}

                {/* Quality presets */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 mb-2 flex items-center gap-1.5">
                    <SignalHigh size={11} /> Yayın kalitesi
                  </p>
                  <div data-testid="preset-list" className="flex flex-wrap gap-1.5">
                    {BROADCAST_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        data-testid={`preset-${p.id}`}
                        onClick={() => changePreset(p.id)}
                        aria-pressed={presetId === p.id}
                        className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${presetId === p.id ? "border-accent bg-accent/15 text-white" : "border-white/10 hover:border-white/20 bg-white/5 text-white/60 hover:text-white"}`}
                      >
                        <span className="block text-sm font-semibold leading-none">
                          {p.label}
                          {p.id === DEFAULT_PRESET_ID && <span className="ml-1.5 text-[9px] text-emerald-400">✓ önerilen</span>}
                        </span>
                        <span className="block text-[10px] text-white/40 mt-0.5">{formatBitrate(p.maxBitrate)} · {p.fps}fps</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/30 mt-1.5">{preset.hint}</p>
                </div>

                {/* Device selectors */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Kamera</span>
                    <select data-testid="camera-select" value={camId} onChange={(e) => changeCamera(e.target.value)} className="mt-1.5 w-full bg-white/6 border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-accent/50 transition-colors">
                      <option value="">Varsayılan kamera</option>
                      {devices.cams.map((d) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label || "Kamera"}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Mikrofon</span>
                    <select data-testid="mic-select" value={micId} onChange={(e) => changeMic(e.target.value)} className="mt-1.5 w-full bg-white/6 border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-accent/50 transition-colors">
                      <option value="">Varsayılan mikrofon</option>
                      {devices.mics.map((d) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label || "Mikrofon"}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Go Live bar (pre-live) ───────────────────────────────────── */}
          {!isLive && (
            <div className="shrink-0 px-4 py-3 bg-[#111113] border-t border-white/[0.07] flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {startError && <p role="alert" className="text-xs text-red-400">{startError}</p>}
                {resume && !startError && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-300/80 truncate">Devam eden yayın: &ldquo;{resume.title}&rdquo;</span>
                    <button data-testid="resume-stream" onClick={resumeLive} className="shrink-0 bg-amber-400 text-black font-bold text-xs px-3 py-1.5 rounded-lg">Devam et</button>
                  </div>
                )}
                {!resume && !startError && (
                  <p className="text-[11px] text-white/25">
                    <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-white/50 transition-colors">Yayın sözleşmesi</Link> kabul edilmiş sayılır · Kayıt yalnızca "Kaydet" düğmesiyle başlar
                  </p>
                )}
              </div>
              <button
                data-testid="go-live"
                onClick={goLive}
                disabled={phase === "starting" || (!videoTrack && !audioTrack && !screenTrack) || !room}
                className="shrink-0 inline-flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-accent/25"
              >
                {phase === "starting"
                  ? <><Loader2 size={15} className="animate-spin" /> Başlatılıyor…</>
                  : <><Radio size={15} /> Yayına başla</>
                }
              </button>
            </div>
          )}

          {/* ── Live stats micro-bar ─────────────────────────────────────── */}
          {isLive && (
            <div className="shrink-0 px-4 py-1.5 bg-[#111113] border-t border-white/[0.07] flex items-center gap-4 text-[10px] text-white/30">
              {uplink.width && <span>{uplink.width}×{uplink.height} · {uplink.fps}fps</span>}
              {uplink.bitrate && <span>{formatBitrate(uplink.bitrate)}</span>}
              {uplink.rtt !== undefined && <span>RTT {Math.round(uplink.rtt)}ms</span>}
              {recError && <span className="text-red-400 ml-auto">{recError}</span>}
              {recSaved && <span className="text-emerald-400 ml-auto">✓ Kayıt yüklendi (30 gün saklanır)</span>}
            </div>
          )}
        </main>

        {/* ── Right panel: chat / viewers / moderation ─────────────────── */}
        <aside className="w-[17rem] lg:w-72 xl:w-80 shrink-0 border-l border-white/[0.07] flex flex-col bg-[#18181b] min-h-0">
          {/* Tab bar */}
          <div className="shrink-0 flex bg-[#1a1a1e] border-b border-white/[0.07]">
            {(["chat", "viewers", "settings"] as const).map((id) => {
              const cfg = {
                chat: { icon: <MessageSquare size={13} />, label: "Sohbet" },
                viewers: { icon: <Users size={13} />, label: `(${live.viewerCount})` },
                settings: { icon: <ShieldBan size={13} />, label: "Denetim" },
              }
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${tab === id ? "border-accent text-white" : "border-transparent text-white/35 hover:text-white/65"}`}
                >
                  {cfg[id].icon} {cfg[id].label}
                </button>
              )
            })}
          </div>

          {tab === "chat" && (
            <LiveChatPanel className="flex-1 min-h-0" messages={live.messages} settings={live.settings} isHost connected={isLive} onSend={live.sendChat} onKick={kick} />
          )}

          {tab === "viewers" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5" data-testid="viewer-list">
              {!isLive && <p className="text-xs text-white/30 text-center py-8">Yayın başlayınca izleyiciler görünür.</p>}
              {isLive && live.viewers.length === 0 && <p className="text-xs text-white/30 text-center py-8">Henüz izleyici yok.</p>}
              {live.viewers.map((v) => (
                <div key={v.identity} className="flex items-center justify-between rounded-lg hover:bg-white/5 px-3 py-2">
                  <span className="text-sm text-white/75">{v.name}</span>
                  <button onClick={() => kick(v.identity, v.name)} className="text-[11px] text-red-400/60 hover:text-red-300 transition-colors">Çıkar</button>
                </div>
              ))}
            </div>
          )}

          {tab === "settings" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 mb-3">Sohbet moderasyonu</h3>
                <label className="flex items-center justify-between py-1.5 border-b border-white/[0.06]">
                  <span className="text-white/65 text-sm">Sohbet açık</span>
                  <input data-testid="chat-enabled" type="checkbox" checked={live.settings.chatEnabled} disabled={!isLive} onChange={(e) => moderate({ action: "chat-settings", chatEnabled: e.target.checked })} className="w-4 h-4 accent-orange-600" />
                </label>
                <label className="flex items-center justify-between py-1.5">
                  <span className="text-white/65 text-sm">Yavaş mod</span>
                  <select data-testid="slow-mode" value={live.settings.slowModeSec} disabled={!isLive} onChange={(e) => moderate({ action: "chat-settings", slowModeSec: Number(e.target.value) })} className="bg-white/8 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none">
                    {SLOW_MODE_OPTIONS.map((s) => <option key={s} value={s} className="text-black">{s === 0 ? "Kapalı" : `${s} sn`}</option>)}
                  </select>
                </label>
                {!isLive && <p className="text-xs text-white/30 mt-2">Yayın sırasında değiştirilebilir.</p>}
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 mb-3">Yayın sağlığı</h3>
                {!isLive ? (
                  <p className="text-xs text-white/30">Yayın başlayınca istatistikler görünür.</p>
                ) : (
                  <dl data-testid="health" className="space-y-2 text-xs">
                    {[
                      ["Durum", <span key="g" className={GRADE_STYLE[uplink.grade].cls.split(" ")[1]}>{GRADE_STYLE[uplink.grade].label}</span>],
                      ["Çözünürlük", uplink.width && uplink.height ? `${uplink.width}×${uplink.height}` : "—"],
                      ["Kare hızı", `${uplink.fps ?? "—"} fps`],
                      ["Gönderim", formatBitrate(uplink.bitrate ?? 0)],
                      ["RTT", uplink.rtt !== undefined ? `${Math.round(uplink.rtt)} ms` : "—"],
                    ].map(([label, val]) => (
                      <div key={String(label)} className="flex justify-between">
                        <dt className="text-white/35">{label}</dt>
                        <dd className="text-white/70">{val}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {isLive && uplink.grade === "poor" && (
                  <p className="text-xs text-amber-400/80 mt-3 bg-amber-400/8 border border-amber-400/20 rounded-lg px-3 py-2">
                    Bağlantı zayıf. Kaliteyi 480p veya 360p&apos;ye düşürmeyi deneyin.
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
