"use client"

import { useSession, signIn } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { AvatarUploader } from "@/components/avatar-uploader"
import { useL } from "@/components/editorial"

// Stored values stay English/stable (the admin and the API read them); only the labels are translated.
const YOGA_STYLES: { value: string; tr: string; en: string }[] = [
  { value: "Face Yoga", tr: "Yüz yogası", en: "Face yoga" },
  { value: "Yin Yoga", tr: "Yin yoga", en: "Yin yoga" },
  { value: "Fasyal Yoga", tr: "Fasyal yoga", en: "Fascial yoga" },
  { value: "Vinyasa", tr: "Vinyasa", en: "Vinyasa" },
  { value: "Hatha Yoga", tr: "Hatha yoga", en: "Hatha yoga" },
  { value: "Mindfulness & Meditation", tr: "Farkındalık ve meditasyon", en: "Mindfulness & meditation" },
]

const COUNTRIES: { value: string; tr: string }[] = [
  { value: "Turkey", tr: "Türkiye" }, { value: "United States", tr: "Amerika Birleşik Devletleri" }, { value: "United Kingdom", tr: "Birleşik Krallık" },
  { value: "Germany", tr: "Almanya" }, { value: "France", tr: "Fransa" }, { value: "India", tr: "Hindistan" }, { value: "Brazil", tr: "Brezilya" },
  { value: "Japan", tr: "Japonya" }, { value: "Australia", tr: "Avustralya" }, { value: "Canada", tr: "Kanada" }, { value: "Spain", tr: "İspanya" },
  { value: "Italy", tr: "İtalya" }, { value: "Netherlands", tr: "Hollanda" }, { value: "Sweden", tr: "İsveç" }, { value: "Norway", tr: "Norveç" },
  { value: "Switzerland", tr: "İsviçre" }, { value: "Austria", tr: "Avusturya" }, { value: "Portugal", tr: "Portekiz" }, { value: "Greece", tr: "Yunanistan" },
  { value: "Other", tr: "Diğer" },
]

const input = "w-full border border-rule bg-white px-3.5 py-3 text-sm text-ink placeholder:text-sage-500 rounded-md focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"

function Field({ id, label, hint, children, wide }: { id: string; label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-sage-500 mt-1.5">{hint}</p>}
    </div>
  )
}

function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid md:grid-cols-12 gap-6 py-10 border-t border-rule first:border-t-0 first:pt-0">
      <div className="md:col-span-4">
        <p className="eyebrow mb-2">{n}</p>
        <h2 className="font-display text-3xl leading-tight">{title}</h2>
        {hint && <p className="text-sm text-sage-600 mt-2 leading-relaxed">{hint}</p>}
      </div>
      <div className="md:col-span-8">{children}</div>
    </section>
  )
}

