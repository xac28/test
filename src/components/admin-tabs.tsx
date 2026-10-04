"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AdminApplicationsTable } from "./admin-applications"
import { AdminPayouts } from "./admin-payouts"
import { 
  Users, 
  FileText, 
  Video, 
  ShieldAlert, 
  DollarSign, 
  AlertTriangle,
  PlaySquare,
  BadgeCheck,
  Ban,
  Activity,
  History,
  TrendingUp,
  Search,
  Filter,
  Calendar,
  Wallet
} from "lucide-react"

export function AdminTabs({ 
  pendingApplications, 
  recentActions, 
  users, 
  activeRooms,
  activeBookings,
  financials,
  reports,
  logs,
  trialTeachers,
  pendingPayoutCount
}: any) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Set initial tab from URL if present
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "overview")
  const [userQuery, setUserQuery] = useState("")

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', activeTab)
    window.history.pushState(null, '', `?${params.toString()}`)
  }, [activeTab, searchParams])

  const handleBanUser = async (id: string) => {
    if (!confirm("Bu kullanıcıyı yasaklamak istediğinize emin misiniz? Hesabı kilitlenir ve IP adresleri engellenir.")) return
    
    try {
      const res = await fetch(`/api/admin/users/${id}/ban`, { 
        method: "POST",
        body: JSON.stringify({ reason: "Admin UI action" }),
        headers: { "Content-Type": "application/json" }
      })
      if (res.ok) {
        alert("Kullanıcı yasaklandı")
        router.refresh()
      } else {
        alert("Kullanıcı yasaklanamadı")
      }
    } catch {
      alert("Ağ hatası")
    }
  }

  const handleUnbanUser = async (id: string) => {
    if (!confirm("Bu kullanıcının yasağını kaldırmak istediğinize emin misiniz?")) return
    
    try {
      const res = await fetch(`/api/admin/users/${id}/ban`, { method: "DELETE" })
      if (res.ok) {
        alert("Yasak kaldırıldı")
        router.refresh()
      } else {
        alert("Yasak kaldırılamadı")
      }
    } catch {
      alert("Ağ hatası")
    }
  }

  const handleCloseRoom = async (id: string) => {
    if (!confirm("Bu canlı odayı zorla kapatmak istediğinize emin misiniz?")) return
    
    try {
      const res = await fetch(`/api/admin/live-rooms/${id}/close`, { method: "POST" })
      if (res.ok) {
        alert("Oda kapatıldı")
        router.refresh()
      } else {
        alert("Oda kapatılamadı")
      }
    } catch {
      alert("Ağ hatası")
    }
  }

  const handleApproveTrial = async (teacherId: string) => {
    if (!confirm("Bu öğretmenin deneme oturumunu onaylayıp profilini herkese açmak istiyor musunuz?")) return
    
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}/approve-trial`, { method: "POST" })
      if (res.ok) {
        alert("Öğretmen onaylandı!")
        router.refresh()
      } else {
        alert("Onay işlemi başarısız oldu.")
      }
    } catch {
      alert("Ağ hatası.")
    }
  }

  const tabs = [
    { id: "overview", label: "Genel Bakış", icon: Activity },
    { id: "applications", label: "Başvurular", icon: FileText, badge: pendingApplications?.length },
    { id: "trials", label: "Deneme Odaları", icon: PlaySquare, badge: trialTeachers?.length, badgeColor: "bg-amber-500" },
    { id: "financials", label: "Finans", icon: DollarSign },
    { id: "payouts", label: "Ödeme Talepleri", icon: Wallet, badge: pendingPayoutCount, badgeColor: "bg-orange-500" },
    { id: "rooms", label: "Canlı Oturumlar", icon: Video, badge: (activeRooms?.length || 0) + (activeBookings?.length || 0) },
    { id: "users", label: "Kullanıcılar", icon: Users },
    { id: "reports", label: "Raporlar ve Güvenlik", icon: ShieldAlert, badge: reports?.filter((r:any) => r.status === 'PENDING').length, badgeColor: "bg-red-500" },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Modern Horizontal Navigation */}
      <div className="glass-card p-2 rounded-2xl border border-sage-200/60 shadow-sm flex overflow-x-auto hide-scrollbar gap-1 relative z-10">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 whitespace-nowrap outline-none
                ${isActive 
                  ? "bg-sage-800 text-white shadow-md shadow-sage-800/20 transform scale-[1.02]" 
                  : "text-sage-600 hover:text-sage-900 hover:bg-sage-100/50"
                }
              `}
            >
              <Icon size={18} className={isActive ? "text-sage-200" : "text-sage-400"} />
              {tab.label}
              {tab.badge > 0 && (
                <span className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full ${isActive ? 'bg-white/20 text-white' : (tab.badgeColor || 'bg-sage-200 text-sage-800')}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content Wrapper */}
      <div className="bg-transparent rounded-3xl min-h-[500px]">
        
        {/* OVERVIEW TAB (Now a dedicated section inside tabs if we want to move stats here, but stats are in page.tsx. We'll leave it simple or empty here since page.tsx shows stats above) */}
        {activeTab === "overview" && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
            <div className="w-24 h-24 bg-sage-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <TrendingUp size={40} className="text-sage-400" />
            </div>
            <h3 className="text-2xl font-display text-sage-800 mb-2">AYA Yönetim Merkezine Hoş Geldiniz</h3>
            <p className="text-sage-500 max-w-md">Başvuruları yönetmek, canlı odaları izlemek, ödeme taleplerini onaylamak veya platform güvenliğini incelemek için yukarıdan bir sekme seçin.</p>
          </div>
        )}

        {/* APPLICATIONS TAB */}
        {activeTab === "applications" && (
          <div className="space-y-8 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3">
                  <FileText className="text-sage-500" /> Bekleyen Başvurular
                </h2>
                <p className="text-sm text-sage-500 mt-1">Yeni öğretmen başvurularını inceleyin ve onaylayın.</p>
              </div>
            </div>

            {pendingApplications.length === 0 ? (
              <div className="glass-card p-12 rounded-3xl border border-dashed border-sage-300 text-center bg-sage-50/30">
                <BadgeCheck size={48} className="mx-auto text-sage-300 mb-4" />
                <h3 className="text-lg font-medium text-sage-800 mb-1">Hepsi tamam!</h3>
                <p className="text-sage-500">Şu anda bekleyen başvuru yok.</p>
              </div>
            ) : (
              <div className="glass-card rounded-3xl border border-sage-200/60 shadow-sm overflow-hidden">
                <AdminApplicationsTable applications={pendingApplications} />
              </div>
            )}

            {recentActions.length > 0 && (
              <section className="pt-8">
                <h3 className="text-xl font-display text-sage-800 mb-4 flex items-center gap-2">
                  <History size={20} className="text-sage-400" /> Son Kararlar
                </h3>
                <div className="glass-card rounded-2xl border border-sage-200/60 overflow-hidden shadow-sm">
                  <div className="grid grid-cols-1 divide-y divide-sage-100/50">
                    {recentActions.map((app: any) => (
                      <div key={app.id} className="flex items-center justify-between p-4 hover:bg-sage-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <img src={app.user.image || `https://i.pravatar.cc/150?u=${app.user.id}`} className="w-10 h-10 rounded-full border border-sage-200 object-cover shadow-sm" alt="" />
                          <div>
                            <p className="font-medium text-sage-900 text-sm">{app.user.name}</p>
                            <p className="text-xs text-sage-500">{app.user.email}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                          app.status === "APPROVED" 
                            ? "bg-green-100/80 text-green-700 border border-green-200" 
                            : "bg-red-100/80 text-red-700 border border-red-200"
                        }`}>
                          {app.status === "APPROVED" ? "ONAYLANDI" : "REDDEDİLDİ"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* TRIAL TEACHERS TAB */}
        {activeTab === "trials" && (
          <div className="space-y-6 animate-fade-up">
            <div>
              <h2 className="text-2xl font-display text-amber-900 flex items-center gap-3">
                <PlaySquare className="text-amber-500" /> Bekleyen Deneme Oturumları
              </h2>
              <p className="text-sm text-amber-700/70 mt-1">Canlı değerlendirme bekleyen deneme modundaki öğretmenler.</p>
            </div>

            <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 p-4 rounded-2xl flex gap-3 text-sm text-amber-800 shadow-sm">
              <AlertTriangle className="flex-shrink-0 text-amber-600 mt-0.5" size={18} />
              <p>Bu öğretmenler evrak olarak onaylandı ancak ders yayınlamadan önce 5 dakikalık canlı bir deneme oturumu tamamlamalıdır. Değerlendirmek için odalarına katılın.</p>
            </div>

            {trialTeachers?.length === 0 ? (
              <div className="glass-card p-12 rounded-3xl border border-dashed border-sage-300 text-center">
                <PlaySquare size={48} className="mx-auto text-sage-300 mb-4 opacity-50" />
                <p className="text-sage-600 text-lg font-medium">Bekleyen deneme oturumu yok.</p>
              </div>
            ) : (
              <div className="glass-card rounded-3xl shadow-sm border border-sage-200/60 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-sage-50/80 border-b border-sage-200/60 text-xs uppercase tracking-wider text-sage-500 font-semibold">
                    <tr>
                      <th className="px-6 py-4">Öğretmen</th>
                      <th className="px-6 py-4">Uzmanlıklar</th>
                      <th className="px-6 py-4">Kayıt Tarihi</th>
                      <th className="px-6 py-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-100/50">
                    {trialTeachers.map((teacher: any) => (
                      <tr key={teacher.id} className="hover:bg-sage-50/30 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <img src={teacher.user.image || `https://i.pravatar.cc/150?u=${teacher.userId}`} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-sage-100" />
                          <div>
                            <p className="text-sm font-semibold text-sage-900">{teacher.user.name}</p>
                            <p className="text-xs text-sage-500">{teacher.user.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-sage-600 max-w-xs truncate">
                          {teacher.specialties || "Genel Yoga"}
                        </td>
                        <td className="px-6 py-4 text-xs text-sage-500 font-medium">{new Date(teacher.user.createdAt).toLocaleDateString("tr-TR")}</td>
                        <td className="px-6 py-4 flex items-center justify-end gap-2">
                          <a 
                            href={`/room/trial-${teacher.id}`} 
                            target="_blank"
                            className="px-4 py-2 bg-sage-100 hover:bg-sage-200 text-sage-800 text-sm font-medium rounded-xl transition-all btn-press shadow-sm flex items-center gap-2"
                          >
                            <Video size={14} /> Odaya Katıl
                          </a>
                          <button 
                            onClick={() => handleApproveTrial(teacher.id)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-all btn-press shadow-md shadow-amber-500/20 flex items-center gap-2"
                          >
                            <BadgeCheck size={14} /> Onayla
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* FINANCIALS TAB */}
        {activeTab === "financials" && (
          <div className="space-y-6 animate-fade-up">
            <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3 mb-6">
              <DollarSign className="text-green-600" /> Platform Finansı
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-3xl border border-sage-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                  <Activity size={80} />
                </div>
                <p className="text-xs text-sage-500 font-bold mb-1 uppercase tracking-wider">Toplam Hacim</p>
                <p className="text-4xl font-display text-sage-900">${financials.totalVolume.toFixed(2)}</p>
                <p className="text-xs text-sage-400 mt-2 flex items-center gap-1"><TrendingUp size={12}/> Toplam brüt ciro</p>
              </div>
              <div className="glass-card bg-gradient-to-br from-green-50 to-emerald-50/50 p-6 rounded-3xl border border-green-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-green-700 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                  <DollarSign size={80} />
                </div>
                <p className="text-xs text-green-700 font-bold mb-1 uppercase tracking-wider">Platform Geliri</p>
                <p className="text-4xl font-display text-green-900">${financials.platformRevenue.toFixed(2)}</p>
                <p className="text-xs text-green-600/70 mt-2 flex items-center gap-1"><BadgeCheck size={12}/> Kazanılan komisyon</p>
              </div>
              <div className="glass-card bg-gradient-to-br from-orange-50 to-amber-50/50 p-6 rounded-3xl border border-orange-200/60 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 text-orange-700 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                  <AlertTriangle size={80} />
                </div>
                <p className="text-xs text-orange-700 font-bold mb-1 uppercase tracking-wider">Bekleyen Hakedişler</p>
                <p className="text-4xl font-display text-orange-900">${financials.pendingPayouts.toFixed(2)}</p>
                <p className="text-xs text-orange-600/80 mt-2 font-medium">Manuel transfer gerekir</p>
              </div>
            </div>
          </div>
        )}

        {/* PAYOUT REQUESTS TAB */}
        {activeTab === "payouts" && (
          <div className="animate-fade-up">
            <AdminPayouts onChange={() => router.refresh()} />
          </div>
        )}

        {/* ROOMS TAB */}
        {activeTab === "rooms" && (
          <div className="space-y-8 animate-fade-up">
            <div>
              <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3">
                <Video className="text-indigo-500" /> Canlı Platform Etkinliği
              </h2>
              <p className="text-sm text-sage-500 mt-1">Platformdaki tüm aktif oturumları izleyin.</p>
            </div>

            {/* Scheduled Sessions (Bookings) */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-sage-400 flex items-center gap-2">
                <Calendar size={14} /> Planlı Dersler
              </h3>
              {activeBookings?.length === 0 ? (
                <div className="glass-card p-8 rounded-2xl border border-dashed border-sage-200 text-center">
                  <p className="text-xs text-sage-400">Şu anda canlı planlı ders yok.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeBookings.map((booking: any) => (
                    <div key={booking.id} className="glass-card p-5 rounded-2xl border border-sage-200/60 shadow-sm flex flex-col justify-between bg-white">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center border border-sage-200 overflow-hidden">
                             {booking.teacher.user.image ? <img src={booking.teacher.user.image} className="w-full h-full object-cover" /> : <span>{booking.teacher.user.name[0]}</span>}
                           </div>
                           <div>
                              <p className="text-sm font-bold text-sage-900">{booking.teacher.user.name} ↔ {booking.student.name}</p>
                              <p className="text-[10px] text-sage-500 font-medium">Oda: {booking.dailyRoomName || "Yok"}</p>
                           </div>
                        </div>
                        <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest border border-green-200/50 uppercase">
                          <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> Rezerve
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-sage-100">
                        <a 
                          href={`/room?bookingId=${booking.id}`} 
                          target="_blank" 
                          className="flex-1 text-center py-2 bg-sage-800 hover:bg-sage-900 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-colors"
                        >
                          İzle
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Instant Rooms */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-sage-400 flex items-center gap-2">
                <PlaySquare size={14} /> Anlık Canlı Odalar
              </h3>
              {activeRooms.length === 0 ? (
                <div className="glass-card p-8 rounded-2xl border border-dashed border-sage-200 text-center">
                  <p className="text-xs text-sage-400">Aktif anlık oda yok.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeRooms.map((room: any) => (
                    <div key={room.id} className="glass-card p-5 rounded-2xl border border-sage-200/60 shadow-sm flex flex-col justify-between bg-indigo-50/30">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <p className="font-bold text-sage-900 text-sm uppercase tracking-wide">{room.roomName}</p>
                          </div>
                          <p className="text-[10px] text-sage-500 font-medium">Öğretmen No: {room.teacherId.substring(0,8)}...</p>
                        </div>
                        <span className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest border border-red-200/50 uppercase">
                          Anlık
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-sage-100">
                        <a href={`/dashboard/room/${room.roomName}`} target="_blank" className="flex-1 text-center py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-colors">
                          İzle
                        </a>
                        <button onClick={() => handleCloseRoom(room.id)} className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-colors">
                          Kapat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3">
                <Users className="text-sage-600" /> Kullanıcı Yönetimi
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sage-400" size={16} />
                <input type="text" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} data-testid="admin-user-search" placeholder="Kullanıcı ara..." className="pl-9 pr-4 py-2 bg-white border border-sage-200 rounded-full text-sm focus:outline-none focus:border-sage-400 focus:ring-1 focus:ring-sage-400 transition-all w-64" />
              </div>
            </div>

            <div className="glass-card rounded-3xl shadow-sm border border-sage-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-sage-50/80 border-b border-sage-200/60 text-xs uppercase tracking-wider text-sage-500 font-semibold">
                    <tr>
                      <th className="px-6 py-4">Kullanıcı</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Durum</th>
                      <th className="px-6 py-4">Katılım</th>
                      <th className="px-6 py-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-100/50">
                    {users.filter((u: any) => !userQuery.trim() || `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(userQuery.trim().toLowerCase())).map((user: any) => (
                      <tr key={user.id} className="hover:bg-sage-50/30 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="relative">
                            <img src={user.image || `https://i.pravatar.cc/150?u=${user.id}`} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-sage-100" />
                            {user.banned && <div className="absolute -bottom-1 -right-1 bg-red-500 text-white p-0.5 rounded-full"><Ban size={10} /></div>}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${user.banned ? 'text-red-900 line-through opacity-70' : 'text-sage-900'}`}>{user.name}</p>
                            <p className="text-xs text-sage-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                            user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 
                            user.role === 'TEACHER' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 
                            'bg-sage-100 text-sage-700 border border-sage-200'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                           {user.banned ? (
                             <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                               <Ban size={12}/> Yasaklı
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                               <BadgeCheck size={12}/> Aktif
                             </span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-xs text-sage-500 font-medium">{new Date(user.createdAt).toLocaleDateString("tr-TR")}</td>
                        <td className="px-6 py-4 text-right">
                          {user.role !== 'ADMIN' && (
                            user.banned ? (
                              <button onClick={() => handleUnbanUser(user.id)} className="px-3 py-1.5 bg-sage-100 hover:bg-sage-200 text-sage-700 text-xs font-bold rounded-lg transition-colors btn-press">
                                Yasağı Kaldır
                              </button>
                            ) : (
                              <button onClick={() => handleBanUser(user.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors btn-press">
                                Kullanıcıyı ve IP'yi Yasakla
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS & SECURITY TAB */}
        {activeTab === "reports" && (
          <div className="space-y-8 animate-fade-up">
            <section>
              <h2 className="text-2xl font-display text-red-900 flex items-center gap-3 mb-6">
                <ShieldAlert className="text-red-600" /> Platform Raporları
              </h2>
              {reports?.length === 0 ? (
                <div className="glass-card p-8 rounded-3xl border border-dashed border-sage-300 text-center">
                  <p className="text-sage-500 font-medium">Bekleyen kullanıcı raporu yok.</p>
                </div>
              ) : (
                <div className="glass-card rounded-3xl shadow-sm border border-sage-200/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-sage-50/80 border-b border-sage-200/60 text-xs uppercase tracking-wider text-sage-500 font-semibold">
                        <tr>
                          <th className="px-6 py-4">Raporlayan</th>
                          <th className="px-6 py-4">Hedef</th>
                          <th className="px-6 py-4">Sebep</th>
                          <th className="px-6 py-4">Tarih</th>
                          <th className="px-6 py-4">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sage-100/50">
                        {reports?.map((report: any) => (
                          <tr key={report.id} className="hover:bg-red-50/30 transition-colors">
                            <td className="px-6 py-4 text-sm font-semibold text-sage-900">{report.reporter?.name || "Bilinmiyor"}</td>
                            <td className="px-6 py-4 text-xs font-mono text-sage-600">{report.bookingId || "Platform"}</td>
                            <td className="px-6 py-4 text-sm text-sage-700 max-w-xs truncate" title={report.reason}>{report.reason}</td>
                            <td className="px-6 py-4 text-xs text-sage-500 font-medium">{new Date(report.createdAt).toLocaleString("tr-TR")}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                                report.status === 'PENDING' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-green-100 text-green-700 border border-green-200'
                              }`}>
                                {report.status === "PENDING" ? "BEKLİYOR" : report.status === "REVIEWED" ? "İNCELENDİ" : "ÇÖZÜLDÜ"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3 mb-6">
                <History className="text-sage-600" /> Sistem Denetim Kayıtları
              </h2>
              {logs?.length === 0 ? (
                <div className="glass-card p-8 rounded-3xl border border-dashed border-sage-300 text-center">
                  <p className="text-sage-500 font-medium">Denetim kaydı bulunamadı.</p>
                </div>
              ) : (
                <div className="glass-card rounded-3xl shadow-sm border border-sage-200/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-sage-50/80 border-b border-sage-200/60 text-xs uppercase tracking-wider text-sage-500 font-semibold">
                        <tr>
                          <th className="px-6 py-4">Yönetici</th>
                          <th className="px-6 py-4">İşlem</th>
                          <th className="px-6 py-4">Ayrıntı</th>
                          <th className="px-6 py-4">Zaman</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sage-100/50">
                        {logs?.map((log: any) => (
                          <tr key={log.id} className="hover:bg-sage-50/40 transition-colors">
                            <td className="px-6 py-4 text-sm font-semibold text-sage-900">{log.actor?.name || "Sistem"}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-sage-100 text-sage-800 border border-sage-200">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-sage-600 max-w-sm truncate">{log.reason || log.targetId || "-"}</td>
                            <td className="px-6 py-4 text-xs text-sage-500 font-mono tracking-tight">{new Date(log.createdAt).toLocaleString("tr-TR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

      </div>
    </div>
  )
}
