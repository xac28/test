"use client"

import { useEffect, useState } from "react"
import { Flag, Loader2, TriangleAlert } from "lucide-react"

interface MyReport {
  id: string
  categoryLabel: string
  targetLabel: string
  status: string
  statusLabel: string
  message: string
  description: string
  createdAt: string
}
interface MyWarning {
  id: string
  message: string
  createdAt: string
  acknowledgedAt: string | null
}

const BADGE: Record<string, string> = {
  PENDING: "bg-sage-100 text-sage-700",
  REVIEWED: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  DISMISSED: "bg-sage-100 text-sage-600",
}

export default function MyReportsPage() {
  const [reports, setReports] = useState<MyReport[] | null>(null)
  const [warnings, setWarnings] = useState<MyWarning[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([fetch("/api/reports").then((r) => r.json()), fetch("/api/warnings?all=1").then((r) => r.json())])
      .then(([r, w]) => {
        setReports(r.reports || [])
        setWarnings(w.warnings || [])
      })
      .catch(() => setError(true))
  }, [])

  return (
    <div className="space-y-10 max-w-3xl">
      <header>
        <p className="eyebrow mb-2">Güvenlik</p>
        <h1 className="font-display text-4xl text-ink">Bildirimlerim</h1>
        <p className="text-sage-600 mt-2">Gönderdiğiniz bildirimlerin durumu ve yönetimden aldığınız uyarılar.</p>
      </header>

      {error && <p role="alert" className="text-clay-600">Bildirimler yüklenemedi.</p>}

      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-sage-500 mb-4 flex items-center gap-2"><Flag size={14} /> Gönderdiğim bildirimler</h2>
        {reports === null && !error ? (
          <Loader2 className="animate-spin text-sage-500" />
        ) : reports && reports.length === 0 ? (
          <p data-testid="no-reports" className="text-sage-500 border border-dashed border-rule rounded-xl p-8 text-center">
            Henüz bildirim göndermediniz. Canlı yayın, atölye, eğitmen profili veya ders odasındaki “Bildir” düğmesiyle sorun bildirebilirsiniz.
          </p>
        ) : (
          <ul className="space-y-3">
            {reports?.map((r) => (
              <li key={r.id} data-testid="my-report" className="border border-rule bg-paper rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sage-500">{r.targetLabel}</span>
                  <span className="text-sage-300">·</span>
                  <span className="text-sm font-medium text-ink">{r.categoryLabel}</span>
                  <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${BADGE[r.status] ?? BADGE.PENDING}`}>{r.statusLabel}</span>
                </div>
                <p className="text-sm text-sage-700 line-clamp-2 whitespace-pre-line">{r.description}</p>
                <p className="text-sm text-sage-600 mt-2">{r.message}</p>
                <p className="text-xs text-sage-500 mt-1">
                  {new Date(r.createdAt).toLocaleString("tr-TR")} · No: {r.id.slice(-8).toUpperCase()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {warnings.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-sage-500 mb-4 flex items-center gap-2"><TriangleAlert size={14} /> Aldığım uyarılar</h2>
          <ul className="space-y-3">
            {warnings.map((w) => (
              <li key={w.id} className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-amber-900">
                <p className="text-sm whitespace-pre-line">{w.message}</p>
                <p className="text-xs text-amber-700 mt-1">{new Date(w.createdAt).toLocaleString("tr-TR")}{w.acknowledgedAt ? " · okundu" : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
