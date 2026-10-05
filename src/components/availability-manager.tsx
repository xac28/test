"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"]
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`)

interface Slot {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export function AvailabilityManager({ teacherId, initialSlots }: { teacherId: string; initialSlots: Slot[] }) {
  const router = useRouter()
  const [slots, setSlots] = useState<Slot[]>(initialSlots)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const addSlot = () => {
    setSlots([...slots, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }])
    setSaved(false)
  }

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index))
    setSaved(false)
  }

  const updateSlot = (index: number, field: keyof Slot, value: any) => {
    const updated = [...slots]
    updated[index] = { ...updated[index], [field]: value }
    setSlots(updated)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/teachers/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, slots }),
      })

      if (res.ok) {
        setSaved(true)
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || "Kaydedilemedi")
      }
    } catch {
      alert("Bağlantı hatası, tekrar dene")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card p-8 rounded-3xl border border-sage-100 space-y-6">
      {slots.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sage-500 text-lg mb-4">Henüz müsaitlik eklemedin</p>
          <p className="text-sage-500 text-sm mb-6">Haftalık programını ekle; öğrenciler sana ders ayırabilsin</p>
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((slot, i) => (
            <div key={i} className="flex flex-wrap items-center gap-4 p-4 bg-white/50 rounded-2xl border border-sage-100/50 group">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-sage-500 uppercase tracking-wide font-medium">Gün</label>
                <select
                  value={slot.dayOfWeek}
                  onChange={e => updateSlot(i, "dayOfWeek", parseInt(e.target.value))}
                  className="rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 min-w-[140px]"
                >
                  {DAYS.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-sage-500 uppercase tracking-wide font-medium">Başlangıç</label>
                <select
                  value={slot.startTime}
                  onChange={e => updateSlot(i, "startTime", e.target.value)}
                  className="rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-sage-500 uppercase tracking-wide font-medium">Bitiş</label>
                <select
                  value={slot.endTime}
                  onChange={e => updateSlot(i, "endTime", e.target.value)}
                  className="rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <button
                onClick={() => removeSlot(i)}
                className="self-end text-red-400 hover:text-red-600 text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-red-50 transition"
              >
                ✗ Kaldır
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 pt-4 border-t border-sage-100/50">
        <button
          onClick={addSlot}
          className="bg-white text-sage-700 px-5 py-2.5 rounded-xl border border-sage-200 hover:border-sage-300 hover:bg-sage-50 text-sm font-medium transition btn-press"
        >
          + Saat aralığı ekle
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-sage-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-sage-700 transition disabled:opacity-50 btn-press"
        >
          {saving ? "Kaydediliyor…" : "Programı kaydet"}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium animate-fade-in">✓ Kaydedildi</span>
        )}
      </div>
    </div>
  )
}
