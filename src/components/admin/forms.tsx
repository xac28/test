"use client"

import { ReactNode, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"

export const inputCls = "w-full border border-rule bg-paper rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"

/** "Yayın zamanı": the editors' date and time for scheduled publishing (value is the browser-local datetime-local string). */
export function ScheduleField({ value, onChange, testid }: { value: string; onChange: (v: string) => void; testid: string }) {
  return (
    <Field label="Yayın zamanı (isteğe bağlı)" hint="Bir zaman seçip “Zamanla”ya basarsan içerik o saatte kendiliğinden yayınlanır (e-posta kutusu işaretliyse aboneler de bilgilendirilir).">
      <input type="datetime-local" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
    </Field>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-sage-500 mt-1">{hint}</span>}
    </label>
  )
}

/** Uploads one file to /api/upload and hands back its public URL; the URL can also be typed or pasted. */
export function UploadField({ type, accept, value, onChange, label, hint, testid, preview }: {
  type: "audio" | "product" | "post"
  accept: string
  value: string
  onChange: (url: string, file?: File) => void
  label: string
  hint?: string
  testid: string
  preview?: "image" | "audio"
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", type)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız")
      onChange(data.url, file)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ""
    }
  }

  return (
    <div>
      <span className="eyebrow block mb-1.5">{label}</span>
      <div className="flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/… veya https://…" className={inputCls} data-testid={`${testid}-url`} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} data-testid={`${testid}-button`} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 rounded-lg border border-rule bg-paper text-sm font-semibold hover:bg-sage-50 disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Yükle
        </button>
        <input ref={ref} type="file" accept={accept} hidden onChange={(e) => pick(e.target.files?.[0])} data-testid={`${testid}-file`} />
      </div>
      {hint && !error && <span className="block text-xs text-sage-500 mt-1">{hint}</span>}
      {error && <span role="alert" className="block text-xs text-red-600 mt-1">{error}</span>}
      {value && preview === "image" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={value} alt="" className="mt-2 h-24 rounded-lg border border-rule object-cover" />}
      {value && preview === "audio" && <audio controls preload="none" src={value} className="mt-2 w-full" />}
    </div>
  )
}

/** Length of an audio file in whole seconds (read from its metadata in the browser). */
export function audioDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio()
    a.preload = "metadata"
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : null)
    a.onerror = () => resolve(null)
    a.src = url
  })
}
