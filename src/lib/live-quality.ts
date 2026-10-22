/**
 * Stream quality model for AYA live broadcasts (Twitch-style).
 *
 * The broadcaster picks a preset (1080p60, 720p30 …). We publish it as a simulcast
 * ladder so every viewer can choose Auto / 1080p / 720p / 360p independently.
 * Pure data + maths here (no livekit-client import) so it is unit-testable.
 */

export interface QualityPreset {
  id: string
  label: string
  width: number
  height: number
  fps: number
  /** bits per second for the top layer */
  maxBitrate: number
  hint: string
}

export const BROADCAST_PRESETS: QualityPreset[] = [
  { id: "1080p60", label: "1080p60", width: 1920, height: 1080, fps: 60, maxBitrate: 6_000_000, hint: "En yüksek kalite · ~6 Mb/sn yükleme gerekir" },
  { id: "1080p30", label: "1080p", width: 1920, height: 1080, fps: 30, maxBitrate: 4_500_000, hint: "Full HD · ~4,5 Mb/sn yükleme gerekir" },
  { id: "720p60", label: "720p60", width: 1280, height: 720, fps: 60, maxBitrate: 3_500_000, hint: "Akıcı hareket · ~3,5 Mb/sn yükleme gerekir" },
  { id: "720p30", label: "720p", width: 1280, height: 720, fps: 30, maxBitrate: 2_500_000, hint: "Önerilen · ~2,5 Mb/sn yükleme gerekir" },
  { id: "480p30", label: "480p", width: 854, height: 480, fps: 30, maxBitrate: 1_200_000, hint: "Zayıf bağlantı · ~1,2 Mb/sn yükleme gerekir" },
  { id: "360p30", label: "360p", width: 640, height: 360, fps: 30, maxBitrate: 700_000, hint: "Çok zayıf bağlantı · ~0,7 Mb/sn yükleme gerekir" },
]

export const DEFAULT_PRESET_ID = "720p30"

export function getPreset(id: string | null | undefined): QualityPreset {
  return BROADCAST_PRESETS.find((p) => p.id === id) ?? BROADCAST_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!
}

export interface SimulcastLayer {
  width: number
  height: number
  maxBitrate: number
  maxFramerate: number
}

/** Lower layers published next to the top one (the top layer is the preset itself). */
export function simulcastLayersFor(preset: Pick<QualityPreset, "height">): SimulcastLayer[] {
  if (preset.height >= 1080) {
    return [
      { width: 640, height: 360, maxBitrate: 600_000, maxFramerate: 30 },
      { width: 1280, height: 720, maxBitrate: 2_000_000, maxFramerate: 30 },
    ]
  }
  if (preset.height >= 720) return [{ width: 640, height: 360, maxBitrate: 600_000, maxFramerate: 30 }]
  if (preset.height >= 480) return [{ width: 426, height: 240, maxBitrate: 300_000, maxFramerate: 30 }]
  return []
}

// livekit-client's VideoQuality enum values (kept numeric so this file has no runtime dependency)
export const VQ = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const

export interface ViewerQualityOption {
  id: string // "auto" | "<height>" | "audio"
  label: string
  /** livekit VideoQuality to request, undefined for "audio only" */
  quality?: number
  height?: number
}

/**
 * Menu shown to viewers, derived from what is actually being published.
 * `sourceHeight` is the broadcaster's top layer (read from the track dimensions).
 */
export function viewerQualityOptions(sourceHeight: number, fps = 30): ViewerQualityOption[] {
  const layers = simulcastLayersFor({ height: sourceHeight })
  const heights = [sourceHeight, ...layers.map((l) => l.height).sort((a, b) => b - a)]
  const suffix = fps >= 50 ? "60" : ""

  const options: ViewerQualityOption[] = [{ id: "auto", label: "Otomatik" }]
  heights.forEach((h, i) => {
    let quality: number
    if (i === 0) quality = VQ.HIGH
    else if (i === heights.length - 1) quality = VQ.LOW
    else quality = VQ.MEDIUM
    options.push({ id: String(h), label: `${h}p${i === 0 ? suffix : ""}`, quality, height: h })
  })
  options.push({ id: "audio", label: "Yalnız ses" })
  return options
}

export function formatBitrate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "—"
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mb/sn`
  return `${Math.round(bps / 1000)} Kb/sn`
}

export type NetworkGrade = "good" | "fair" | "poor"

/** Broadcaster-side health: uses the browser's quality-limitation reason and RTT. */
export function gradeUplink(input: { qualityLimitationReason?: string; roundTripTimeMs?: number; fps?: number; targetFps?: number }): NetworkGrade {
  const { qualityLimitationReason, roundTripTimeMs, fps, targetFps } = input
  if (qualityLimitationReason === "bandwidth") return "poor"
  if (roundTripTimeMs !== undefined && roundTripTimeMs > 400) return "poor"
  if (fps !== undefined && targetFps && fps < targetFps * 0.5) return "poor"
  if (qualityLimitationReason === "cpu") return "fair"
  if (roundTripTimeMs !== undefined && roundTripTimeMs > 200) return "fair"
  if (fps !== undefined && targetFps && fps < targetFps * 0.8) return "fair"
  return "good"
}
