"use client"

import { useEffect, useState } from "react"
import { Download, Film, Loader2 } from "lucide-react"
import { daysLeft, formatBytes, formatElapsed } from "@/lib/recording-client"

interface RecordingItem {
  id: string
  roomName: string
  startedAt: string
  expiresAt: string
  durationSec: number | null
  sizeBytes: number
  teacherName: string | null
  studentName: string | null
  downloadUrl: string
}

/** "Ders Kayıtları": recordings of the signed-in user's lessons (teacher or student), 30-day retention. */
export function RecordingsList({ role }: { role: "teacher" | "student" }) {
  const [items, setItems] = useState<RecordingItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/recordings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setItems(d.recordings))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section data-testid="recordings-section" className="rounded-xl border border-rule bg-paper p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2">
          <Film size={17} className="text-sage-500" aria-hidden /> Ders kayıtları
        </h2>
        <p className="text-[13px] text-sage-500 mt-1">
          Kayıtlar yalnızca dersin öğretmeni ve öğrencisi tarafından indirilebilir ve 30 gün sonra otomatik silinir.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600">Kayıtlar yüklenemedi.</p>
      ) : items === null ? (
        <p className="text-sm text-ink/50 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/50">
          {role === "teacher"
            ? "Henüz kayıt yok. Derste “Dersi Kaydet” düğmesine bastığınızda kayıt burada görünür."
            : "Henüz indirilebilir ders kaydı yok."}
        </p>
      ) : (
        <ul className="divide-y divide-sage-100">
          {items.map((r) => (
            <li key={r.id} className="py-3 flex items-center justify-between gap-4" data-testid="recording-item">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {new Date(r.startedAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                  {" · "}
                  {role === "teacher" ? r.studentName || "Canlı yayın" : r.teacherName}
                </p>
                <p className="text-xs text-ink/50">
                  {r.durationSec != null ? `${formatElapsed(r.durationSec)} · ` : ""}
                  {formatBytes(r.sizeBytes)} · {daysLeft(r.expiresAt)} gün sonra silinecek
                </p>
              </div>
              <a
                href={r.downloadUrl}
                className="inline-flex items-center gap-2 shrink-0 bg-sage-700 hover:bg-sage-800 text-white text-sm font-medium px-4 py-2 rounded-full"
              >
                <Download size={14} /> İndir
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
