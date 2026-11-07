"use client"

import { useEffect, useState } from "react"
import { Video, ExternalLink, Play } from "lucide-react"
import { isDirectVideo } from "@/lib/video-link"

export function TeacherRecordedVideos({ teacherId }: { teacherId: string }) {
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/teachers/${teacherId}/videos`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setVideos(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [teacherId])

  if (loading) return null
  if (videos.length === 0) return null

  return (
    <div className="bg-cream rounded-3xl p-6 lg:p-8 border border-sage-100 mt-8" data-testid="recorded-videos">
      <h2 className="font-display text-2xl text-ink mb-6 flex items-center gap-2">
        <Video className="text-sage-600" /> Kayıtlı dersler
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {videos.map(video => {
          const direct = isDirectVideo(video.videoUrl)
          return (
            <div key={video.id} data-testid="recorded-video" className="bg-white rounded-2xl border border-sage-100 overflow-hidden">
              {direct && playing === video.id ? (
                <video src={video.videoUrl} controls autoPlay preload="metadata" className="w-full aspect-video bg-black" data-testid="recorded-player" />
              ) : (
                <button
                  type="button"
                  onClick={() => (direct ? setPlaying(video.id) : window.open(video.videoUrl, "_blank", "noopener,noreferrer"))}
                  aria-label={`${video.title} — ${direct ? "oynat" : "harici sitede aç"}`}
                  data-testid="recorded-play"
                  className="group w-full aspect-video bg-sage-800 relative flex items-center justify-center"
                >
                  <span className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="text-white ml-1" fill="currentColor" size={20} />
                  </span>
                  <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded-md">{direct ? "Kayıtlı ders" : "Harici bağlantı"}</span>
                </button>
              )}
              <div className="p-4">
                <h3 className="font-medium text-sage-900 line-clamp-1">{video.title}</h3>
                {video.description && <p className="text-sm text-sage-500 mt-1 line-clamp-2">{video.description}</p>}
                {!direct && <p className="text-xs text-sage-500 mt-3 flex items-center gap-1"><ExternalLink size={12} /> Harici oynatıcıda açılır</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
