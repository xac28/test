"use client"

import { useState } from "react"
import { ExternalLink } from "lucide-react"

interface StripeConnectButtonProps {
  isConnected: boolean
}

export function StripeConnectButton({ isConnected }: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/teachers/stripe-connect", {
        method: "POST",
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        }
      } else {
        const data = await res.json()
        alert(data.error || "Failed to initiate connection")
      }
    } catch {
      alert("Network error")
    } finally {
      setLoading(false)
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</div>
        <div>
          <p className="font-medium text-green-900">Payouts Connected</p>
          <p className="text-xs text-green-700">You are ready to receive direct payouts via Stripe.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-blue-50 border border-blue-200 rounded-2xl">
      <div>
        <p className="font-medium text-blue-900">Setup Payouts</p>
        <p className="text-sm text-blue-700">Connect your bank account to receive automatic payouts for your sessions.</p>
      </div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-medium transition disabled:opacity-50"
      >
        {loading ? "Loading..." : "Connect with Stripe"}
        <ExternalLink size={16} />
      </button>
    </div>
  )
}
