"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Loader2, ShieldCheck } from "lucide-react"
import { safeNextPath, RECORDING_RETENTION_DAYS } from "@/lib/terms"

function AcceptTermsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { update } = useSession()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const next = safeNextPath(params.get("next"))

  const accept = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptTerms: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Kabul işlemi başarısız oldu.")
      }
      // Re-issue the JWT so the middleware sees termsAccepted = true
      await update()
      router.replace(next)
      router.refresh()
    } catch (e: any) {
      setError(e.message || "Bir hata oluştu.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-sage-100 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="text-sage-600" size={28} />
          <h1 className="font-display text-3xl text-ink">Sözleşmeyi kabul edin</h1>
        </div>
        <p className="text-sm text-ink/70 mb-4">
          Devam etmeden önce güncel Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi&apos;ni onaylamanız gerekir.
        </p>
        <ul className="text-sm text-ink/70 space-y-2 mb-6 list-disc pl-5">
          <li>Dersler, öğretmenin tarayıcısında otomatik kaydedilebilir; kayıt yalnızca o dersin öğretmeni ve öğrencisi tarafından indirilebilir.</li>
          <li>Kayıtlar {RECORDING_RETENTION_DAYS} gün sonra otomatik silinir.</li>
          <li>Dersleri başka bir yöntemle kaydetmek, paylaşmak veya yayınlamak yasaktır.</li>
        </ul>

        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            data-testid="accept-terms-checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 w-4 h-4 accent-sage-600"
          />
          <span className="text-sm text-ink/80">
            <Link href="/terms" target="_blank" className="text-sage-700 underline font-medium">
              Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi
            </Link>{" "}
            ile{" "}
            <Link href="/privacy" target="_blank" className="text-sage-700 underline font-medium">
              Gizlilik Politikası
            </Link>
            &apos;nı okudum, kabul ediyorum.
          </span>
        </label>

        {error && <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          data-testid="accept-terms-submit"
          onClick={accept}
          disabled={!accepted || loading}
          className="w-full bg-sage-700 hover:bg-sage-800 text-white py-3.5 rounded-full text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Kabul Ediyorum ve Devam Et"}
        </button>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full mt-3 text-sm text-ink/50 hover:text-ink underline"
        >
          Kabul etmiyorum, çıkış yap
        </button>
      </div>
    </main>
  )
}

export default function AcceptTermsPage() {
  return (
    <Suspense fallback={null}>
      <AcceptTermsContent />
    </Suspense>
  )
}
