"use client"

import { useSession, signIn } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AvatarUploader } from "@/components/avatar-uploader"
import { User, BookOpen, FileBadge, History, CheckCircle2, Circle, Flower2, Send } from "lucide-react"

const YOGA_STYLES = [
  "Face Yoga",
  "Yin Yoga",
  "Fasyal Yoga",
  "Vinyasa",
  "Hatha Yoga",
  "Mindfulness & Meditation",
]

const COUNTRIES = [
  "Turkey", "United States", "United Kingdom", "Germany", "France", "India",
  "Brazil", "Japan", "Australia", "Canada", "Spain", "Italy", "Netherlands",
  "Sweden", "Norway", "Switzerland", "Austria", "Portugal", "Greece", "Other"
]

export default function BecomeTeacherPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Form state
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    image: "",
    dateOfBirth: "",
    phone: "",
    address: "",
    country: "",
    passportId: "",
    specialties: [] as string[],
    certificateUrl: "",
    certificateStartDate: "",
    experience: "",
  })

  // Set initial image from session
  useEffect(() => {
    if (session?.user?.image && !form.image) {
      setForm(prev => ({ ...prev, image: session.user.image as string }))
    }
  }, [session?.user?.image])

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleSpecialty = (style: string) => {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(style)
        ? prev.specialties.filter(s => s !== style)
        : [...prev.specialties, style]
    }))
  }

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCert(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        updateForm("certificateUrl", data.url)
      } else {
        const data = await res.json()
        alert(data.error || "Upload failed")
      }
    } catch {
      alert("Upload failed — please try again")
    } finally {
      setUploadingCert(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) {
      signIn("google")
      return
    }

    if (!agreedToTerms) {
      alert("Platform sözleşmesini ve kurallarını kabul etmeniz gerekmektedir.")
      return
    }

    if (form.specialties.length === 0) {
      alert("Please select at least one specialty area")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/teachers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const text = await res.text()
        alert(text || "Something went wrong.")
      }
    } catch {
      alert("Error submitting application.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="animate-pulse-ring w-16 h-16 bg-sage-300 rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-sage-900 py-12 px-4 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <svg className="absolute left-0 top-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="0.5">
          <path d="M0,100 C30,60 70,40 100,0 L100,100 Z" fill="currentColor" opacity="0.2"/>
          <path d="M20,100 C50,50 80,30 100,0 L100,100 Z" fill="currentColor" opacity="0.4"/>
        </svg>
      </div>
      <div className="absolute top-20 right-20 w-96 h-96 bg-sage-500/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-clay-500/10 rounded-full blur-3xl" style={{ animationDelay: '2s' }} />

      <div className="max-w-4xl mx-auto z-10 relative pt-10">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-up">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest text-sage-200 mb-6 border border-white/10">
            <Flower2 size={14} className="text-pink-300" /> Instructor Application
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display text-white mb-6 leading-tight">Share Your <span className="italic text-sage-300">Light</span></h1>
          <p className="text-sage-300 text-lg md:text-xl max-w-2xl mx-auto font-light">
            Join our global community of certified teachers. Connect deeply, teach globally, and grow your practice.
          </p>
        </div>

        {success ? (
          <div className="bg-white/90 backdrop-blur-xl p-12 rounded-[2.5rem] text-center border border-sage-100 shadow-2xl animate-scale-in">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-green-200">
              <CheckCircle2 size={48} className="text-green-600" />
            </div>
            <h2 className="text-4xl font-display text-sage-900 mb-4">Application Submitted!</h2>
            <p className="text-sage-600 mb-2 text-xl font-light">Thank you. Our team will review your application and certificates.</p>
            <p className="text-sage-500 text-sm mb-10">You will be notified via email once your application is processed.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-sage-900 text-white px-10 py-4 rounded-xl hover:bg-sage-800 transition font-bold btn-press shadow-lg shadow-sage-900/20"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-xl p-8 md:p-14 rounded-[2.5rem] border border-sage-100/50 shadow-2xl shadow-sage-900/40 space-y-12 animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none text-sage-900">
              <Flower2 size={200} />
            </div>
            
            {/* Section: Personal Information */}
            <div className="relative z-10">
              <h3 className="text-xl font-display text-sage-900 mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-sage-100/80 rounded-xl flex items-center justify-center text-sage-700 shadow-inner border border-sage-200/60">
                  <User size={18} />
                </span>
                Personal Information
              </h3>

              <div className="mb-8 flex flex-col items-center justify-center">
                <AvatarUploader 
                  currentImageUrl={form.image} 
                  onUploadSuccess={(url) => updateForm("image", url)} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">First Name *</label>
                  <input
                    required
                    value={form.firstName}
                    onChange={e => updateForm("firstName", e.target.value)}
                    className="w-full rounded-xl border border-sage-200 bg-white/70 p-3.5 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition text-sage-900 text-sm"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Last Name *</label>
                  <input
                    required
                    value={form.lastName}
                    onChange={e => updateForm("lastName", e.target.value)}
                    className="w-full rounded-xl border border-sage-200 bg-white/70 p-3.5 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition text-sage-900 text-sm"
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Date of Birth *</label>
                  <input
                    required
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => updateForm("dateOfBirth", e.target.value)}
                    className="w-full rounded-xl border border-sage-200 bg-white/70 p-3.5 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition text-sage-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Phone *</label>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={e => updateForm("phone", e.target.value)}
                    className="w-full rounded-xl border border-sage-200 bg-white/70 p-3.5 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition text-sage-900 text-sm"
                    placeholder="+90 555 123 4567"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Address</label>
                  <input
                    value={form.address}
                    onChange={e => updateForm("address", e.target.value)}
                    className="w-full rounded-xl border border-sage-200 bg-white/70 p-3.5 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition text-sage-900 text-sm"
                    placeholder="Full address"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Country *</label>
                  <select
                    required
                    value={form.country}
                    onChange={e => updateForm("country", e.target.value)}
                    className="w-full rounded-xl border border-sage-200 bg-white/70 p-3.5 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition text-sage-900 text-sm"
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Passport / ID Number</label>
                  <input
                    value={form.passportId}
                    onChange={e => updateForm("passportId", e.target.value)}
                    className="w-full rounded-xl border border-sage-200 bg-white/70 p-3.5 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition text-sage-900 text-sm"
                    placeholder="TR12345678"
                  />
                </div>
              </div>
            </div>

            {/* Section: Specialties */}
            <div className="relative z-10 pt-8 border-t border-sage-100">
              <h3 className="text-xl font-display text-sage-900 mb-2 flex items-center gap-3">
                <span className="w-10 h-10 bg-sage-100/80 rounded-xl flex items-center justify-center text-sage-700 shadow-inner border border-sage-200/60">
                  <BookOpen size={18} />
                </span>
                Teaching Specialties
              </h3>
              <p className="text-sage-500 text-sm mb-6 pl-13">Select all the areas you are qualified to teach</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {YOGA_STYLES.map(style => {
                  const isSelected = form.specialties.includes(style)
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => toggleSpecialty(style)}
                      className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all text-left flex items-center gap-3 shadow-sm btn-press ${
                        isSelected
                          ? "border-sage-600 bg-sage-50 text-sage-900"
                          : "border-sage-100 bg-white text-sage-500 hover:border-sage-300 hover:text-sage-700"
                      }`}
                    >
                      {isSelected ? <CheckCircle2 size={18} className="text-sage-600" /> : <Circle size={18} className="text-sage-300" />}
                      {style}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section: Certificate */}
            <div className="relative z-10 pt-8 border-t border-sage-100">
              <h3 className="text-xl font-display text-sage-900 mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-sage-100/80 rounded-xl flex items-center justify-center text-sage-700 shadow-inner border border-sage-200/60">
                  <FileBadge size={18} />
                </span>
                Certification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Certificate (PDF)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleCertUpload}
                      className="w-full rounded-xl border border-sage-200 bg-white/70 p-3 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-sage-100 file:text-sage-700 hover:file:bg-sage-200 transition"
                    />
                    {uploadingCert && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-sage-300 border-t-sage-600 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {form.certificateUrl && (
                    <p className="text-green-600 text-xs mt-2 flex items-center gap-1">
                      ✓ Certificate uploaded successfully
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Certificate Start Date</label>
                  <input
                    type="date"
                    value={form.certificateStartDate}
                    onChange={e => updateForm("certificateStartDate", e.target.value)}
                    className="w-full rounded-xl border border-sage-200 bg-white/70 p-3.5 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition text-sage-900 text-sm"
                  />
                  <p className="text-sage-400 text-xs mt-1.5">This determines your seniority level</p>
                </div>
              </div>
            </div>

            {/* Section: Experience */}
            <div className="relative z-10 pt-8 border-t border-sage-100">
              <h3 className="text-xl font-display text-sage-900 mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-sage-100/80 rounded-xl flex items-center justify-center text-sage-700 shadow-inner border border-sage-200/60">
                  <History size={18} />
                </span>
                Experience & Background
              </h3>
              <textarea
                rows={5}
                value={form.experience}
                onChange={e => updateForm("experience", e.target.value)}
                placeholder="Tell us about your yoga journey, teaching experience, certifications, and why you want to teach on AYA..."
                className="w-full rounded-xl border border-sage-200 bg-white/70 p-4 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition resize-none text-sage-900 placeholder:text-sage-400 text-sm leading-relaxed"
              />
            </div>

            {/* Legal Agreement */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-sage-600 rounded"
                />
                <span className="text-sm text-ink/70 leading-relaxed">
                  Platform üzerinden vereceğim derslerin tıbbi tavsiye yerine geçmediğini, ödeme ve komisyon oranlarını kabul ettiğimi, ve dersleri platformun resmî kayıt özelliği dışında kayıt altına almayacağımı, platformda alınan kayıtların yalnızca öğrenci ile benim tarafımdan indirilebileceğini ve 30 gün sonra silineceğini <Link href="/terms" target="_blank" className="text-sage-600 underline font-medium">Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi</Link> kapsamında kabul ve beyan ederim.
                </span>
              </label>
            </div>

            {/* Submit */}
            {!session ? (
              <button
                type="button"
                onClick={() => signIn("google")}
                className="w-full bg-sage-900 text-sage-50 py-4 md:py-5 rounded-2xl font-bold hover:bg-sage-800 transition btn-press shadow-xl shadow-sage-900/20 text-lg flex items-center justify-center gap-3"
              >
                <User size={20} /> Sign In to Apply
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !agreedToTerms}
                className="w-full bg-sage-800 text-white py-4 md:py-5 rounded-2xl font-bold hover:bg-sage-900 transition disabled:opacity-50 disabled:cursor-not-allowed btn-press shadow-xl shadow-sage-900/20 text-lg flex items-center justify-center gap-3"
              >
                {isSubmitting ? "Submitting Application..." : <><Send size={20} /> Submit Application</>}
              </button>
            )}

            <p className="text-center text-sage-400 text-xs">
              Your certificates will be securely reviewed by our team.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
