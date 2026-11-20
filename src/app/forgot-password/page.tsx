"use client"

import Link from "next/link"
import { useState } from "react"
import { Mail, MailCheck } from "lucide-react"
import { AuthCard } from "@/components/auth-card"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) setError("Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.")
      else if (!res.ok) setError(data.error || "Bir sorun oluştu, tekrar dene.")
      else setSent(true)
    } catch {
      setError("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.")
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthCard title="E-postanı kontrol et">
        <div data-testid="forgot-sent" className="text-center">
          <MailCheck className="mx-auto text-teal-600" size={44} />
          <p className="mt-4 text-sage-700 leading-relaxed">
            <strong>{email}</strong> adresiyle bir hesap varsa, şifreni sıfırlamak için bir bağlantı gönderdik. Bağlantı 1 saat geçerlidir. Gelmediyse spam klasörüne de bak.
          </p>
          <Link href="/login" className="btn-ghost mt-8">Girişe dön</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Şifreni mi unuttun?" lead="E-posta adresini yaz; sana şifreni sıfırlaman için bir bağlantı gönderelim.">
      <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-500" size={16} />
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta adresi" aria-label="E-posta adresi" data-testid="forgot-email" className="w-full pl-11 pr-4 py-3.5 bg-white border border-rule rounded-xl focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink" />
        </div>
        {error && <p role="alert" data-testid="forgot-error" className="text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-lg px-3 py-2">{error}</p>}
        <button disabled={busy || !email} data-testid="forgot-submit" className="btn-cta w-full disabled:opacity-60 disabled:hover:translate-y-0">{busy ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}</button>
        <p className="text-center text-sm"><Link href="/login" className="tap-area text-sage-600 underline underline-offset-4 hover:text-ink">Girişe dön</Link></p>
      </form>
    </AuthCard>
  )
}
