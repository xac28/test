"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AvatarUploader } from "./avatar-uploader"

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

interface ProfileData {
  firstName: string
  lastName: string
  image: string
  dateOfBirth: string
  phone: string
  address: string
  country: string
  passportId: string
  interests: string[]
  profileCompleted: boolean
}

export function StudentProfileForm({ initialData }: { initialData: ProfileData }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState(initialData)

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const toggleInterest = (style: string) => {
    setForm(prev => ({
      ...prev,
      interests: prev.interests.includes(style)
        ? prev.interests.filter(s => s !== style)
        : [...prev.interests, style]
    }))
    setSaved(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (res.ok) {
        setSaved(true)
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to save profile")
      }
    } catch {
      alert("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-8 md:p-10 rounded-3xl border border-sage-100 space-y-8">
      {/* Personal Information */}
      <div>
        <h3 className="text-lg font-display text-sage-800 mb-5 flex items-center gap-2">
          <span className="w-8 h-8 bg-sage-100 rounded-full flex items-center justify-center text-sm font-semibold text-sage-700">1</span>
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

      {/* Interests */}
      <div>
        <h3 className="text-lg font-display text-sage-800 mb-5 flex items-center gap-2">
          <span className="w-8 h-8 bg-sage-100 rounded-full flex items-center justify-center text-sm font-semibold text-sage-700">2</span>
          Areas of Interest
        </h3>
        <p className="text-sage-500 text-sm mb-4">Select the yoga styles you are interested in learning</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {YOGA_STYLES.map(style => {
            const isSelected = form.interests.includes(style)
            return (
              <button
                key={style}
                type="button"
                onClick={() => toggleInterest(style)}
                className={`p-3.5 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                  isSelected
                    ? "border-sage-600 bg-sage-100 text-sage-800"
                    : "border-sage-100 bg-white/50 text-sage-600 hover:border-sage-300"
                }`}
              >
                <span className="mr-2">{isSelected ? "✓" : "○"}</span>
                {style}
              </button>
            )
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-sage-600 text-white px-8 py-3.5 rounded-2xl font-medium hover:bg-sage-700 transition disabled:opacity-50 btn-press shadow-md"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium animate-fade-in flex items-center gap-1">
            ✓ Profile saved successfully
          </span>
        )}
      </div>
    </form>
  )
}
