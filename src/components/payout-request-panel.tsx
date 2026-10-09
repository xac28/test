"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Wallet } from "lucide-react"
import { MIN_PAYOUT_USD, PAYOUT_STATUS_LABEL_TR } from "@/lib/payouts"

interface PayoutItem {
  id: string
  amount: number
  currency: string
  method: string
  iban: string | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  adminNote: string | null
  createdAt: string
}

interface BalanceData {
  earned: number
  claimed: number
  available: number
  hasStripeConnect: boolean
  requests: PayoutItem[]
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-sky-50 text-sky-800 border-sky-200",
  PAID: "bg-green-50 text-green-800 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
}

/** Teacher side of the payout flow: balance, request form, request history (Turkish). */
export function PayoutRequestPanel() {
  const [data, setData] = useState<BalanceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"IBAN" | "STRIPE">("IBAN")
  const [iban, setIban] = useState("")
  const [accountName, setAccountName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/payouts")
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError("Bakiye bilgisi yüklenemedi.")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setDone(false)
    setSubmitting(true)
    try {
      const res = await fetch("/api/teacher/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method, iban, accountName }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(body.error || "Talep gönderilemedi.")
      } else {
        setDone(true)
        setAmount("")
        await load()
      }
    } catch {
      setFormError("Ağ hatası, tekrar deneyin.")
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data) {
    return (
      <p className="text-sm text-ink/50 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Yükleniyor…
      </p>
    )
  }

  const input = "w-full px-4 py-2.5 rounded-xl border border-sage-200 bg-white text-sm focus:outline-none focus:border-sage-500"

  return (
    <div className="space-y-8" data-testid="payout-panel">
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Toplam kazanç" value={data.earned} />
        <Stat label="Talep edilen / ödenen" value={data.claimed} />
        <Stat label="Çekilebilir bakiye" value={data.available} highlight testId="available-balance" />
      </div>

      <form onSubmit={submit} className="rounded-3xl border border-sage-200/70 bg-white p-6 space-y-4">
        <h2 className="font-display text-2xl text-ink flex items-center gap-2">
          <Wallet size={22} className="text-sage-600" /> Ödeme talebi oluştur
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-ink/50 block mb-1.5">Tutar (USD)</label>
            <input
              data-testid="payout-amount"
              type="number"
              step="0.01"
              min={MIN_PAYOUT_USD}
              max={data.available}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`En az ${MIN_PAYOUT_USD}`}
              className={input}
            />
          </div>
          <div>
            <label className="text-xs text-ink/50 block mb-1.5">Yöntem</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as any)} className={input}>
              <option value="IBAN">Banka havalesi (IBAN)</option>
              <option value="STRIPE" disabled={!data.hasStripeConnect}>
                Stripe Connect{data.hasStripeConnect ? "" : " (bağlı değil)"}
              </option>
            </select>
          </div>
        </div>

        {method === "IBAN" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink/50 block mb-1.5">IBAN</label>
              <input data-testid="payout-iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TR00 0000 0000 0000 0000 0000 00" className={`${input} font-mono`} />
            </div>
            <div>
              <label className="text-xs text-ink/50 block mb-1.5">Hesap sahibi</label>
              <input data-testid="payout-account-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Ad Soyad" className={input} />
            </div>
          </div>
        )}

        {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        {done && <p className="text-sm text-green-700">Talebiniz alındı. Yönetici onayından sonra ödeme yapılacaktır.</p>}

        <button
          data-testid="payout-submit"
          disabled={submitting || data.available < MIN_PAYOUT_USD}
          className="bg-sage-700 hover:bg-sage-800 text-white px-6 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Gönderiliyor…" : "Talep gönder"}
        </button>
        {data.available < MIN_PAYOUT_USD && (
          <p className="text-xs text-ink/50">Çekilebilir bakiyeniz en az {MIN_PAYOUT_USD} USD olduğunda talep oluşturabilirsiniz.</p>
        )}
      </form>

      <div className="rounded-3xl border border-sage-200/70 bg-white p-6">
        <h3 className="font-display text-xl text-ink mb-3">Talep geçmişi</h3>
        {data.requests.length === 0 ? (
          <p className="text-sm text-ink/50">Henüz talep yok.</p>
        ) : (
          <ul className="divide-y divide-sage-100">
            {data.requests.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-4" data-testid="payout-history-item">
                <div>
                  <p className="text-sm font-medium text-ink">{r.amount.toFixed(2)} {r.currency}</p>
                  <p className="text-xs text-ink/50">
                    {new Date(r.createdAt).toLocaleString("tr-TR")} · {r.method === "STRIPE" ? "Stripe" : r.iban?.replace(/(.{4})/g, "$1 ").trim()}
                  </p>
                  {r.adminNote && <p className="text-xs text-ink/60 mt-0.5">Not: {r.adminNote}</p>}
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLE[r.status]}`}>
                  {PAYOUT_STATUS_LABEL_TR[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, highlight, testId }: { label: string; value: number; highlight?: boolean; testId?: string }) {
  return (
    <div className={`rounded-3xl border p-5 ${highlight ? "bg-sage-800 text-white border-sage-800" : "bg-white border-sage-200/70"}`}>
      <p className={`text-xs ${highlight ? "text-sage-200" : "text-ink/50"}`}>{label}</p>
      <p data-testid={testId} className="font-display text-3xl mt-1">${value.toFixed(2)}</p>
    </div>
  )
}
