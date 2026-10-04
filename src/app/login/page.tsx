"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { Eye, EyeOff, Loader2, Mail, Lock, User } from "lucide-react"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (mode === "register" && !acceptTerms) {
      setError("Kayıt olmak için sözleşmeyi kabul etmelisiniz.")
      setLoading(false)
      return
    }

    try {
      if (mode === "register") {
        // Step 1: Create account via dedicated web register endpoint
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, acceptTerms }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "Kayıt başarısız oldu.")
          setLoading(false)
          return
        }
        // If account was linked (Google → credentials), show success info
        if (data.linked) {
          // Account was synced with existing Google account — proceed to sign in
        }
      }

      // Step 2: Sign in via NextAuth (creates cookie-based web session)
      const result = await signIn("credentials", {
        email,
        password,
        rememberMe: rememberMe.toString(),
        redirect: false,
      })

      if (result?.error) {
        if (mode === "register") {
          setError("Hesap oluşturuldu ancak giriş yapılamadı. Lütfen tekrar deneyin.")
        } else {
          setError("E-posta veya şifre hatalı.")
        }
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl })
  }

  const field = "w-full bg-paper border border-rule focus:border-ink focus:outline-none rounded-md pl-11 pr-4 py-3 text-sm transition-colors"

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
        {/* editorial side panel */}
        <aside className="hidden lg:flex flex-col justify-between bg-sage-900 text-cream p-14">
          <p className="eyebrow !text-cream/50">AYA</p>
          <div>
            <h2 className="font-display font-light text-6xl leading-[1.02]">
              {mode === "login" ? "Pratiğine" : "Nefes almaya"}<br />
              <em className="italic text-clay-300">{mode === "login" ? "kaldığın yerden devam et." : "bugün başla."}</em>
            </h2>
            <ul className="mt-10 space-y-3 text-cream/70 max-w-sm">
              <li>— Canlı atölyeler ve yayınlar</li>
              <li>— Sertifikalı eğitmenlerle birebir dersler</li>
              <li>— Derslerin 30 gün boyunca indirilebilir kaydı</li>
            </ul>
          </div>
          <p className="text-xs text-cream/40">© {new Date().getFullYear()} AYA</p>
        </aside>

        <section className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md">
            <h1 className="font-display text-4xl mb-2">{mode === "login" ? "Giriş yap" : "Hesap oluştur"}</h1>
            <p className="text-sage-600 text-sm mb-8">
              {mode === "login" ? "Hesabınıza giriş yapın." : "Birkaç saniyede üye olun."}
            </p>

            <div className="flex border-b border-rule mb-8" role="tablist">
              {([["login", "Giriş Yap"], ["register", "Kayıt Ol"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => { setMode(m); setError(""); }}
                  className={`flex-1 py-3 text-sm font-semibold -mb-px border-b-2 transition-colors ${mode === m ? "border-ink text-ink" : "border-transparent text-sage-500 hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 border border-rule hover:border-ink rounded-md py-3 text-sm font-medium transition-colors mb-6"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google ile devam et
            </button>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-rule" /></div>
              <span className="relative bg-cream px-4 text-xs text-sage-500 tracking-widest">VEYA</span>
            </div>

            <form onSubmit={handleCredentialsLogin} className="space-y-4">
              {mode === "register" && (
                <div className="relative">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" required className={field} />
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-500" size={16} />
                </div>
              )}

              <div className="relative">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta adresi" required className={field} />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-500" size={16} />
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifre"
                  required
                  minLength={6}
                  className={`${field} pr-11`}
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-500" size={16} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} className="absolute right-4 top-1/2 -translate-y-1/2 text-sage-500 hover:text-ink">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {mode === "login" && (
                <label className="flex items-center justify-between text-sm cursor-pointer">
                  <span className="flex items-center gap-2.5">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-orange-700" />
                    Beni hatırla
                  </span>
                  <span className="text-sage-500 text-xs">{rememberMe ? "30 gün oturum" : "Tarayıcı kapanınca çıkış"}</span>
                </label>
              )}

              {mode === "register" && (
                <label className="flex items-start gap-3 cursor-pointer text-sm text-sage-700">
                  <input type="checkbox" data-testid="register-accept-terms" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-orange-700" />
                  <span>
                    <Link href="/terms" target="_blank" className="underline font-medium">Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi</Link>
                    {" "}ile{" "}
                    <Link href="/privacy" target="_blank" className="underline font-medium">Gizlilik Politikası</Link>
                    &apos;nı okudum, kabul ediyorum.
                  </span>
                </label>
              )}

              {error && (
                <div role="alert" className="text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-md px-4 py-3">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || (mode === "register" && !acceptTerms)}
                className="w-full bg-ink hover:bg-sage-800 text-cream py-3.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex justify-center items-center"><Loader2 className="animate-spin text-sage-600" size={32} /></div>}>
      <LoginContent />
    </Suspense>
  )
}
