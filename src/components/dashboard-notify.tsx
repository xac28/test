"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, X } from "lucide-react"

export function DashboardNotify() {
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("booking_success") === "true") {
      setMessage("Your yoga session has been successfully booked! 🙏")
      setShow(true)
      
      // Clean up URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, "", newUrl)
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-24 right-4 z-50 animate-fade-left">
      <div className="bg-sage-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 min-w-[300px]">
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
          <CheckCircle2 size={24} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">Success!</p>
          <p className="text-xs text-sage-300">{message}</p>
        </div>
        <button onClick={() => setShow(false)} className="text-white/40 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
