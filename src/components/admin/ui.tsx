"use client"

import { ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** fetch + JSON with a readable error (the message the API sent, never "[object Object]"). */
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {}
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `İstek başarısız (${res.status})`, res.status)
  return data as T
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * Loads data and guards against out-of-order responses (typing in a search box fires many requests;
 * only the latest one may update the screen).
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  const loadRef = useRef(load)
  loadRef.current = load

  const reload = useCallback(async () => {
    const mine = ++seq.current
    setLoading(true)
    try {
      const d = await loadRef.current()
      if (mine !== seq.current) return
      setData(d)
      setError(null)
    } catch (e: any) {
      if (mine !== seq.current) return
      setError(e?.message || "Yüklenemedi")
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, deps)
  return { data, error, loading, reload, setData }
}

export const fmtDateTime = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—")
export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—")
export const fmtMoney = (n: number) => `$${(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const fmtBytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`)

export function ago(d: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "az önce"
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`
  return `${Math.floor(s / 86400)} gün önce`
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sage-400 text-sm">
      <Loader2 className="animate-spin" size={18} /> {label ?? "Yükleniyor…"}
    </div>
  )
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="border border-dashed border-rule rounded-xl p-10 text-center text-sage-500 text-sm" data-testid="empty-state">
      {icon && <div className="mx-auto mb-3 w-fit text-sage-300">{icon}</div>}
      {children}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-red-200 bg-red-50 text-red-700 rounded-xl p-4 text-sm flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">Tekrar dene</button>}
    </div>
  )
}

const TONES: Record<string, string> = {
  gray: "bg-sage-100 text-sage-700 border-sage-200",
  red: "bg-red-50 text-red-700 border-red-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  green: "bg-green-50 text-green-700 border-green-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
}
export function Pill({ tone = "gray", children, title }: { tone?: keyof typeof TONES | string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border whitespace-nowrap ${TONES[tone] ?? TONES.gray}`}>
      {children}
    </span>
  )
}

export function Card({ children, className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`bg-paper border border-rule rounded-xl ${className}`}>{children}</div>
}

