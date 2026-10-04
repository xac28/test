"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Flag, Loader2, X } from "lucide-react"
import { MAX_DESCRIPTION, MIN_DESCRIPTION, TARGET_LABEL_TR, TargetType, categoriesFor } from "@/lib/reports"

export interface ReportChatMessage {
  text: string
  senderIdentity: string
  senderName: string
  sentAt: number
}

interface DialogProps {
  targetType: TargetType
  targetId: string
  /** what is being reported, shown at the top ("Yoga Flow · Ayşe") */
  subject: string
  message?: ReportChatMessage
  /** dark = live stage, light = site pages */
  theme?: "light" | "dark"
  onClose: () => void
}

/** Modal used everywhere a report can be filed (live stream, chat message, teacher, workshop, lesson). */
export function ReportDialog({ targetType, targetId, subject, message, theme = "light", onClose }: DialogProps) {
  const router = useRouter()
  const categories = categoriesFor(targetType)
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: string } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const dark = theme === "dark"
  const panel = dark ? "bg-stage-2 text-white border-white/15" : "bg-paper text-ink border-rule"
  const muted = dark ? "text-white/60" : "text-ink/60"
  const field = dark
    ? "bg-white/10 border-white/15 focus:border-white/50 text-white placeholder:text-white/40"
    : "bg-white border-rule focus:border-ink/50 text-ink placeholder:text-ink/40"

  const tooShort = description.trim().length < MIN_DESCRIPTION
  const canSubmit = !!category && !tooShort && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, category, description, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      if (res.status === 403 && data.code === "TERMS_REQUIRED") {
        router.push(`/accept-terms?next=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      if (!res.ok) {
        setError(data.error || "Bildirim gönderilemedi.")
        return
      }
      setDone({ id: data.id })
    } catch {
      setError("Ağ hatası, lütfen tekrar deneyin.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="report-dialog">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className={`relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border shadow-2xl outline-none ${panel}`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div className="min-w-0">
            <p className={`text-[11px] font-semibold tracking-[0.18em] uppercase ${muted}`}>{TARGET_LABEL_TR[targetType]} bildir</p>
            <h2 id="report-title" className="font-display text-2xl leading-tight truncate" title={subject}>{subject}</h2>
          </div>
          <button onClick={onClose} aria-label="Kapat" className={`p-1 -mr-1 rounded hover:bg-black/10 ${muted}`}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center space-y-3" data-testid="report-done">
            <CheckCircle2 className="mx-auto text-green-500" size={44} />
            <h3 className="font-display text-xl">Bildiriminiz alındı</h3>
            <p className={`text-sm ${muted}`}>
              Yöneticilerimiz inceleyecek. Durumunu <strong>Panel → Bildirimlerim</strong> sayfasından izleyebilirsiniz.
              Bildirdiğiniz kişi sizin kimliğinizi görmez.
            </p>
            <p className={`text-xs font-mono ${muted}`}>Başvuru no: {done.id.slice(-8).toUpperCase()}</p>
            <button onClick={onClose} className="mt-2 bg-accent hover:bg-accent-dark text-white text-sm font-semibold px-6 py-2.5 rounded-md">Tamam</button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 pb-6 pt-4 space-y-4">
            {message && (
              <blockquote className={`text-sm rounded-md border-l-4 border-accent px-3 py-2 ${dark ? "bg-white/5" : "bg-black/5"}`}>
                <span className="font-semibold">{message.senderName}: </span>
                <span className="break-words">{message.text}</span>
              </blockquote>
            )}

            <fieldset>
              <legend className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>Neden bildiriyorsunuz?</legend>
              <div className="space-y-1.5">
                {categories.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer text-sm transition ${
                      category === c.id ? "border-accent bg-accent/10" : dark ? "border-white/10 hover:border-white/30" : "border-rule hover:border-ink/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-category"
                      value={c.id}
                      checked={category === c.id}
                      onChange={() => setCategory(c.id)}
                      className="mt-1 accent-orange-600"
                      data-testid={`report-cat-${c.id}`}
                    />
                    <span>
                      <span className="font-medium block">{c.label}</span>
                      <span className={`text-xs ${muted}`}>{c.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="report-description" className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${muted}`}>Ne oldu?</label>
              <textarea
                id="report-description"
                data-testid="report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                rows={4}
                placeholder="Durumu kısaca anlatın: ne zaman, ne oldu, kim?"
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none resize-y ${field}`}
              />
              <div className={`flex justify-between text-[11px] mt-1 ${muted}`}>
                <span>{tooShort && description.length > 0 ? `En az ${MIN_DESCRIPTION} karakter` : "Gerçek dışı veya kötü niyetli bildirimler hesabınızı etkileyebilir."}</span>
                <span>{description.length}/{MAX_DESCRIPTION}</span>
              </div>
            </div>

            {error && <p role="alert" data-testid="report-error" className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className={`px-4 py-2 text-sm rounded-md border ${dark ? "border-white/20 hover:bg-white/10" : "border-rule hover:bg-black/5"}`}>Vazgeç</button>
              <button
                type="submit"
                data-testid="report-submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-md"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />} Gönder
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

interface ButtonProps extends Omit<DialogProps, "onClose"> {
  label?: string
  className?: string
  icon?: boolean
}

/** A small "Bildir" button that opens the dialog. */
export function ReportButton({ label = "Bildir", className = "", icon = true, ...rest }: ButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={`report-open-${rest.targetType.toLowerCase()}`} className={className || "inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-red-600"}>
        {icon && <Flag size={14} />} {label}
      </button>
      {open && <ReportDialog {...rest} onClose={() => setOpen(false)} />}
    </>
  )
}
