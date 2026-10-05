"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Video, Trash2, Plus, ExternalLink, UploadCloud, Link2, Loader2 } from "lucide-react"
import { isDirectVideo } from "@/lib/video-link"
import { liveWarning } from "@/components/community/parts"

const MAX_MB = 500

/** Upload with progress (fetch cannot report it). */
function uploadVideo(file: File, onProgress: (pct: number) => void): Promise<{ ok: boolean; url?: string; error?: string }> {
  return new Promise((resolve) => {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("type", "video")
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload")
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onerror = () => resolve({ ok: false, error: "Bağlantı hatası, yükleme yarıda kaldı." })
    xhr.onload = () => {
      let d: any = {}
      try { d = JSON.parse(xhr.responseText) } catch {}
      resolve(xhr.status >= 200 && xhr.status < 300 ? { ok: true, url: d.url } : { ok: false, error: xhr.status === 413 ? "Dosya çok büyük." : d.error || "Yükleme başarısız." })
    }
    xhr.send(fd)
  })
}

export function TeacherVideoManager({ initialVideos }: { initialVideos: any[] }) {
  const [videos, setVideos] = useState(initialVideos)
  const [isAdding, setIsAdding] = useState(false)
  const [source, setSource] = useState<"upload" | "link">("upload")
  const [title, setTitle] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const pick = (f: File | undefined) => {
    setError(null)
    if (!f) return
    if (!/^video\/(mp4|webm|ogg|quicktime)$/.test(f.type) && !/\.(mp4|webm|ogg|mov)$/i.test(f.name)) return setError("MP4, WebM veya MOV video seçin.")
    if (f.size > MAX_MB * 1024 * 1024) return setError(`Video en fazla ${MAX_MB} MB olabilir.`)
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80))
  }

  const reset = () => { setIsAdding(false); setTitle(""); setVideoUrl(""); setFile(null); setProgress(null); setError(null); if (input.current) input.current.value = "" }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) return setError("Bir başlık yazın.")
    const warn = liveWarning(title)
    if (warn) return setError(warn)
    setLoading(true)
    try {
      let url = videoUrl.trim()
      if (source === "upload") {
        if (!file) return setError("Önce bir video dosyası seçin.")
        setProgress(0)
        const up = await uploadVideo(file, setProgress)
        if (!up.ok || !up.url) return setError(up.error || "Yükleme başarısız.")
        url = up.url
      } else if (!url) return setError("Video bağlantısını girin.")
      const res = await fetch("/api/teacher/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, videoUrl: url, isPublic }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || "Video eklenemedi.")
      setVideos([data.video, ...videos])
      reset()
      router.refresh()
    } catch {
      setError("Ağ hatası, tekrar deneyin.")
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/teacher/videos/${id}`, { method: "DELETE" }).catch(() => null)
    if (res?.ok) setVideos(videos.filter((v) => v.id !== id))
    setConfirmId(null)
  }

  const tab = (active: boolean) => `flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm border rounded-md ${active ? "bg-ink text-cream border-ink" : "border-rule text-sage-700"}`
  const field = "w-full bg-white border border-sage-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sage-400"

  return (
    <div className="bg-paper p-6 rounded-xl border border-rule" data-testid="video-manager">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2">
          <Video size={17} className="text-sage-500" aria-hidden /> Kayıtlı dersler
        </h2>
        <button onClick={() => (isAdding ? reset() : setIsAdding(true))} data-testid="video-add-toggle" className="flex items-center gap-2 min-h-[40px] border border-rule bg-paper text-sage-800 px-3.5 rounded-lg font-semibold text-sm hover:border-sage-300 hover:bg-white transition cursor-pointer">
          <Plus size={16} /> {isAdding ? "Vazgeç" : "Video ekle"}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-8 bg-sage-50/50 p-6 rounded-2xl border border-sage-100/50 space-y-4" data-testid="video-form">
          <div className="flex gap-2" role="tablist">
            <button type="button" role="tab" aria-selected={source === "upload"} onClick={() => setSource("upload")} className={tab(source === "upload")} data-testid="video-src-upload"><UploadCloud size={15} /> Dosya yükle</button>
            <button type="button" role="tab" aria-selected={source === "link"} onClick={() => setSource("link")} className={tab(source === "link")} data-testid="video-src-link"><Link2 size={15} /> Bağlantı ekle</button>
          </div>

          {source === "upload" ? (
            <div>
              <input ref={input} type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" onChange={(e) => pick(e.target.files?.[0])} data-testid="video-file" className="text-sm" />
              <p className="text-xs text-sage-500 mt-1">MP4, WebM veya MOV · en fazla {MAX_MB} MB{file && ` · seçilen: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`}</p>
              {progress !== null && (
                <div className="mt-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} data-testid="video-progress">
                  <div className="h-2 rounded-full bg-sage-200 overflow-hidden"><div className="h-full bg-sage-700 transition-all" style={{ width: `${progress}%` }} /></div>
                  <p className="text-xs text-sage-600 mt-1">{progress < 100 ? `Yükleniyor… %${progress}` : "İşleniyor…"}</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1">Video bağlantısı (https)</label>
              <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={field} placeholder="https://youtube.com/watch?v=…" data-testid="video-url" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-sage-700 mb-1" htmlFor="video-title">Başlık</label>
            <input id="video-title" type="text" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} className={field} placeholder="Örn. Yeni başlayanlar için Vinyasa akışı" data-testid="video-title" />
            {liveWarning(title) && <p className="text-xs text-clay-600 mt-1">{liveWarning(title)}</p>}
          </div>
          <label className="flex items-center gap-2 text-sage-700 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="rounded border-sage-300" />
            Profilimde herkese açık göster (kapalıysa yalnızca öğrencilerim görür)
          </label>
          {error && <p role="alert" data-testid="video-error" className="text-sm text-clay-600 bg-clay-50 border border-clay-200 rounded-md px-3 py-2">{error}</p>}
          <button disabled={loading} data-testid="video-save" className="inline-flex items-center gap-2 bg-sage-800 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-sage-700 transition disabled:opacity-50">
            {loading && <Loader2 size={15} className="animate-spin" />} {loading ? "Kaydediliyor…" : "Videoyu kaydet"}
          </button>
        </form>
      )}

      {videos.length === 0 ? (
        <div className="text-center py-10 bg-sage-50/50 rounded-2xl border border-sage-100/50" data-testid="video-empty">
          <p className="text-sage-500">Henüz kayıtlı ders eklemedin. Videolar profilinde oynatılır.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {videos.map((video) => (
            <div key={video.id} data-testid="video-item" className="bg-white border border-sage-100 p-4 rounded-2xl group hover:shadow-md transition">
              {isDirectVideo(video.videoUrl) ? (
                <video src={video.videoUrl} controls preload="metadata" className="w-full aspect-video bg-black rounded-xl mb-3" data-testid="video-player" />
              ) : null}
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-4">
                  <h4 className="font-semibold text-sage-900 truncate">{video.title}</h4>
                  {!isDirectVideo(video.videoUrl) && (
                    <a href={video.videoUrl} target="_blank" rel="noreferrer noopener" className="text-sm text-sage-500 hover:text-sage-700 flex items-center gap-1 mt-1 truncate"><ExternalLink size={12} /> {video.videoUrl}</a>
                  )}
                  <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-md font-medium ${video.isPublic ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{video.isPublic ? "Herkese açık" : "Yalnızca öğrenciler"}</span>
                </div>
                {confirmId === video.id ? (
                  <span className="flex items-center gap-1 text-xs shrink-0">
                    <button onClick={() => handleDelete(video.id)} data-testid="video-delete-confirm" className="px-2.5 py-1.5 rounded-md bg-red-600 text-white font-semibold">Sil</button>
                    <button onClick={() => setConfirmId(null)} className="px-2.5 py-1.5 rounded-md border border-rule">Vazgeç</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmId(video.id)} data-testid="video-delete" className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Videoyu sil" aria-label="Videoyu sil"><Trash2 size={18} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