export function SectionTitle({ title, hint, actions }: { title: string; hint?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h2 className="font-display text-3xl text-ink">{title}</h2>
        {hint && <p className="text-sm text-sage-500 mt-1 max-w-2xl">{hint}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return <p className="text-xs text-sage-400 mt-3">{total} kayıt</p>
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-sage-600">
      <span>{total} kayıt · Sayfa {page}/{pages}</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Önceki sayfa" className="p-2 border border-rule rounded-lg disabled:opacity-40 hover:bg-sage-50"><ChevronLeft size={16} /></button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Sonraki sayfa" className="p-2 border border-rule rounded-lg disabled:opacity-40 hover:bg-sage-50"><ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, testid }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[]; testid?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          data-testid={testid ? `${testid}-${o.id}` : undefined}
          className={`px-3 py-1.5 rounded-full text-sm border transition ${value === o.id ? "bg-ink text-cream border-ink" : "bg-paper border-rule text-sage-700 hover:border-sage-400"}`}
        >
          {o.label}
          {o.count !== undefined && <span className={`ml-1.5 text-xs ${value === o.id ? "text-cream/70" : "text-sage-400"}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder, testid }: { value: string; onChange: (v: string) => void; placeholder: string; testid?: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testid}
      aria-label={placeholder}
      className="w-full sm:w-72 px-3.5 py-2 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-sage-500"
    />
  )
}

export function Select({ value, onChange, children, label, testid }: { value: string; onChange: (v: string) => void; children: ReactNode; label: string; testid?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} data-testid={testid} className="px-3 py-2 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-sage-500">
      {children}
    </select>
  )
}

export function Button({ children, tone = "default", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "primary" | "danger" | "ghost" }) {
  const cls =
    tone === "primary" ? "bg-ink text-cream hover:bg-sage-800"
    : tone === "danger" ? "bg-red-600 text-white hover:bg-red-700"
    : tone === "ghost" ? "text-sage-700 hover:bg-sage-100"
    : "bg-paper border border-rule text-sage-800 hover:bg-sage-50"
  return (
    <button {...rest} className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${cls} ${rest.className ?? ""}`}>
      {children}
    </button>
  )
}

/** Right-hand slide-over for details. */
export function Drawer({ title, subtitle, onClose, children, testid }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; testid?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    ref.current?.focus()
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" data-testid={testid}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-xl bg-cream h-full overflow-y-auto shadow-2xl outline-none border-l border-rule">
        <header className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-rule px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-2xl truncate">{title}</h3>
            {subtitle && <div className="text-sm text-sage-500 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Kapat" className="p-1.5 rounded-lg hover:bg-sage-100 text-sage-500"><X size={18} /></button>
        </header>
        <div className="p-6 space-y-6">{children}</div>
      </aside>
    </div>
  )
}

export interface ConfirmSpec {
  title: string
  description?: ReactNode
  confirmLabel: string
  tone?: "danger" | "primary"
  /** when set, an input is shown and its value is required (min chars) */
  input?: { label: string; placeholder?: string; min?: number; multiline?: boolean }
  onConfirm: (value: string) => Promise<void>
}

/** Replaces window.confirm/prompt: explains the consequence, collects a required reason and shows the server's error. */
export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec; onClose: () => void }) {
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const min = spec.input?.min ?? 0
  const valid = !spec.input || value.trim().length >= min

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [busy, onClose])

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await spec.onConfirm(value.trim())
      onClose()
    } catch (e: any) {
      setError(e?.message || "İşlem başarısız")
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" data-testid="confirm-dialog">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onClose()} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-label={spec.title} className="relative bg-paper rounded-2xl border border-rule shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-display text-2xl">{spec.title}</h3>
        {spec.description && <div className="text-sm text-sage-600 leading-relaxed">{spec.description}</div>}
        {spec.input && (
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-sage-500">{spec.input.label}</span>
            {spec.input.multiline ? (
              <textarea autoFocus rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder={spec.input.placeholder} data-testid="confirm-input" className="mt-1.5 w-full px-3 py-2 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-sage-500" />
            ) : (
              <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={spec.input.placeholder} data-testid="confirm-input" className="mt-1.5 w-full px-3 py-2 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-sage-500" />
            )}
            {min > 0 && value.trim().length < min && <span className="text-[11px] text-sage-400">En az {min} karakter</span>}
          </label>
        )}
        {error && <p role="alert" data-testid="confirm-error" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose} disabled={busy}>Vazgeç</Button>
          <Button tone={spec.tone === "danger" ? "danger" : "primary"} onClick={run} disabled={!valid || busy} data-testid="confirm-ok">
            {busy && <Loader2 size={14} className="animate-spin" />} {spec.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Hook that owns one ConfirmDialog. */
export function useConfirm() {
  const [spec, setSpec] = useState<ConfirmSpec | null>(null)
  const dialog = spec ? <ConfirmDialog spec={spec} onClose={() => setSpec(null)} /> : null
  return { ask: setSpec, dialog }
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div role="status" data-testid="toast" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-ink text-cream text-sm px-5 py-3 rounded-full shadow-xl">
      {message}
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const toast = msg ? <Toast message={msg} onDone={() => setMsg(null)} /> : null
  return { show: setMsg, toast }
}

export function DownloadCsv({ href }: { href: string }) {
  return (
    <a href={href} download data-testid="csv-download" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-paper border border-rule text-sage-800 hover:bg-sage-50">
      CSV indir
    </a>
  )
}

export function Table({ children, head }: { children: ReactNode; head: string[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-sage-50 border-b border-rule text-[11px] uppercase tracking-wider text-sage-500">
            <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-rule">{children}</tbody>
        </table>
      </div>
    </Card>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "amber" | "green" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "green" ? "text-green-600" : "text-ink"
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-sage-500">{label}</p>
      <p className={`font-display text-3xl mt-1 ${color}`}>{value}</p>
      {hint && <p className="text-xs text-sage-400 mt-1">{hint}</p>}
    </Card>
  )
}
