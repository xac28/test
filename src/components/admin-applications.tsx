"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useConfirm, useToast } from "./admin/ui"
import { refreshAdminBadges } from "./admin/tab-defs"
import { CheckCircle2, XCircle, Eye, EyeOff, FileBadge, Calendar, MapPin, Phone, User as UserIcon } from "lucide-react"

interface Application {
  id: string
  userId: string
  status: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  country: string | null
  passportId: string | null
  specialties: string | null
  certificateUrl: string | null
  certificateStartDate: string | null
  experience: string | null
  submittedAt: string
  user: {
    name: string | null
    email: string | null
    image: string | null
  }
}

export function AdminApplicationsTable({ applications }: { applications: Application[] }) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()

  const handleAction = (app: Application, action: "approve" | "reject") => {
    const who = app.firstName && app.lastName ? `${app.firstName} ${app.lastName}` : app.user.name || "Başvuran"
    ask({
      title: action === "approve" ? `${who} başvurusunu onayla` : `${who} başvurusunu reddet`,
      description:
        action === "approve"
          ? "Başvuran eğitmen olur ve deneme odası aşamasına geçer; e-posta ile bilgilendirilir."
          : "Başvuru reddedilir. Yazdığınız gerekçe başvurana e-posta ile iletilir.",
      confirmLabel: action === "approve" ? "Onayla" : "Reddet",
      tone: action === "approve" ? "primary" : "danger",
      input: { label: action === "approve" ? "Not (isteğe bağlı, başvurana iletilir)" : "Red gerekçesi (başvurana iletilir)", min: action === "approve" ? 0 : 5, multiline: true },
      onConfirm: async (reason) => {
        setProcessingId(app.id)
        try {
          const res = await fetch(`/api/admin/applications/${app.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, reason: reason || null }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || "Bir şeyler ters gitti")
          show(data.message || "Kaydedildi")
          refreshAdminBadges()
          router.refresh()
        } finally {
          setProcessingId(null)
        }
      },
    })
  }

  const parseSpecialties = (s: string | null): string[] => {
    if (!s) return []
    try { return JSON.parse(s) } catch { return [] }
  }

  return (
    <div className="glass-card rounded-3xl shadow-sm border border-sage-100 overflow-hidden">
      {dialog}
      {toast}
      {applications.map((app, i) => (
        <div key={app.id} className={`${i < applications.length - 1 ? "border-b border-sage-100/50" : ""}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between p-5 hover:bg-sage-50/50 transition-colors gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 font-display border-2 border-white shadow-md overflow-hidden relative group">
                {app.user.image ? (
                  <img src={app.user.image} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <UserIcon size={24} className="opacity-50" />
                )}
              </div>
              <div>
                <p className="font-bold text-sage-900 text-base">
                  {app.firstName && app.lastName ? `${app.firstName} ${app.lastName}` : app.user.name}
                </p>
                <div className="flex items-center gap-2 text-sm text-sage-500 mt-0.5">
                  <span className="truncate max-w-[200px]">{app.user.email}</span>
                  {app.country && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-sage-300"></span>
                      <span className="flex items-center gap-1"><MapPin size={12}/> {app.country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <p className="text-xs font-mono text-sage-400 hidden md:block bg-sage-50 px-3 py-1.5 rounded-lg border border-sage-100">
                {new Date(app.submittedAt).toLocaleDateString("tr-TR")}
              </p>
              
              <div className="flex items-center gap-2 ml-auto md:ml-0">
                <button
                  onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                  className="flex items-center gap-1.5 text-sage-600 bg-white hover:bg-sage-50 text-xs font-semibold px-4 py-2 rounded-xl border border-sage-200 transition-all shadow-sm btn-press"
                >
                  {expandedId === app.id ? <><EyeOff size={14}/> Gizle</> : <><Eye size={14}/> İncele</>}
                </button>
                <button
                  onClick={() => handleAction(app, "approve")}
                  disabled={processingId === app.id}
                  className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-600 transition-all shadow-md shadow-green-500/20 disabled:opacity-50 btn-press"
                >
                  <CheckCircle2 size={14}/> {processingId === app.id ? "İşleniyor..." : "Onayla"}
                </button>
                <button
                  onClick={() => handleAction(app, "reject")}
                  disabled={processingId === app.id}
                  className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 btn-press"
                >
                  <XCircle size={14}/> Reddet
                </button>
              </div>
            </div>
          </div>

          {/* Expanded detail panel */}
          {expandedId === app.id && (
            <div className="px-5 pb-5 space-y-4">
              {/* Personal Info */}
              <div className="bg-white rounded-2xl p-6 border border-sage-100 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <FileBadge size={120} />
                </div>
                
                <div className="space-y-6 relative z-10">
                  <div>
                    <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><UserIcon size={12}/> Kişisel Bilgiler</h4>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                      <div>
                        <p className="text-sage-400 text-[11px] uppercase tracking-wide font-medium">Ad Soyad</p>
                        <p className="text-sage-800 font-semibold mt-0.5">{app.firstName} {app.lastName}</p>
                      </div>
                      <div>
                        <p className="text-sage-400 text-[11px] uppercase tracking-wide font-medium">Telefon</p>
                        <p className="text-sage-800 font-semibold mt-0.5 flex items-center gap-1">
                          {app.phone || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sage-400 text-[11px] uppercase tracking-wide font-medium">Ülke</p>
                        <p className="text-sage-800 font-semibold mt-0.5">{app.country || "—"}</p>
                      </div>
                      <div>
                        <p className="text-sage-400 text-[11px] uppercase tracking-wide font-medium">Pasaport / Kimlik</p>
                        <p className="text-sage-800 font-mono mt-0.5">{app.passportId || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-3">Uzmanlıklar</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {parseSpecialties(app.specialties).map(s => (
                        <span key={s} className="bg-sage-100/50 border border-sage-200 text-sage-700 px-3 py-1 rounded-lg text-xs font-semibold tracking-wide">
                          {s}
                        </span>
                      ))}
                      {parseSpecialties(app.specialties).length === 0 && (
                        <span className="text-sage-400 text-xs italic">Uzmanlık belirtilmemiş</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 relative z-10">
                  <div>
                    <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><FileBadge size={12}/> Sertifika</h4>
                    <div className="bg-sage-50 p-4 rounded-xl border border-sage-100/50 flex flex-col gap-3">
                      {app.certificateUrl ? (
                        <a
                          href={app.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white border border-sage-200 text-sage-800 px-4 py-2.5 rounded-xl text-xs font-bold hover:border-sage-400 hover:shadow-sm transition-all inline-flex items-center justify-center gap-2 w-full btn-press"
                        >
                          <FileBadge size={16} className="text-sage-500" /> Orijinal Sertifikayı Görüntüle
                        </a>
                      ) : (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-100 flex items-center gap-2">
                          <XCircle size={14}/> Sertifika yüklenmemiş
                        </div>
                      )}
                      
                      {app.certificateStartDate && (
                        <div className="flex items-center gap-2 text-xs text-sage-600 bg-white p-2.5 rounded-lg border border-sage-100">
                          <Calendar size={14} className="text-sage-400" />
                          <span>Sertifika tarihi: <strong className="text-sage-800">{new Date(app.certificateStartDate).toLocaleDateString("tr-TR")}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Experience */}
              {app.experience && (
                <div className="bg-white rounded-2xl p-6 border border-sage-100 shadow-inner">
                  <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-3">Deneyim ve Geçmiş</h4>
                  <p className="text-sage-700 text-sm whitespace-pre-wrap leading-relaxed bg-sage-50 p-4 rounded-xl border border-sage-100/50">{app.experience}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
