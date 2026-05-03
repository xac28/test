"use client"

import { useEffect, useState } from "react"
import { Video, ExternalLink, Play } from "lucide-react"

export function TeacherRecordedVideos({ teacherId }: { teacherId: string }) {
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
    <div className="bg-cream rounded-3xl p-6 lg:p-8 border border-sage-100 mt-8">
      <h2 className="font-display text-2xl text-ink mb-6 flex items-center gap-2">
        <Video className="text-sage-600" /> Recorded Sessions & Replays
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {videos.map(video => (
          <a 
            key={video.id} 
            href={video.videoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group block bg-white rounded-2xl border border-sage-100 overflow-hidden hover:shadow-lg transition-all"
          >
            <div className="aspect-video bg-sage-800 relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="text-white ml-1" fill="currentColor" size={20} />
              </div>
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded-md">
                Recorded Replay
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-medium text-sage-900 line-clamp-1 group-hover:text-sage-600 transition-colors">
                {video.title}
              </h3>
              {video.description && (
                <p className="text-sm text-sage-500 mt-1 line-clamp-2">{video.description}</p>
              )}
              <div className="text-xs text-sage-400 mt-3 flex items-center gap-1">
                <ExternalLink size={12} /> Watch on External Player
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
