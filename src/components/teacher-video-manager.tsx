"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Video, Trash2, Plus, ExternalLink } from "lucide-react"

export function TeacherVideoManager({ initialVideos }: { initialVideos: any[] }) {
  const [videos, setVideos] = useState(initialVideos)
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !videoUrl) return

    setLoading(true)
    try {
      const res = await fetch("/api/teacher/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, videoUrl, isPublic })
      })
      
      const data = await res.json()
      if (res.ok) {
        setVideos([data.video, ...videos])
        setIsAdding(false)
        setTitle("")
        setVideoUrl("")
      } else {
        alert(data.error || "Failed to add video")
      }
    } catch (e) {
      alert("Network error")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return

    try {
      const res = await fetch(`/api/teacher/videos/${id}`, {
        method: "DELETE"
      })
      
      if (res.ok) {
        setVideos(videos.filter(v => v.id !== id))
      }
    } catch (e) {
      alert("Failed to delete video")
    }
  }

  return (
    <div className="glass-card p-8 rounded-3xl border border-sage-100 shadow-sm mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-sage-800 flex items-center gap-2">
          <Video size={24} className="text-sage-500" /> Recorded Sessions
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-sage-100 text-sage-700 px-4 py-2 rounded-full font-medium text-sm hover:bg-sage-200 transition"
        >
          <Plus size={16} /> {isAdding ? "Cancel" : "Add Video"}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-8 bg-sage-50/50 p-6 rounded-2xl border border-sage-100/50">
          <div className="grid gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1">Video Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full bg-white border border-sage-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sage-400"
                placeholder="e.g. Vinyasa Flow for Beginners (Recorded)"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1">Video URL (YouTube, Vimeo, etc.)</label>
              <input 
                type="url" 
                value={videoUrl} 
                onChange={e => setVideoUrl(e.target.value)} 
                className="w-full bg-white border border-sage-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sage-400"
                placeholder="https://youtube.com/watch?v=..."
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sage-700 text-sm">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded border-sage-300 text-sage-600 focus:ring-sage-500" />
              Make this video public on my profile
            </label>
          </div>
          <button disabled={loading} className="bg-sage-800 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-sage-700 transition disabled:opacity-50">
            {loading ? "Saving..." : "Save Video"}
          </button>
        </form>
      )}

      {videos.length === 0 ? (
        <div className="text-center py-10 bg-sage-50/50 rounded-2xl border border-sage-100/50">
          <p className="text-sage-500">You haven't uploaded any recorded sessions yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {videos.map(video => (
            <div key={video.id} className="bg-white border border-sage-100 p-4 rounded-2xl flex items-start justify-between group hover:shadow-md transition">
              <div className="min-w-0 pr-4">
                <h4 className="font-semibold text-sage-900 truncate">{video.title}</h4>
                <a href={video.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-sage-500 hover:text-sage-700 flex items-center gap-1 mt-1 truncate">
                  <ExternalLink size={12} /> {video.videoUrl}
                </a>
                <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-md font-medium ${video.isPublic ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {video.isPublic ? "Public" : "Private"}
                </span>
              </div>
              <button 
                onClick={() => handleDelete(video.id)}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete Video"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
