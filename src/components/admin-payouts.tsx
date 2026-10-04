"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Copy, Loader2, Wallet, XCircle, Banknote } from "lucide-react"
import { PAYOUT_STATUS_LABEL_TR } from "@/lib/payouts"
import { useConfirm, useToast } from "./admin/ui"

interface PayoutRow {
  id: string
  amount: number
  currency: string
  method: string
  iban: string | null
  accountName: string | null
  note: string | null
  adminNote: string | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  createdAt: string
  reviewedAt: string | null
  paidAt: string | null
  teacher: { user: { name: string | null; email: string | null; image: string | null } }
}

const FILTERS: { id: string; label: string }[] = [
  { id: "PENDING", label: "Beklemede" },
  { id: "APPROVED", label: "Onaylanan" },
  { id: "PAID", label: "Ödenen" },
  { id: "REJECTED", label: "Reddedilen" },
  { id: "", label: "Tümü" },
]

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-sky-50 text-sky-800 border-sky-200",
  PAID: "bg-green-50 text-green-800 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
}

export function AdminPayouts({ onChange }: { onChange?: () => void }) {
  const [filter, setFilter] = useState("PENDING")
  const [rows, setRows] = useState<PayoutRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Responses can arrive out of order (e.g. a reload after an action vs. a filter change):
  // only the most recent request may update the table.
  const requestId = useRef(0)
  // `load` is also called from async handlers whose closure may predate a filter change
  const filterRef = useRef(filter)
  filterRef.current = filter

  const load = useCallback(async () => {
    const mine = ++requestId.current
    const current = filterRef.current
    setError(null)
    try {
      const res = await fetch(`/api/admin/payouts${current ? `?status=${current}` : ""}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (mine === requestId.current) setRows(data.requests)
    } catch {
      if (mine === requestId.current) setError("Ödeme talepleri yüklenemedi.")
    }
  }, [])

  useEffect(() => {
    setRows(null)
    load()
  }, [filter, load])

  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()

  const act = (row: PayoutRow, action: "approve" | "reject" | "mark_paid") => {
    const amount = `${row.amount.toFixed(2)} ${row.currency}`
    const who = row.teacher.user.name ?? "öğretmen"
    ask({
      title: action === "reject" ? "Talebi reddet" : action === "mark_paid" ? "Ödendi olarak işaretle" : "Talebi onayla",
      description:
        action === "reject"
          ? `${amount} tutarındaki talep reddedilir ve tutar öğretmenin bakiyesine geri döner.`
          : action === "mark_paid"
          ? `${amount} tutarını ${who} adlı öğretmene ödediğinizi onaylıyor musunuz?`
          : `${amount} tutarındaki talebi onaylıyor musunuz? Ödemeyi daha sonra “ödendi” olarak işaretlersiniz.`,
      confirmLabel: action === "reject" ? "Reddet" : action === "mark_paid" ? "Ödendi" : "Onayla",
      tone: action === "reject" ? "danger" : "primary",
      ...(action === "reject" ? { input: { label: "Red gerekçesi (öğretmene e-posta ile iletilir)", min: 3, multiline: true } } : {}),
      onConfirm: async (note) => {
        setBusyId(row.id)
        try {
          const res = await fetch(`/api/admin/payouts/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, note: note || undefined }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || "İşlem başarısız oldu.")
          show(action === "reject" ? "Talep reddedildi" : action === "mark_paid" ? "Ödendi olarak işaretlendi" : "Talep onaylandı")
          await load()
          onChange?.()
        } finally {
          setBusyId(null)
        }
      },
    })
  }

  return (
    <div className="space-y-6" data-testid="admin-payouts">
      {dialog}
      {toast}
      <div>
        <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3">
          <Wallet className="text-sage-600" /> Ödeme Talepleri
        </h2>
        <p className="text-sm text-sage-500 mt-1">Öğretmenlerin hakediş çekme taleplerini inceleyin, onaylayın veya reddedin.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-sm border transition ${filter === f.id ? "bg-sage-800 text-white border-sage-800" : "bg-white text-sage-700 border-sage-200 hover:border-sage-400"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows === null ? (
        <p className="text-sm text-sage-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-dashed border-sage-300 text-center text-sage-500">
          Bu filtrede ödeme talebi yok.
        </div>
      ) : (
        <div className="glass-card rounded-3xl border border-sage-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-sage-50/80 border-b border-sage-200/60 text-xs uppercase tracking-wider text-sage-500 font-semibold">
                <tr>
                  <th className="px-5 py-4">Öğretmen</th>
                  <th className="px-5 py-4">Tutar</th>
                  <th className="px-5 py-4">Yöntem / IBAN</th>
                  <th className="px-5 py-4">Talep Tarihi</th>
                  <th className="px-5 py-4">Durum</th>
                  <th className="px-5 py-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100/50">
                {rows.map((r) => (
                  <tr key={r.id} data-testid="payout-row" className="align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-sage-900">{r.teacher.user.name}</p>
                      <p className="text-xs text-sage-500">{r.teacher.user.email}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-sage-900 whitespace-nowrap">
                      {r.amount.toFixed(2)} {r.currency}
                    </td>
                    <td className="px-5 py-4 text-xs text-sage-700">
                      {r.method === "STRIPE" ? (
                        <span className="inline-flex items-center gap-1"><Banknote size={12} /> Stripe Connect</span>
                      ) : (
                        <>
                          <p className="font-medium">{r.accountName}</p>
                          <p className="font-mono flex items-center gap-1 mt-0.5">
                            {r.iban}
                            <button
                              title="IBAN'ı kopyala"
                              onClick={() => r.iban && navigator.clipboard?.writeText(r.iban)}
                              className="text-sage-400 hover:text-sage-700"
                            >
                              <Copy size={12} />
                            </button>
                          </p>
                        </>
                      )}
                      {r.note && <p className="text-sage-500 mt-1 italic">“{r.note}”</p>}
                      {r.adminNote && <p className="text-sage-500 mt-1">Yönetici notu: {r.adminNote}</p>}
                    </td>
                    <td className="px-5 py-4 text-xs text-sage-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold rounded-full border ${STATUS_STYLE[r.status]}`}>
                        {PAYOUT_STATUS_LABEL_TR[r.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {r.status === "PENDING" && (
                          <button
                            data-testid="payout-approve"
                            disabled={busyId === r.id}
                            onClick={() => act(r, "approve")}
                            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} /> Onayla
                          </button>
                        )}
                        {r.status === "APPROVED" && (
                          <button
                            data-testid="payout-mark-paid"
                            disabled={busyId === r.id}
                            onClick={() => act(r, "mark_paid")}
                            className="flex items-center gap-1.5 bg-sage-800 hover:bg-sage-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            <Banknote size={14} /> Ödendi İşaretle
                          </button>
                        )}
                        {(r.status === "PENDING" || r.status === "APPROVED") && (
                          <button
                            data-testid="payout-reject"
                            disabled={busyId === r.id}
                            onClick={() => act(r, "reject")}
                            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            <XCircle size={14} /> Reddet
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
