"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { CommunityPost, ModeratedField, liveWarning, useAuthGate } from "./parts"

const MAX_EDGE = 1600

function toBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("canvas"))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.88)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")) }
    img.src = url
  })
}

/** Photo + caption. The photo is uploaded first (own file only), then the caption goes through the server-side filter. */
export function Composer({ onPosted }: { onPosted: (post: CommunityPost, pending: boolean) => void }) {
  const gate = useAuthGate()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const pick = (f: File | undefined) => {
    if (!f) return
    setError(null)
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setError("Yalnızca JPG, PNG veya WebP fotoğraf yükleyebilirsin.")
    if (f.size > 15 * 1024 * 1024) return setError("Fotoğraf en fazla 15 MB olabilir.")
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }
  const clear = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    if (input.current) input.current.value = ""
  }

  const blocked = !!liveWarning(text) || !!liveWarning(title)
  const canSend = !!file && text.trim().length >= 3 && !blocked && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend || gate.needLogin()) return
    setBusy(true)
    setError(null)
    try {
      const blob = await toBlob(file!)
      const fd = new FormData()
      fd.append("file", blob, "photo.jpg")
      fd.append("type", "post")
      const up = await fetch("/api/upload", { method: "POST", body: fd })
      const upData = await gate.handle(up)
      if (!up.ok) return setError(upData.error || "Fotoğraf yüklenemedi.")
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: upData.url, content: text, title: title.trim() || undefined }),
      })
      const d = await gate.handle(res)
      if (!res.ok) return setError([d.error, d.hint].filter(Boolean).join(" ") || "Paylaşılamadı.")
      onPosted(d.post, !!d.pending)
      clear()
      setText("")
      setTitle("")
    } catch {
      setError("Fotoğraf işlenemedi, başka bir dosya dene.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} data-testid="composer" className="bg-paper border border-rule rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">Bir an paylaş</h2>
        <a href="/community/rules" className="text-xs underline text-sage-600 hover:text-ink">Topluluk kuralları</a>
      </div>

      {preview ? (
        <div className="relative rounded-lg overflow-hidden bg-sage-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Seçilen fotoğraf önizlemesi" data-testid="composer-preview" className="w-full max-h-80 object-contain" />
          <button type="button" onClick={clear} aria-label="Fotoğrafı kaldır" className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={18} /></button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (gate.needLogin() ? null : input.current?.click())}
          className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-rule rounded-lg text-sage-600 hover:border-ink hover:text-ink transition-colors"
        >
          <ImagePlus size={28} />
          <span className="text-sm font-medium">Fotoğraf seç</span>
          <span className="text-xs text-sage-500">JPG, PNG veya WebP · en fazla 15 MB</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid="composer-file" onChange={(e) => pick(e.target.files?.[0])} />

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 120))}
        placeholder="Başlık (isteğe bağlı)"
        aria-label="Başlık"
        data-testid="composer-title"
        className="w-full px-3.5 py-2.5 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
      />
      <ModeratedField value={text} onChange={setText} max={1000} rows={3} placeholder="Bu fotoğraf hakkında birkaç söz yaz…" label="Açıklama" testid="composer-text" />

      {error && <p role="alert" data-testid="composer-error" className="text-sm text-clay-600 bg-clay-50 border border-clay-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-sage-500">İlk paylaşımların yönetici onayından geçer.</p>
        <button type="submit" disabled={!canSend} data-testid="composer-submit" className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] bg-ink text-cream rounded-md text-sm font-medium disabled:opacity-40 hover:bg-sage-800 transition-colors">
          {busy && <Loader2 size={15} className="animate-spin" />} Paylaş
        </button>
      </div>
    </form>
  )
}
