"use client"

import { useEffect, useState } from "react"
import { TriangleAlert } from "lucide-react"

interface Warning {
  id: string
  message: string
  createdAt: string
}

/** Official warnings from the admins; stays visible until the user confirms they read it. */
export function WarningBanner() {
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [suspension, setSuspension] = useState<{ until: string; reason: string | null } | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/warnings")
      .then((r) => (r.ok ? r.json() : { warnings: [] }))
      .then((d) => { if (alive) { setWarnings(d.warnings || []); setSuspension(d.suspension || null) } })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const ack = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/warnings/${id}/ack`, { method: "POST" })
      if (res.ok) setWarnings((w) => w.filter((x) => x.id !== id))
    } finally {
      setBusy(null)
    }
  }

  if (warnings.length === 0 && !suspension) return null
  return (
    <div className="space-y-3 mb-6" data-testid="warning-banner">
      {suspension && (
        <div role="alert" data-testid="suspension-banner" className="flex gap-3 items-start rounded-xl border border-red-300 bg-red-50 text-red-900 p-4">
          <TriangleAlert className="shrink-0 mt-0.5" size={20} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Hesabın {new Date(suspension.until).toLocaleDateString("tr-TR")} tarihine kadar uzaklaştırıldı</p>
            <p className="text-sm mt-1">Bu sürede profilin listelerde görünmez; ders, yayın, atölye açamaz, mesaj ve paylaşım yapamazsın.{suspension.reason ? ` Neden: ${suspension.reason}.` : ""} Bir sonraki ihlalde hesabın kalıcı olarak kapatılır. Yanlış olduğunu düşünüyorsan Canlı Destek'e yaz.</p>
          </div>
        </div>
      )}
      {warnings.map((w) => (
        <div key={w.id} role="alert" className="flex gap-3 items-start rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-4">
          <TriangleAlert className="shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">AYA yönetiminden uyarı</p>
            <p className="text-sm mt-1 whitespace-pre-line break-words">{w.message}</p>
            <p className="text-xs text-amber-700 mt-1">{new Date(w.createdAt).toLocaleString("tr-TR")}</p>
          </div>
          <button
            onClick={() => ack(w.id)}
            disabled={busy === w.id}
            data-testid="warning-ack"
            className="shrink-0 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            Okudum
          </button>
        </div>
      ))}
    </div>
  )
}
