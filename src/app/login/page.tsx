"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { Eye, EyeOff, Loader2, Mail, Lock, Sparkles } from "lucide-react"

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

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (mode === "register") {
        // Step 1: Create account via dedicated web register endpoint
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
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

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-sage-50 via-cream to-sage-100 flex items-center justify-center px-4 py-16 relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-sage-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-clay-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sage-100 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-float" style={{ animationDelay: "4s" }} />

        <div className="relative z-10 w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8 animate-fade-in">
            <Link href="/" className="inline-flex items-center gap-2">
              <Sparkles className="text-sage-600" size={28} />
              <span className="font-display text-3xl text-ink">Namaste</span>
            </Link>
            <p className="text-sage-500 text-sm mt-2">
              {mode === "login" ? "Hesabınıza giriş yapın" : "Yeni bir hesap oluşturun"}
            </p>
          </div>

          {/* Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-sage-200/50 border border-white/60 p-8 animate-fade-in" style={{ animationDelay: "150ms" }}>
            {/* Tabs */}
            <div className="flex bg-sage-50 rounded-2xl p-1 mb-6">
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${mode === "login" ? "bg-white text-ink shadow-sm" : "text-sage-500"}`}
              >
                Giriş Yap
              </button>
              <button
                onClick={() => { setMode("register"); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${mode === "register" ? "bg-white text-ink shadow-sm" : "text-sage-500"}`}
              >
                Kayıt Ol
              </button>
            </div>

            {/* Google Sign-In */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-sage-200 hover:border-sage-400 rounded-2xl py-3 text-sm font-medium text-ink hover:shadow-md transition-all duration-300 mb-5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google ile devam et
            </button>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-sage-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white/80 px-4 text-xs text-sage-400 font-medium">VEYA</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCredentialsLogin} className="space-y-4">
              {mode === "register" && (
                <div className="relative animate-fade-in">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ad Soyad"
                    required
                    className="w-full bg-sage-50/60 border border-sage-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-transparent transition"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-400">👤</span>
                </div>
              )}

              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-posta adresi"
                  required
                  className="w-full bg-sage-50/60 border border-sage-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-transparent transition"
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifre"
                  required
                  minLength={6}
                  className="w-full bg-sage-50/60 border border-sage-200 rounded-2xl pl-11 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-transparent transition"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Remember Me Toggle */}
              {mode === "login" && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div 
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`relative w-11 h-6 rounded-full transition-all duration-300 ${rememberMe ? 'bg-sage-600' : 'bg-sage-200'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${rememberMe ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sage-600 group-hover:text-sage-800 transition select-none">Beni Hatırla</span>
                  </label>
                  <span className="text-sage-400 text-xs">{rememberMe ? "30 gün oturum" : "Oturum kalıcı değil"}</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-2xl border border-red-200 animate-fade-in flex items-center gap-2">
                  <span className="text-lg">⚠️</span> {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-sage-600/25 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  mode === "login" ? "Giriş Yap" : "Kayıt Ol"
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-sage-400 mt-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
            Giriş yaparak{" "}
            <Link href="/terms" className="underline hover:text-sage-600">Kullanım Şartları</Link> ve{" "}
            <Link href="/privacy" className="underline hover:text-sage-600">Gizlilik Politikası</Link>
            &apos;nı kabul etmiş olursunuz.
          </p>
        </div>
      </div>
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
