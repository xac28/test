"use client"

import { useState } from "react"
import { Loader2, ShieldAlert } from "lucide-react"
import { liveWarning } from "@/components/community/parts"
import { scanPoaching, poachKindsLabel } from "@/lib/poaching"

/** The text students read on the teacher's profile; checked live and on the server. */
export function TeacherProfileEditor({ initialBio }: { initialBio: string }) {
  const [bio, setBio] = useState(initialBio)
  const [saved, setSaved] = useState(initialBio)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const poach = scanPoaching(bio, { teacher: true })
  const warn = liveWarning(bio) || (poach.clean ? null : `Bu metin platform dışına yönlendirme (${poachKindsLabel(poach.kinds)}) içeriyor. Yayınlanamaz; tekrarı uyarı/uzaklaştırma/ban ile sonuçlanır.`)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/teacher/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return setMsg({ ok: false, text: d.error || "Kaydedilemedi." })
      setSaved(d.bio)
      setMsg({ ok: true, text: "Profil metnin güncellendi." })
    } catch {
      setMsg({ ok: false, text: "Bağlantı hatası." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="glass-card p-8 rounded-3xl border border-sage-100 shadow-sm mt-8 space-y-4" data-testid="profile-editor">
      <h2 className="text-2xl font-display text-sage-800">Profil metnim</h2>
      <p className="text-sm text-sage-600 flex items-start gap-2"><ShieldAlert size={16} className="mt-0.5 shrink-0" /> <span>Öğrencilerin profilinde okuduğu yazı. <strong>Sosyal medya hesabı, telefon/WhatsApp, e-posta, bağlantı, "kendi kursuma gel" gibi platform dışına yönlendirme yasaktır</strong>; otomatik engellenir ve kayda geçer (1. ihlal uyarı, 2. ihlal 10 gün uzaklaştırma, 3. ihlal kalıcı ban).</span></p>
      <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 1200))} rows={5} data-testid="profile-bio" className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 ${warn ? "border-clay-500 focus:ring-clay-300" : "border-sage-200 focus:ring-sage-400"}`} placeholder="Kendini, deneyimini ve derslerinin tarzını anlat…" />
      <div className="flex justify-between text-xs"><p role={warn ? "alert" : undefined} data-testid="profile-bio-warn" className="text-clay-600">{warn}</p><span className="text-sage-500">{bio.length}/1200</span></div>
      {msg && <p role={msg.ok ? "status" : "alert"} data-testid="profile-msg" className={`text-sm rounded-md px-3 py-2 border ${msg.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-clay-50 border-clay-200 text-clay-700"}`}>{msg.text}</p>}
      <button disabled={busy || !!warn || bio.trim().length < 20 || bio === saved} data-testid="profile-save" className="inline-flex items-center gap-2 bg-sage-800 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-sage-700 transition disabled:opacity-50">
        {busy && <Loader2 size={15} className="animate-spin" />} Kaydet
      </button>
    </form>
  )
}
