"use client"

import { useState } from "react"
import { ExternalLink, Loader2 } from "lucide-react"
import { useL } from "@/components/editorial"

interface StripeConnectButtonProps {
  isConnected: boolean
}

export function StripeConnectButton({ isConnected }: StripeConnectButtonProps) {
  const L = useL()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/teachers/stripe-connect", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) window.location.href = data.url
      else setError(data.error || L("Stripe bağlantısı başlatılamadı.", "Could not start the Stripe connection."))
    } catch {
      setError(L("Bağlantı hatası, lütfen tekrar deneyin.", "Connection error, please try again."))
    } finally {
      setLoading(false)
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3 p-4 border border-rule bg-paper rounded-xl" data-testid="stripe-connected">
        <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700" aria-hidden>✓</span>
        <div>
          <p className="font-medium text-ink">{L("Ödemeler bağlı", "Payouts connected")}</p>
          <p className="text-xs text-sage-600">{L("Stripe üzerinden doğrudan ödeme alabilirsiniz.", "You can receive direct payouts through Stripe.")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 border border-rule bg-paper rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-display text-xl text-ink">{L("Ödemeleri bağlayın", "Set up payouts")}</p>
          <p className="text-sm text-sage-600 mt-0.5">{L("Banka hesabınızı bağlayın; derslerinizin kazancı otomatik yatsın.", "Connect your bank account to receive automatic payouts for your sessions.")}</p>
        </div>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="shrink-0 inline-flex items-center justify-center gap-2 bg-ink hover:bg-sage-800 text-cream px-5 py-2.5 rounded-md text-sm font-semibold transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : null}
          {L("Stripe ile bağla", "Connect with Stripe")}
          <ExternalLink size={15} />
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-clay-600 mt-3">{error}</p>}
    </div>
  )
}
