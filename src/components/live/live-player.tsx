"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RemoteAudioTrack, RemoteTrackPublication, RemoteVideoTrack, VideoQuality, Room } from "livekit-client"
import { Activity, Check, Columns2, Loader2, Maximize, Minimize, Pause, PictureInPicture2, Play, Settings, Volume2, VolumeX, WifiOff } from "lucide-react"
import { viewerQualityOptions, formatBitrate, VQ } from "@/lib/live-quality"
import type { HostTracks, LiveState } from "./use-live-room"

interface Props {
  room: Room | null
  host: HostTracks
  state: LiveState
  audioBlocked: boolean
  theater: boolean
  onToggleTheater: () => void
  /** Rendered over the video when the host's camera is off / not yet publishing */
  waitingLabel?: string
}

interface PlaybackStats {
  width?: number
  height?: number
  fps?: number
  bitrate?: number
  lossPct?: number
}

const mapQuality = (q: number) => (q === VQ.HIGH ? VideoQuality.HIGH : q === VQ.MEDIUM ? VideoQuality.MEDIUM : VideoQuality.LOW)

/** Player with Twitch-like controls: volume, quality (Auto/1080p/720p/360p/audio only), theater, PiP, fullscreen, stats. */
export function LivePlayer({ room, host, state, audioBlocked, theater, onToggleTheater, waitingLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pipVideoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [qualityId, setQualityId] = useState("auto")
  const [menuOpen, setMenuOpen] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats] = useState<PlaybackStats>({})
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The shared screen (if any) takes the stage and the camera moves to a small inset
  const mainPub: RemoteTrackPublication | null = host.screen ?? host.camera
  const insetPub: RemoteTrackPublication | null = host.screen ? host.camera : null
  const mainTrack = (mainPub?.track as RemoteVideoTrack | undefined) ?? null
  const insetTrack = (insetPub?.track as RemoteVideoTrack | undefined) ?? null
  const audioTrack = (host.audio?.track as RemoteAudioTrack | undefined) ?? null
  const videoOff = qualityId === "audio"

  const sourceHeight = mainPub?.dimensions?.height ?? 720
  const options = useMemo(() => viewerQualityOptions(sourceHeight, 30), [sourceHeight])

  // ── attach tracks ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current
    if (!el || !mainTrack || videoOff) return
    mainTrack.attach(el)
    el.play().catch(() => {})
    return () => {
      mainTrack.detach(el)
    }
  }, [mainTrack, videoOff])

  useEffect(() => {
    const el = pipVideoRef.current
    if (!el || !insetTrack || videoOff) return
    insetTrack.attach(el)
    el.play().catch(() => {})
    return () => {
      insetTrack.detach(el)
    }
  }, [insetTrack, videoOff])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !audioTrack) return
    audioTrack.attach(el)
    return () => {
      audioTrack.detach(el)
    }
  }, [audioTrack])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
    el.muted = muted
  }, [volume, muted, audioTrack])

  // ── quality selection (re-applied whenever the publication changes, e.g. host changed preset) ──
  const applyQuality = useCallback(
    (id: string) => {
      const pubs = [mainPub, insetPub].filter(Boolean) as RemoteTrackPublication[]
      if (id === "audio") {
        pubs.forEach((p) => p.setEnabled(false))
        return
      }
      const opt = options.find((o) => o.id === id)
      pubs.forEach((p) => {
        p.setEnabled(true)
        p.setVideoQuality(id === "auto" || !opt || opt.quality === undefined ? VideoQuality.HIGH : mapQuality(opt.quality))
      })
    },
    [mainPub, insetPub, options]
  )

  useEffect(() => {
    applyQuality(qualityId)
  }, [qualityId, applyQuality])

  // ── stats (resolution / fps / bitrate / loss) ────────────────────────────
  useEffect(() => {
    if (!showStats || !mainTrack) return
    let prev: { bytes: number; ts: number; frames: number } | null = null
    const tick = async () => {
      const s = await mainTrack.getReceiverStats().catch(() => undefined)
      if (!s) return
      const bytes = s.bytesReceived ?? 0
      const ts = (s as any).timestamp ?? Date.now()
      const frames = s.framesReceived ?? 0
      let bitrate: number | undefined
      let fps: number | undefined
      if (prev && ts > prev.ts) {
        const dt = (ts - prev.ts) / 1000
        bitrate = ((bytes - prev.bytes) * 8) / dt
        fps = (frames - prev.frames) / dt
      }
      prev = { bytes, ts, frames }
      const lost = s.packetsLost ?? 0
      const recv = s.packetsReceived ?? 0
      setStats({
        width: s.frameWidth,
        height: s.frameHeight,
        fps: fps !== undefined ? Math.round(fps) : undefined,
        bitrate,
        lossPct: recv + lost > 0 ? (lost / (recv + lost)) * 100 : 0,
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [showStats, mainTrack])

  // ── fullscreen / controls auto-hide ──────────────────────────────────────
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current)
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  const poke = () => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!menuOpen) setControlsVisible(false)
    }, 3000)
  }
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else wrapRef.current?.requestFullscreen?.().catch(() => {})
  }

  const togglePip = async () => {
    const el = videoRef.current
    if (!el) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await el.requestPictureInPicture()
    } catch {}
  }

  const togglePause = () => {
    const el = videoRef.current
    if (!el) return
    if (paused) {
      el.play().catch(() => {})
      setPaused(false)
    } else {
      el.pause()
      setPaused(true)
    }
  }

  const startAudio = () => {
    room?.startAudio().catch(() => {})
    audioRef.current?.play().catch(() => {})
  }

  const hasVideo = !!mainTrack && !videoOff
  const currentLabel = qualityId === "auto" ? "Otomatik" : options.find((o) => o.id === qualityId)?.label ?? "Otomatik"

  return (
    <div
      ref={wrapRef}
      data-testid="live-player"
      onMouseMove={poke}
      onMouseLeave={() => !menuOpen && setControlsVisible(false)}
      className={`relative bg-black overflow-hidden group ${theater ? "w-full" : "rounded-xl"} ${fullscreen ? "h-screen" : "aspect-video"}`}
    >
      <video ref={videoRef} data-testid="live-video" playsInline muted className={`absolute inset-0 w-full h-full object-contain bg-black ${hasVideo ? "" : "invisible"}`} />
      <audio ref={audioRef} autoPlay />

      {/* camera inset while a screen is shared */}
      {insetTrack && !videoOff && (
        <video ref={pipVideoRef} playsInline muted className="absolute bottom-16 right-4 w-44 aspect-video rounded-lg border border-white/30 object-cover bg-black shadow-xl" />
      )}

      {/* states */}
      {(state === "connecting" || state === "idle") && (
        <Overlay><Loader2 className="animate-spin" size={32} /><p>Yayına bağlanılıyor…</p></Overlay>
      )}
      {state === "reconnecting" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-amber-500 text-black text-sm font-medium px-4 py-1.5 rounded-full">
          <WifiOff size={14} /> Bağlantı koptu, yeniden bağlanılıyor…
        </div>
      )}
      {state === "live" && videoOff && (
        <Overlay><Volume2 size={36} /><p className="font-medium">Yalnız ses modu</p><p className="text-sm text-white/60">Video kapalı, veri kullanımı düşük.</p></Overlay>
      )}
      {state === "live" && !mainTrack && !videoOff && (
        <Overlay><Loader2 className="animate-spin" size={28} /><p>{waitingLabel ?? "Yayıncının görüntüsü bekleniyor…"}</p></Overlay>
      )}
      {audioBlocked && state === "live" && (
        <button onClick={startAudio} data-testid="enable-audio" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
          <VolumeX size={42} />
          <span className="text-lg font-semibold">Sesi açmak için tıklayın</span>
        </button>
      )}

      {/* stats panel */}
      {showStats && (
        <div data-testid="stats-panel" className="absolute top-3 left-3 z-20 bg-black/80 text-[11px] font-mono leading-5 text-white/90 rounded-lg px-3 py-2 border border-white/10">
          <div>Çözünürlük: {stats.width && stats.height ? `${stats.width}×${stats.height}` : "—"}</div>
          <div>Kare hızı: {stats.fps ?? "—"} fps</div>
          <div>Bit hızı: {formatBitrate(stats.bitrate ?? 0)}</div>
          <div>Paket kaybı: {stats.lossPct !== undefined ? `${stats.lossPct.toFixed(1)}%` : "—"}</div>
          <div>Seçili kalite: {currentLabel}</div>
        </div>
      )}

      {/* control bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 pt-10 pb-2.5 px-3 bg-gradient-to-t from-black/85 to-transparent transition-opacity duration-300 ${controlsVisible || menuOpen || paused ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <div className="flex items-center gap-1 text-white">
          <IconBtn label={paused ? "Oynat" : "Duraklat"} onClick={togglePause} testId="play-pause">
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </IconBtn>
          <IconBtn label={muted ? "Sesi aç" : "Sessize al"} onClick={() => setMuted((m) => !m)} testId="mute">
            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </IconBtn>
          <input
            aria-label="Ses düzeyi"
            data-testid="volume"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={muted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value))
              setMuted(false)
            }}
            className="w-20 accent-white hidden sm:block"
          />
          {paused && (
            <button onClick={togglePause} className="ml-2 text-xs bg-accent hover:bg-accent-dark px-2.5 py-1 rounded-full font-semibold">
              Canlıya dön
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            <IconBtn label="Yayın istatistikleri" onClick={() => setShowStats((s) => !s)} active={showStats} testId="toggle-stats">
              <Activity size={18} />
            </IconBtn>

            <div className="relative">
              <button
                data-testid="quality-button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-white/15 text-sm font-medium"
              >
                <Settings size={17} /> {currentLabel}
              </button>
              {menuOpen && (
                <>
                {/* phones: a bottom sheet (the 16:9 player is too short for a floating menu); desktop: a popover */}
                <div className="fixed inset-0 z-40 sm:hidden bg-black/50" onClick={() => setMenuOpen(false)} aria-hidden />
                <div role="menu" data-testid="quality-menu" className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-2xl sm:rounded-lg sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:mb-2 sm:w-48 sm:max-h-none overflow-y-auto bg-stage-2 sm:bg-stage-2/95 backdrop-blur border border-white/15 shadow-2xl pb-[env(safe-area-inset-bottom)]">
                  <p className="px-4 sm:px-3 py-3 sm:py-2 text-[11px] uppercase tracking-wider text-white/60 border-b border-white/10">Kalite</p>
                  {options.map((o) => (
                    <button
                      key={o.id}
                      role="menuitemradio"
                      aria-checked={qualityId === o.id}
                      data-testid={`quality-${o.id}`}
                      onClick={() => {
                        setQualityId(o.id)
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center justify-between px-4 sm:px-3 py-3.5 sm:py-2 text-base sm:text-sm hover:bg-white/10 text-left"
                    >
                      <span>
                        {o.label}
                        {o.id === "auto" && qualityId === "auto" && stats.height ? <span className="text-white/50"> ({stats.height}p)</span> : null}
                      </span>
                      {qualityId === o.id && <Check size={15} />}
                    </button>
                  ))}
                </div>
                </>
              )}
            </div>

            <IconBtn label="Pencere içinde pencere" onClick={togglePip} testId="pip">
              <PictureInPicture2 size={18} />
            </IconBtn>
            <IconBtn label={theater ? "Tiyatro modundan çık" : "Tiyatro modu"} onClick={onToggleTheater} active={theater} testId="theater">
              <Columns2 size={18} />
            </IconBtn>
            <IconBtn label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"} onClick={toggleFullscreen} testId="fullscreen">
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/90 bg-black/70">{children}</div>
}

function IconBtn({ children, label, onClick, active, testId }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={onClick}
      className={`p-2 rounded hover:bg-white/15 ${active ? "bg-white/20" : ""}`}
    >
      {children}
    </button>
  )
}
