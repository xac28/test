"use client"

import { useEffect, useState } from "react"
import { signOut } from "next-auth/react"
import { Download, ShieldAlert, Trash2 } from "lucide-react"

/** "My data": download everything AYA keeps, or close the account (anonymised; blocked while lessons are pending). */
export function AccountDataCard() {
  const [info, setInfo] = useState<{ blockers: string[]; needsPassword: boolean; phrase: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [phrase, setPhrase] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || info) return
    fetch("/api/profile/account").then((r) => r.json()).then(setInfo).catch(() => setError("Bilgiler alınamadı."))
  }, [open, info])

  async function remove() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/profile/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: phrase, password }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { await signOut({ callbackUrl: "/" }); return }
      if (data.blockers) setInfo((i) => (i ? { ...i, blockers: data.blockers } : i))
      setError(data.error || "Hesap silinemedi.")
    } catch {
      setError("Bağlantı kurulamadı.")
    } finally {
      setBusy(false)
    }
  }

  const blocked = (info?.blockers.length ?? 0) > 0
  const ready = info && !blocked && phrase === info.phrase && (!info.needsPassword || password.length > 0)

  return (
    <section className="glass-card p-8 rounded-3xl border border-sage-100/50 space-y-6" data-testid="account-data">
      <div>
        <h2 className="text-2xl font-display text-sage-900">Verilerim ve hesabım</h2>
        <p className="text-sage-600 mt-1 text-sm">Kişisel verilerinin bir kopyasını indirebilir ya da hesabını kapatabilirsin.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <a href="/api/profile/export" download data-testid="export-data" className="btn-deep"><Download size={16} /> Verilerimi indir (JSON)</a>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="delete-open" className="inline-flex items-center gap-2 text-sm font-semibold text-clay-700 hover:text-clay-800 min-h-[44px] px-2">
          <Trash2 size={16} /> Hesabımı sil
        </button>
      </div>

      {open && (
        <div className="border border-clay-200 bg-clay-50/60 rounded-2xl p-6 space-y-4" data-testid="delete-panel">
          <p className="flex gap-2 text-sm text-clay-800"><ShieldAlert size={18} className="shrink-0 mt-0.5" /> Hesap kapatıldığında profilin, paylaşımların, yorumların ve bildirimlerin silinir; e-posta adresin serbest kalmaz ve bu işlem geri alınamaz. Ders ve ödeme kayıtları, adın silinmiş olarak yasal saklama için tutulur.</p>
          {!info && !error && <p className="text-sm text-sage-600">Kontrol ediliyor…</p>}
          {blocked && (
            <ul className="list-disc pl-5 text-sm text-clay-800 space-y-1" data-testid="delete-blockers">
              {info!.blockers.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
          {info && !blocked && (
            <div className="space-y-3">
              {info.needsPassword && (
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifren" aria-label="Şifren" autoComplete="current-password" data-testid="delete-password" className="w-full px-4 py-3 bg-white border border-rule rounded-xl text-sm focus:outline-none focus:border-ink" />
              )}
              <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={`Onaylamak için "${info.phrase}" yaz`} aria-label="Onay metni" data-testid="delete-phrase" className="w-full px-4 py-3 bg-white border border-rule rounded-xl text-sm focus:outline-none focus:border-ink" />
              <button type="button" disabled={!ready || busy} onClick={remove} data-testid="delete-confirm" className="inline-flex items-center justify-center gap-2 bg-clay-700 hover:bg-clay-800 text-white rounded-full px-6 min-h-[44px] text-sm font-semibold disabled:opacity-50">
                {busy ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}
              </button>
            </div>
          )}
          {error && <p role="alert" data-testid="delete-error" className="text-sm text-clay-800">{error}</p>}
        </div>
      )}
    </section>
  )
}
