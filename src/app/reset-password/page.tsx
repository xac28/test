"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react"
import { AuthCard } from "@/components/auth-card"

function ResetForm() {
  const token = useSearchParams().get("token") || ""
  const [valid, setValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) { setValid(false); return }
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`).then((r) => r.json()).then((d) => setValid(!!d.valid)).catch(() => setValid(false))
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 6) return setError("Şifre en az 6 karakter olmalıdır.")
    if (password !== again) return setError("İki şifre birbirinin aynısı olmalı.")
    setBusy(true)
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setDone(true)
      else if (data.code === "TOKEN_INVALID") setValid(false)
      else setError(data.error || "Şifre değiştirilemedi.")
    } catch {
      setError("Bağlantı kurulamadı. Tekrar dene.")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AuthCard title="Şifren değişti">
        <div className="text-center" data-testid="reset-done">
          <CheckCircle2 className="mx-auto text-teal-600" size={44} />
          <p className="mt-4 text-sage-700">Yeni şifrenle giriş yapabilirsin.</p>
          <Link href="/login" className="btn-cta mt-8" data-testid="reset-login">Giriş yap</Link>
        </div>
      </AuthCard>
    )
  }
  if (valid === false) {
    return (
      <AuthCard title="Bağlantı geçersiz">
        <div data-testid="reset-invalid">
          <p className="text-sage-700 leading-relaxed">Bu sıfırlama bağlantısı geçersiz, süresi dolmuş ya da daha önce kullanılmış. Yeni bir bağlantı isteyebilirsin.</p>
          <Link href="/forgot-password" className="btn-cta mt-8">Yeni bağlantı iste</Link>
        </div>
      </AuthCard>
    )
  }
  return (
    <AuthCard title="Yeni şifre belirle" lead="En az 6 karakterlik yeni bir şifre seç.">
      <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-500" size={16} />
          <input type={show ? "text" : "password"} required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Yeni şifre" aria-label="Yeni şifre" data-testid="reset-password" className="w-full pl-11 pr-11 py-3.5 bg-white border border-rule rounded-xl focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"} className="tap-area absolute right-4 top-1/2 -translate-y-1/2 text-sage-500 hover:text-ink">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-500" size={16} />
          <input type={show ? "text" : "password"} required minLength={6} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Yeni şifre (tekrar)" aria-label="Yeni şifre (tekrar)" data-testid="reset-again" className="w-full pl-11 pr-4 py-3.5 bg-white border border-rule rounded-xl focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink" />
        </div>
        {error && <p role="alert" data-testid="reset-error" className="text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-lg px-3 py-2">{error}</p>}
        <button disabled={busy || valid === null} data-testid="reset-submit" className="btn-cta w-full disabled:opacity-60 disabled:hover:translate-y-0">{busy ? "Kaydediliyor…" : "Şifreyi değiştir"}</button>
      </form>
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetForm /></Suspense>
}
