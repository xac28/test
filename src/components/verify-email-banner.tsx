"use client"

import { useEffect, useState } from "react"
import { MailWarning } from "lucide-react"

/** Reminder on the dashboards for people whose e-mail address is not verified yet (hidden once verified, or Google sign-ins). */
export function VerifyEmailBanner() {
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetch("/api/auth/verify").then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d && !d.verified) setShow(true) }).catch(() => {})
    return () => { alive = false }
  }, [])

  async function resend() {
    setBusy(true)
    setMsg("")
    try {
      const res = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resend: true }) })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { setMsg("Doğrulama bağlantısı e-postana gönderildi."); if (d.alreadyVerified) setShow(false) }
      else setMsg(d.error || "Gönderilemedi, sonra tekrar dene.")
    } catch {
      setMsg("Bağlantı kurulamadı.")
    } finally {
      setBusy(false)
    }
  }

  if (!show) return null
  return (
    <div role="status" data-testid="verify-banner" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-saffron-300 bg-saffron-100 px-5 py-3.5 text-sm text-ink">
      <MailWarning size={18} className="shrink-0" />
      <span className="flex-1 min-w-[12rem]">E-posta adresini henüz doğrulamadın. Gelen kutundaki bağlantıya tıkla; bazı işlemler için doğrulama gerekebilir.</span>
      <button type="button" onClick={resend} disabled={busy} data-testid="verify-resend" className="font-semibold underline underline-offset-4 min-h-[44px] px-1 disabled:opacity-60">{busy ? "Gönderiliyor…" : "Bağlantıyı yeniden gönder"}</button>
      {msg && <span className="w-full text-xs" data-testid="verify-msg">{msg}</span>}
    </div>
  )
}
