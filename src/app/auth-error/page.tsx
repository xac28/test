"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { AlertCircle } from "lucide-react"
import { Suspense } from "react"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  let errorMessage = "Giriş yaparken bilinmeyen bir hata oluştu."
  
  if (error === "Configuration") {
    errorMessage = "Sunucu yapılandırmasında bir hata var."
  } else if (error === "AccessDenied") {
    errorMessage = "Bu hesaba erişim izniniz yok."
  } else if (error === "Verification") {
    errorMessage = "Doğrulama süresi doldu veya daha önce kullanıldı."
  } else if (error === "OAuthSignin" || error === "OAuthCallback" || error === "OAuthCreateAccount" || error === "EmailCreateAccount" || error === "Callback" || error === "OAuthAccountNotLinked" || error === "EmailSignin" || error === "CredentialsSignin" || error === "SessionRequired") {
    errorMessage = "Giriş işlemi sırasında bir sorun oluştu. Lütfen tekrar deneyin."
  } else if (error) {
    errorMessage = `Hata Detayı: ${error}`
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-sage-50 px-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-sage-200 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-red-100 p-4 rounded-full">
            <AlertCircle size={40} className="text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-4">Giriş Başarısız</h1>
        <p className="text-ink/70 mb-8">{errorMessage}</p>
        <div className="flex flex-col gap-3">
          <Link 
            href="/login" 
            className="w-full py-3 bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-medium transition"
          >
            Tekrar Dene
          </Link>
          <Link 
            href="/" 
            className="w-full py-3 bg-sage-50 hover:bg-sage-100 text-sage-700 rounded-xl font-medium transition"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center">Yükleniyor...</div>}>
        <AuthErrorContent />
      </Suspense>
      <Footer />
    </>
  )
}
