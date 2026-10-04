"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPreset,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client"
import {
  Camera,
  CameraOff,
  Circle,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
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

export function Studio() {
  const router = useRouter()
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
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [liveRoomId, setLiveRoomId] = useState<string | null>(null)
  const [resume, setResume] = useState<{ title: string; roomUrl: string; token: string; liveRoomId: string; startedAt: string } | null>(null)
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
  const recorderRef = useRef<RoomRecorder | null>(null)
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
      try {
        v = await createLocalVideoTrack(captureOf(getPreset(DEFAULT_PRESET_ID)))
        a = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })
        if (cancelled) {
          v.stop()
          a.stop()
          return
        }
        setVideoTrack(v)
        setAudioTrack(a)
        await loadDevices()
      } catch (e: any) {
        setMediaError(
          e?.name === "NotAllowedError"
            ? "Kamera ve mikrofon izni verilmedi. Tarayıcı adres çubuğundaki izin simgesinden izin verip sayfayı yenileyin."
            : "Kamera veya mikrofon açılamadı: " + (e?.message || "bilinmeyen hata")
        )
      }
    })()
    return () => {
      cancelled = true
      v?.stop()
      a?.stop()
    }
  }, [loadDevices])

  useEffect(() => {
    const el = previewRef.current
    if (!el || !videoTrack) return
    videoTrack.attach(el)
    return () => {
      videoTrack.detach(el)
    }
  }, [videoTrack])

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
    },
    [videoTrack, audioTrack, preset]
  )

  const goLive = async () => {
    if (!room || !videoTrack) return
    setStartError(null)
    setPhase("starting")
    try {
      const res = await fetch("/api/room/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403 && data.code === "TERMS_REQUIRED") return router.replace("/accept-terms?next=/live/studio")
      if (!res.ok) throw new Error(data.error || "Yayın başlatılamadı")
      setLiveRoomId(data.liveRoomId)
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
    if (!room) return
    try {
      await room.localParticipant.setScreenShareEnabled(!sharing, { audio: true, contentHint: "detail" })
      setSharing(!sharing)
    } catch {
      /* user cancelled the picker */
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
        {recSaved && <p className="text-emerald-300 text-sm">Ders kaydınız hazır. Panelinizdeki “Ders Kayıtları” bölümünden indirebilirsiniz (30 gün saklanır).</p>}
        <div className="flex gap-3">
          <Link href="/teach" className="bg-accent hover:bg-accent-dark px-6 py-2.5 rounded-full text-sm font-semibold">Panele dön</Link>
          <button onClick={() => window.location.reload()} className="border border-white/30 hover:bg-white/10 px-6 py-2.5 rounded-full text-sm font-semibold">Yeni yayın</button>
        </div>
      </div>
    )
  }

  const Tab = ({ id, icon, label }: { id: typeof tab; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 ${tab === id ? "border-accent text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-stage text-white flex flex-col">
      {/* top bar */}
      <header className="h-14 shrink-0 flex items-center gap-4 px-4 border-b border-white/10 bg-stage-2">
        <Link href="/teach" className="font-display text-xl tracking-[0.2em]">AYA</Link>
        <span className="text-white/30">/</span>
        <span className="text-sm text-white/70">Yayın stüdyosu</span>

        <div className="ml-auto flex items-center gap-3">
          {isLive && (
            <>
              <span data-testid="studio-live-badge" className="inline-flex items-center gap-1.5 bg-accent text-[11px] font-bold tracking-wider uppercase px-2 py-1 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Canlı
              </span>
              <span data-testid="studio-uptime" className="text-sm tabular-nums text-white/80">{uptime}</span>
              <span data-testid="studio-viewers" className="inline-flex items-center gap-1.5 text-sm text-white/80"><Users size={15} /> {live.viewerCount}</span>
              <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${GRADE_STYLE[uplink.grade].cls}`}>
                <Wifi size={13} /> {GRADE_STYLE[uplink.grade].label}
              </span>
              <button data-testid="end-stream" onClick={endLive} className="bg-red-600 hover:bg-red-700 text-sm font-semibold px-4 py-1.5 rounded-lg">Yayını bitir</button>
            </>
          )}
          {!isLive && (
            <span className="text-xs uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Circle size={9} className="fill-white/40 text-white/40" /> Çevrimdışı</span>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* left: preview + setup */}
        <main className="flex-1 min-w-0 p-4 lg:overflow-y-auto space-y-4">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden max-w-5xl">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={previewRef} data-testid="studio-preview" autoPlay muted playsInline className={`w-full h-full object-contain -scale-x-100 ${camOn ? "" : "invisible"}`} />
            {!videoTrack && !mediaError && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
            {!camOn && <div className="absolute inset-0 flex items-center justify-center text-white/60"><CameraOff size={40} /></div>}
            {mediaError && <p role="alert" className="absolute inset-0 flex items-center justify-center text-center text-sm text-amber-200 px-8">{mediaError}</p>}
            {isLive && (recState === "recording") && (
              <span data-testid="studio-rec" className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/70 text-xs px-2.5 py-1 rounded-full border border-red-500/40">
                <Circle size={9} className="fill-red-500 text-red-500 animate-pulse" /> KAYITTA {formatDuration(recElapsed)}
              </span>
            )}
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
              <div className="flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
                {micOn ? <Mic size={14} /> : <MicOff size={14} className="text-red-400" />}
                <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${micOn ? micLevel * 100 : 0}%` }} /></div>
              </div>
              <span className="text-[11px] bg-black/60 rounded px-2 py-1 text-white/80">{preset.label} · {preset.width}×{preset.height} · {preset.fps} fps</span>
            </div>
          </div>

          {/* in-stream controls */}
          <div className="flex flex-wrap items-center gap-2 max-w-5xl">
            <button data-testid="toggle-mic" onClick={toggleMic} disabled={!audioTrack} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${micOn ? "bg-white/10 hover:bg-white/20" : "bg-red-500/30 text-red-200"}`}>
              {micOn ? <Mic size={16} /> : <MicOff size={16} />} {micOn ? "Mikrofon açık" : "Mikrofon kapalı"}
            </button>
            <button data-testid="toggle-cam" onClick={toggleCam} disabled={!videoTrack} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${camOn ? "bg-white/10 hover:bg-white/20" : "bg-red-500/30 text-red-200"}`}>
              {camOn ? <Camera size={16} /> : <CameraOff size={16} />} {camOn ? "Kamera açık" : "Kamera kapalı"}
            </button>
            {isLive && (
              <>
                <button data-testid="toggle-share" onClick={toggleShare} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${sharing ? "bg-accent" : "bg-white/10 hover:bg-white/20"}`}>
                  <MonitorUp size={16} /> {sharing ? "Paylaşımı durdur" : "Ekran paylaş"}
                </button>
                <button data-testid="record-stream" onClick={toggleRecording} disabled={recState === "starting" || recState === "stopping"} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-60 ${recState === "recording" ? "bg-red-500/30 text-red-200" : "bg-white/10 hover:bg-white/20"}`}>
                  {recState === "recording" ? <SquareStop size={16} /> : <Circle size={16} className="text-red-400" />}
                  {recState === "starting" ? "Başlatılıyor…" : recState === "stopping" ? "Yükleniyor…" : recState === "recording" ? "Kaydı bitir" : "Dersi kaydet"}
                </button>
              </>
            )}
          </div>
          {recError && <p role="alert" className="text-sm text-red-300 max-w-5xl">{recError}</p>}
          {recSaved && isLive && <p className="text-sm text-emerald-300 max-w-5xl">Kayıt yüklendi. “Ders Kayıtları” bölümünden indirebilirsiniz (30 gün saklanır).</p>}

          {/* setup / quality */}
          <section className="max-w-5xl rounded-xl border border-white/10 bg-stage-2 p-4 space-y-4">
            <h2 className="text-xs font-semibold tracking-[0.18em] uppercase text-white/60">Yayın ayarları</h2>

            {!isLive && (
              <label className="block">
                <span className="text-xs text-white/60">Yayın başlığı</span>
                <input data-testid="stream-title-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1 w-full bg-white/10 border border-white/10 focus:border-white/40 focus:outline-none rounded-lg px-3 py-2 text-sm" />
              </label>
            )}

            <div>
              <span className="text-xs text-white/60 flex items-center gap-1.5"><SignalHigh size={13} /> Yayın kalitesi</span>
              <div data-testid="preset-list" className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BROADCAST_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    data-testid={`preset-${p.id}`}
                    onClick={() => changePreset(p.id)}
                    aria-pressed={presetId === p.id}
                    className={`text-left rounded-lg border px-3 py-2 transition ${presetId === p.id ? "border-accent bg-accent/15" : "border-white/10 hover:border-white/30 bg-white/5"}`}
                  >
                    <span className="block font-semibold text-sm">{p.label}{p.id === DEFAULT_PRESET_ID ? <span className="ml-1.5 text-[10px] uppercase text-emerald-300">önerilen</span> : null}</span>
                    <span className="block text-[11px] text-white/50 leading-tight mt-0.5">{formatBitrate(p.maxBitrate)} · {p.fps} fps</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/45 mt-2">{preset.hint}. İzleyiciler kendi bağlantılarına göre Otomatik, 1080p, 720p veya 360p seçebilir.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-white/60">Kamera</span>
                <select data-testid="camera-select" value={camId} onChange={(e) => changeCamera(e.target.value)} className="mt-1 w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <option value="">Varsayılan kamera</option>
                  {devices.cams.map((d) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label || "Kamera"}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-white/60">Mikrofon</span>
                <select data-testid="mic-select" value={micId} onChange={(e) => changeMic(e.target.value)} className="mt-1 w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <option value="">Varsayılan mikrofon</option>
                  {devices.mics.map((d) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label || "Mikrofon"}</option>)}
                </select>
              </label>
            </div>
          </section>

          {!isLive && (
            <div className="max-w-5xl space-y-3">
              {startError && <p role="alert" className="text-sm text-red-300">{startError}</p>}
              {resume && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm">
                  <span className="text-amber-200">Devam eden bir yayınınız var: “{resume.title}”</span>
                  <button data-testid="resume-stream" onClick={resumeLive} className="ml-auto bg-amber-400 text-black font-semibold px-4 py-1.5 rounded-lg">Yayına dön</button>
                </div>
              )}
              <button
                data-testid="go-live"
                onClick={goLive}
                disabled={phase === "starting" || !videoTrack || !audioTrack || !room}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-full"
              >
                {phase === "starting" ? <><Loader2 size={18} className="animate-spin" /> Başlatılıyor…</> : <><Radio size={18} /> Yayına başla</>}
              </button>
              <p className="text-xs text-white/40">Yayına başlayarak <Link href="/terms" target="_blank" className="underline">sözleşmeyi</Link> kabul etmiş sayılırsınız. Ders kaydı yalnızca siz “Dersi kaydet” düğmesine bastığınızda alınır ve odadaki herkes bilgilendirilir.</p>
            </div>
          )}
        </main>

        {/* right: chat / settings / viewers */}
        <aside className="lg:w-[22rem] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col h-[30rem] lg:h-auto min-h-0">
          <div className="flex border-b border-white/10 bg-stage-2">
            <Tab id="chat" icon={<MessageSquare size={14} />} label="Sohbet" />
            <Tab id="viewers" icon={<Users size={14} />} label={`İzleyici (${live.viewerCount})`} />
            <Tab id="settings" icon={<ShieldBan size={14} />} label="Denetim" />
          </div>

          {tab === "chat" && (
            <LiveChatPanel className="flex-1" messages={live.messages} settings={live.settings} isHost connected={isLive} onSend={live.sendChat} onKick={kick} />
          )}

          {tab === "viewers" && (
            <div className="flex-1 overflow-y-auto bg-stage-2 p-3 space-y-1" data-testid="viewer-list">
              {!isLive && <p className="text-sm text-white/40 p-3">Yayın başlayınca izleyiciler burada görünür.</p>}
              {isLive && live.viewers.length === 0 && <p className="text-sm text-white/40 p-3">Henüz izleyici yok.</p>}
              {live.viewers.map((v) => (
                <div key={v.identity} className="flex items-center justify-between rounded-lg hover:bg-white/5 px-3 py-2 text-sm">
                  <span>{v.name}</span>
                  <button onClick={() => kick(v.identity, v.name)} className="text-xs text-red-300 hover:text-red-200">Çıkar</button>
                </div>
              ))}
            </div>
          )}

          {tab === "settings" && (
            <div className="flex-1 overflow-y-auto bg-stage-2 p-4 space-y-5 text-sm">
              <div>
                <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-white/60 mb-2">Sohbet</h3>
                <label className="flex items-center justify-between">
                  <span>Sohbet açık</span>
                  <input data-testid="chat-enabled" type="checkbox" checked={live.settings.chatEnabled} disabled={!isLive} onChange={(e) => moderate({ action: "chat-settings", chatEnabled: e.target.checked })} className="w-4 h-4 accent-orange-600" />
                </label>
                <label className="flex items-center justify-between mt-3">
                  <span>Yavaş mod</span>
                  <select data-testid="slow-mode" value={live.settings.slowModeSec} disabled={!isLive} onChange={(e) => moderate({ action: "chat-settings", slowModeSec: Number(e.target.value) })} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                    {SLOW_MODE_OPTIONS.map((s) => <option key={s} value={s} className="text-black">{s === 0 ? "Kapalı" : `${s} sn`}</option>)}
                  </select>
                </label>
                {!isLive && <p className="text-xs text-white/40 mt-2">Bu ayarlar yayın sırasında değiştirilebilir.</p>}
              </div>

              <div>
                <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-white/60 mb-2">Yayın sağlığı</h3>
                {!isLive ? (
                  <p className="text-xs text-white/40">Yayın başlayınca gönderim istatistikleri burada görünür.</p>
                ) : (
                  <dl data-testid="health" className="grid grid-cols-2 gap-y-1.5 text-xs">
                    <dt className="text-white/50">Durum</dt><dd className={GRADE_STYLE[uplink.grade].cls.split(" ")[1]}>{GRADE_STYLE[uplink.grade].label}</dd>
                    <dt className="text-white/50">Çözünürlük</dt><dd>{uplink.width && uplink.height ? `${uplink.width}×${uplink.height}` : "—"}</dd>
                    <dt className="text-white/50">Kare hızı</dt><dd>{uplink.fps ?? "—"} fps</dd>
                    <dt className="text-white/50">Gönderim</dt><dd>{formatBitrate(uplink.bitrate ?? 0)}</dd>
                    <dt className="text-white/50">Gecikme (RTT)</dt><dd>{uplink.rtt !== undefined ? `${Math.round(uplink.rtt)} ms` : "—"}</dd>
                    <dt className="text-white/50">Sınırlama</dt><dd>{uplink.limitation && uplink.limitation !== "none" ? (uplink.limitation === "bandwidth" ? "Bant genişliği" : uplink.limitation === "cpu" ? "İşlemci" : uplink.limitation) : "Yok"}</dd>
                  </dl>
                )}
                {isLive && uplink.grade === "poor" && <p className="text-xs text-amber-300 mt-3">Bağlantınız zayıf. Kaliteyi 480p veya 360p’ye düşürmeyi deneyin.</p>}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
