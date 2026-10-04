"use client"

import { useConfirm } from "./admin/ui"
import { refreshAdminBadges } from "./admin/tab-defs"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Loader2, PlaySquare, ShieldAlert, ShieldX, Video, XCircle } from "lucide-react"

interface Trial {
  id: string
  name: string | null
  email: string | null
  specialties: string | null
  trialNote: string | null
  createdAt: string
  inRoom: boolean
}

interface Approved {
  id: string
  name: string | null
  email: string | null
  trialReviewedAt: string | null
}

const parse = (s: string | null): string[] => {
  try {
    return s ? JSON.parse(s) : []
  } catch {
    return []
  }
}

/** Admin side of teacher vetting: who is waiting in their trial room, decisions, and revoking approvals. */
export function AdminTrials({ initialTrials, approved }: { initialTrials: Trial[]; approved: Approved[] }) {
  const router = useRouter()
  const [trials, setTrials] = useState<Trial[]>(initialTrials)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const mine = ++requestId.current
    try {
      const res = await fetch("/api/admin/trials")
      if (!res.ok) return
      const data = await res.json()
      if (mine === requestId.current) setTrials(data.trials)
    } catch {}
  }, [])

  // live "candidate is in the room" indicator
  useEffect(() => {
    load()
    const id = setInterval(load, 8000)
    return () => clearInterval(id)
  }, [load])

  const { ask, dialog } = useConfirm()

  const decide = (id: string, name: string | null, action: "approve" | "reject" | "revoke") => {
    ask({
      title: action === "approve" ? `${name} öğretmeni onayla` : action === "reject" ? `${name} adayı reddet` : `${name} onayını kaldır`,
      description:
        action === "approve"
          ? "Öğretmen herkese açık yayın ve ders verebilir; e-posta ile bilgilendirilir."
          : action === "reject"
          ? "Aday deneme aşamasında kalır ve yazdığınız gerekçeyi görür."
          : "Öğretmen deneme aşamasına döner; yeni rezervasyon alamaz ve yeniden onaylanmalıdır.",
      confirmLabel: action === "approve" ? "Onayla" : action === "reject" ? "Reddet" : "Onayı kaldır",
      tone: action === "approve" ? "primary" : "danger",
      input: { label: action === "approve" ? "Not (isteğe bağlı, öğretmene iletilir)" : "Gerekçe (öğretmene iletilir)", min: action === "approve" ? 0 : 3, multiline: true },
      onConfirm: async (note) => {
        setBusyId(id)
        setMessage(null)
        try {
          const res = await fetch(`/api/admin/teachers/${id}/trial`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, note: note || undefined }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || "İşlem başarısız oldu.")
          refreshAdminBadges()
          router.refresh()
          await load()
        } finally {
          setBusyId(null)
        }
      },
    })
  }

  return (
    <div className="space-y-10" data-testid="admin-trials">
      {dialog}
      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-display text-amber-900 flex items-center gap-3">
            <PlaySquare className="text-amber-500" /> Değerlendirme Bekleyen Öğretmenler
          </h2>
          <p className="text-sm text-amber-700/70 mt-1">
            Başvurusu kabul edilen öğretmenler, herkese açık ders ve yayın açmadan önce sizinle 5 dakikalık bir deneme yayını yapar.
          </p>
        </div>
        {message && <p role="alert" className="text-sm text-red-600">{message}</p>}

        {trials.length === 0 ? (
          <div className="glass-card p-12 rounded-3xl border border-dashed border-sage-300 text-center">
            <PlaySquare size={48} className="mx-auto text-sage-300 mb-4 opacity-50" />
            <p className="text-sage-600 text-lg font-medium">Bekleyen deneme yayını yok.</p>
          </div>
        ) : (
          <ul className="glass-card divide-y divide-sage-100 overflow-hidden">
            {trials.map((t) => (
              <li key={t.id} data-testid="trial-row" className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-sage-900 flex items-center gap-2">
                    {t.name}
                    {t.inRoom ? (
                      <span data-testid="trial-in-room" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Odada, sizi bekliyor
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-sage-500 bg-sage-100 px-2 py-0.5 rounded-full">Çevrimdışı</span>
                    )}
                  </p>
                  <p className="text-xs text-sage-500">{t.email}</p>
                  {parse(t.specialties).length > 0 && <p className="text-xs text-sage-600 mt-1">{parse(t.specialties).join(" · ")}</p>}
                  {t.trialNote && <p className="text-xs text-clay-600 mt-1">Son not: {t.trialNote}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/room/trial/${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="trial-join"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-sage-100 hover:bg-sage-200 text-sage-800 text-sm font-medium rounded-xl"
                  >
                    <Video size={14} /> Odaya katıl
                  </a>
                  <button
                    data-testid="trial-approve"
                    disabled={busyId === t.id}
                    onClick={() => decide(t.id, t.name, "approve")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
                  >
                    {busyId === t.id ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />} Onayla
                  </button>
                  <button
                    data-testid="trial-reject"
                    disabled={busyId === t.id}
                    onClick={() => decide(t.id, t.name, "reject")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-sm font-medium rounded-xl disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reddet
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3">
            <ShieldAlert className="text-sage-600" /> Onaylı Öğretmenler
          </h2>
          <p className="text-sm text-sage-500 mt-1">Sorunlu bir öğretmenin onayını kaldırırsanız yayınları kapatılır, atölyeleri taslağa alınır ve yeni rezervasyon alamaz.</p>
        </div>
        {approved.length === 0 ? (
          <p className="text-sm text-sage-500">Henüz onaylı öğretmen yok.</p>
        ) : (
          <ul className="glass-card divide-y divide-sage-100 overflow-hidden">
            {approved.map((t) => (
              <li key={t.id} data-testid="approved-row" className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sage-900 truncate">{t.name}</p>
                  <p className="text-xs text-sage-500 truncate">{t.email}</p>
                </div>
                <button
                  data-testid="trial-revoke"
                  disabled={busyId === t.id}
                  onClick={() => decide(t.id, t.name, "revoke")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  <ShieldX size={13} /> Onayı kaldır
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
