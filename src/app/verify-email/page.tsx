"use client"

import Link from "next/link"
import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { AuthCard } from "@/components/auth-card"

function Verify() {
  const token = useSearchParams().get("token") || ""
  const [state, setState] = useState<"working" | "ok" | "bad">("working")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!token) { setState("bad"); return }
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => setState(r.ok ? "ok" : "bad"))
      .catch(() => setState("bad"))
  }, [token])

  if (state === "working") {
    return <AuthCard title="Doğrulanıyor…"><div className="flex justify-center" data-testid="verify-working"><Loader2 className="animate-spin text-sage-500" size={36} /></div></AuthCard>
  }
  if (state === "ok") {
    return (
      <AuthCard title="E-postan doğrulandı">
        <div className="text-center" data-testid="verify-ok">
          <CheckCircle2 className="mx-auto text-teal-600" size={44} />
          <p className="mt-4 text-sage-700">Teşekkürler, hesabın artık doğrulanmış durumda.</p>
          <Link href="/dashboard" className="btn-cta mt-8">Panele git</Link>
        </div>
      </AuthCard>
    )
  }
  return (
    <AuthCard title="Bağlantı geçersiz">
      <div data-testid="verify-bad">
        <XCircle className="text-clay-600" size={36} />
        <p className="mt-4 text-sage-700 leading-relaxed">Bu doğrulama bağlantısı geçersiz, süresi dolmuş ya da daha önce kullanılmış. Giriş yapıp panelden yeni bir bağlantı isteyebilirsin.</p>
        <Link href="/dashboard" className="btn-cta mt-8">Panele git</Link>
      </div>
    </AuthCard>
  )
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><Verify /></Suspense>
}