export default function BecomeTeacherPage() {
  const L = useL()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: "", lastName: "", image: "", dateOfBirth: "", phone: "", address: "", country: "", passportId: "",
    specialties: [] as string[], certificateUrl: "", certificateStartDate: "", experience: "",
  })

  useEffect(() => {
    if (session?.user?.image && !form.image) setForm((prev) => ({ ...prev, image: session.user.image as string }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.image])

  const updateForm = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }))
  const toggleSpecialty = (style: string) =>
    setForm((prev) => ({ ...prev, specialties: prev.specialties.includes(style) ? prev.specialties.filter((s) => s !== style) : [...prev.specialties, style] }))

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCert(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (res.ok) updateForm("certificateUrl", data.url)
      else setError(data.error || L("Sertifika yüklenemedi.", "Could not upload the certificate."))
    } catch {
      setError(L("Sertifika yüklenemedi, lütfen tekrar deneyin.", "Could not upload the certificate, please try again."))
    } finally {
      setUploadingCert(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!session) return signIn("google")
    if (!agreedToTerms) return setError(L("Devam etmek için sözleşmeyi kabul etmelisiniz.", "You must accept the agreement to continue."))
    if (form.specialties.length === 0) return setError(L("En az bir uzmanlık alanı seçin.", "Select at least one specialty."))

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/teachers/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (res.ok) setSuccess(true)
      else setError((await res.text()) || L("Başvuru gönderilemedi.", "The application could not be sent."))
    } catch {
      setError(L("Bağlantı hatası, başvuru gönderilemedi.", "Connection error, the application was not sent."))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading") {
    return (
      <>
        <Navbar />
        <div className="min-h-[60vh] flex items-center justify-center text-sage-500"><Loader2 className="animate-spin" /></div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 lg:px-12 pt-14 pb-24">
        <header className="max-w-2xl mb-12">
          <p className="eyebrow mb-4">{L("Eğitmen başvurusu", "Teacher application")}</p>
          <h1 className="font-display font-light text-5xl md:text-6xl leading-[1.04]">
            {L("Pratiğini ", "Share your practice ")}<span className="italic text-clay-600">{L("paylaş.", "with us.")}</span>
          </h1>
          <p className="text-lg text-sage-600 mt-5 leading-relaxed">
            {L(
              "Sertifikalı eğitmenlerden oluşan topluluğumuza katıl. Başvurunu inceleriz, ardından kısa bir deneme yayınında yöneticilerle tanışırsın.",
              "Join our community of certified teachers. We review your application, then you meet our team in a short trial broadcast."
            )}
          </p>
          <ol className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sage-700">
            {[L("1 · Başvuru", "1 · Apply"), L("2 · İnceleme", "2 · Review"), L("3 · Deneme yayını", "3 · Trial broadcast"), L("4 · Ders vermeye başla", "4 · Start teaching")].map((x) => <li key={x}>{x}</li>)}
          </ol>
        </header>

        {success ? (
          <div className="border border-ink bg-paper p-10 md:p-14 text-center" role="status" data-testid="apply-success">
            <CheckCircle2 size={44} className="mx-auto text-emerald-600 mb-5" />
            <h2 className="font-display text-4xl mb-3">{L("Başvurun alındı", "Application received")}</h2>
            <p className="text-sage-700 text-lg">{L("Ekibimiz başvurunu ve sertifikalarını inceleyecek.", "Our team will review your application and certificates.")}</p>
            <p className="text-sage-600 text-sm mt-2 mb-8">{L("Sonuç e-posta ile bildirilir.", "You will be notified by e-mail.")}</p>
            <button onClick={() => router.push("/dashboard")} className="bg-ink text-cream px-8 py-3 text-sm font-semibold rounded-md hover:bg-sage-800">
              {L("Panele dön", "Back to dashboard")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate={false} className="border border-rule bg-paper px-6 md:px-10 py-10">
            <Section n="01" title={L("Kişisel bilgiler", "Personal details")} hint={L("Yalnızca yönetim ekibi görür; herkese açık profilde yer almaz.", "Only the admin team sees these; they are not on your public profile.")}>
              <div className="mb-8"><AvatarUploader currentImageUrl={form.image} onUploadSuccess={(url) => updateForm("image", url)} /></div>
              <div className="grid md:grid-cols-2 gap-5">
                <Field id="firstName" label={L("Ad *", "First name *")}>
                  <input id="firstName" required autoComplete="given-name" value={form.firstName} onChange={(e) => updateForm("firstName", e.target.value)} className={input} />
                </Field>
                <Field id="lastName" label={L("Soyad *", "Last name *")}>
                  <input id="lastName" required autoComplete="family-name" value={form.lastName} onChange={(e) => updateForm("lastName", e.target.value)} className={input} />
                </Field>
                <Field id="dob" label={L("Doğum tarihi *", "Date of birth *")}>
                  <input id="dob" required type="date" autoComplete="bday" value={form.dateOfBirth} onChange={(e) => updateForm("dateOfBirth", e.target.value)} className={input} />
                </Field>
                <Field id="phone" label={L("Telefon *", "Phone *")}>
                  <input id="phone" required type="tel" autoComplete="tel" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} className={input} placeholder="+90 555 123 4567" />
                </Field>
                <Field id="address" label={L("Adres", "Address")} wide>
                  <input id="address" autoComplete="street-address" value={form.address} onChange={(e) => updateForm("address", e.target.value)} className={input} />
                </Field>
                <Field id="country" label={L("Ülke *", "Country *")}>
                  <select id="country" required autoComplete="country-name" value={form.country} onChange={(e) => updateForm("country", e.target.value)} className={input}>
                    <option value="">{L("Ülke seçin", "Select a country")}</option>
                    {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{L(c.tr, c.value)}</option>)}
                  </select>
                </Field>
                <Field id="passport" label={L("Kimlik / pasaport no", "ID / passport number")}>
                  <input id="passport" value={form.passportId} onChange={(e) => updateForm("passportId", e.target.value)} className={input} />
                </Field>
              </div>
            </Section>

            <Section n="02" title={L("Uzmanlık alanları", "Specialties")} hint={L("Ders verebileceğin tüm alanları seç.", "Select every area you are qualified to teach.")}>
              <div role="group" aria-label={L("Uzmanlık alanları", "Specialties")} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {YOGA_STYLES.map((style) => {
                  const on = form.specialties.includes(style.value)
                  return (
                    <button
                      key={style.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSpecialty(style.value)}
                      className={`flex items-center gap-3 border px-4 py-3.5 text-left text-sm rounded-md transition ${on ? "border-ink bg-ink text-cream" : "border-rule bg-white text-ink hover:border-ink"}`}
                    >
                      <span className={`w-4 h-4 rounded-sm border flex items-center justify-center text-[10px] ${on ? "bg-cream text-ink border-cream" : "border-sage-400"}`} aria-hidden>{on ? "✓" : ""}</span>
                      {L(style.tr, style.en)}
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section n="03" title={L("Sertifika", "Certification")} hint={L("Belge güvenle saklanır ve yalnızca inceleme için kullanılır.", "Your document is stored securely and only used for review.")}>
              <div className="grid md:grid-cols-2 gap-5">
                <Field id="cert" label={L("Sertifika (PDF veya görsel)", "Certificate (PDF or image)")} hint={form.certificateUrl ? undefined : L("En fazla 10 MB", "Max 10 MB")}>
                  <div className="relative">
                    <input id="cert" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleCertUpload} className={`${input} file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-sage-100 file:text-ink hover:file:bg-sage-200`} />
                    {uploadingCert && <Loader2 size={16} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-sage-500" />}
                  </div>
                  {form.certificateUrl && <p className="text-emerald-700 text-xs mt-1.5">✓ {L("Sertifika yüklendi", "Certificate uploaded")}</p>}
                </Field>
                <Field id="certDate" label={L("Sertifika tarihi", "Certificate date")} hint={L("Kıdem düzeyini belirler.", "Determines your seniority level.")}>
                  <input id="certDate" type="date" value={form.certificateStartDate} onChange={(e) => updateForm("certificateStartDate", e.target.value)} className={input} />
                </Field>
              </div>
            </Section>

            <Section n="04" title={L("Deneyim", "Experience")} hint={L("Yoga yolculuğunu ve neden AYA'da ders vermek istediğini anlat.", "Tell us about your journey and why you want to teach on AYA.")}>
              <label htmlFor="experience" className="sr-only">{L("Deneyim", "Experience")}</label>
              <textarea id="experience" rows={6} value={form.experience} onChange={(e) => updateForm("experience", e.target.value)} className={`${input} resize-y leading-relaxed`} />
            </Section>

            <div className="pt-10 border-t border-rule space-y-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" required checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-orange-700" />
                <span className="text-sm text-sage-700 leading-relaxed">
                  Platform üzerinden vereceğim derslerin tıbbi tavsiye yerine geçmediğini, ödeme ve komisyon oranlarını kabul ettiğimi, dersleri platformun resmî kayıt özelliği dışında kayıt altına almayacağımı, platformda alınan kayıtların yalnızca öğrenci ile benim tarafımdan indirilebileceğini ve 30 gün sonra silineceğini{" "}
                  <Link href="/terms" target="_blank" className="text-ink underline underline-offset-2 font-medium">Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi</Link> kapsamında kabul ve beyan ederim.
                </span>
              </label>

              {error && <p role="alert" data-testid="apply-error" className="text-sm text-clay-600 border border-clay-200 bg-clay-50 rounded-md px-4 py-3">{error}</p>}

              {!session ? (
                <button type="button" onClick={() => signIn("google")} className="w-full sm:w-auto bg-ink text-cream px-10 py-3.5 text-sm font-semibold rounded-md hover:bg-sage-800">
                  {L("Başvurmak için giriş yap", "Sign in to apply")}
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting || !agreedToTerms} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-ink text-cream px-10 py-3.5 text-sm font-semibold rounded-md hover:bg-sage-800 disabled:opacity-40 disabled:cursor-not-allowed">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> {L("Gönderiliyor…", "Sending…")}</> : <><Send size={16} /> {L("Başvuruyu gönder", "Submit application")}</>}
                </button>
              )}
              <p className="text-xs text-sage-500">{L("Sertifikaların ekibimiz tarafından gizlilikle incelenir.", "Your certificates are reviewed confidentially by our team.")}</p>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </>
  )
}
