"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"
import { WarningBanner } from "./warning-banner"
import { VerifyEmailBanner } from "./verify-email-banner"
import { NotificationBell } from "./notification-bell"
import { ADMIN_TABS, BADGE_TONE, useAdminBadges } from "./admin/tab-defs"
import { LogOut, Bell, LifeBuoy, Flag, Home, Calendar, CreditCard, Settings, Users, FileText, ChevronLeft, ChevronRight, Video, Activity, ShieldAlert, Download } from "lucide-react"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  
  const role = session?.user?.role || "STUDENT"

  const studentLinks = [
    { name: "Pratiğim", href: "/dashboard", icon: Home },
    { name: "Profilim", href: "/dashboard/profile", icon: Settings },
    { name: "Eğitmen Bul", href: "/teachers", icon: Users },
    { name: "Bildirimler", href: "/dashboard/notifications", icon: Bell },
    { name: "Raporlarım", href: "/dashboard/reports", icon: Flag },
    { name: "Canlı Destek", href: "/dashboard/support", icon: LifeBuoy },
  ]

  const teacherLinks = [
    { name: "Panel", href: "/teach", icon: Home },
    { name: "Derslerim", href: "/teach/bookings", icon: Calendar },
    { name: "Müsaitlik", href: "/teach/availability", icon: Calendar },
    { name: "Atölyelerim", href: "/teach/workshops", icon: Users },
    { name: "Canlı Yayın", href: "/live/studio", icon: Video },
    { name: "Yayın Uygulaması", href: "/teach/uygulama", icon: Download },
    { name: "Kazançlar", href: "/teach/earnings", icon: CreditCard },
    { name: "Bildirimler", href: "/dashboard/notifications", icon: Bell },
    { name: "Raporlarım", href: "/dashboard/reports", icon: Flag },
    { name: "Canlı Destek", href: "/dashboard/support", icon: LifeBuoy },
    { name: "Hesap ve veriler", href: "/dashboard/profile", icon: Settings },
  ]

  const adminMode = pathname.startsWith("/admin")
  const badges = useAdminBadges(adminMode)
  const adminLinks = ADMIN_TABS.map((t) => {
    const b = badges && t.badge?.(badges)
    return { name: t.label, href: `/admin?tab=${t.id}`, icon: t.icon, group: t.group, badge: b || null }
  })

  let links = studentLinks
  if (pathname.startsWith("/teach")) links = teacherLinks
  if (pathname.startsWith("/admin")) links = adminLinks

  const sidebarContent = (
    <>
      <div className={`p-6 ${collapsed ? "px-4" : "p-8"} border-b border-sage-800/50 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div>
            <Link href="/" className="font-display text-2xl tracking-widest text-sage-100 hover:text-white transition-colors btn-press inline-block">
              AYA
            </Link>
            <p className="text-sage-500 text-xs font-medium tracking-widest uppercase mt-1">
              {pathname.startsWith("/admin") ? "Yönetim Paneli" : pathname.startsWith("/teach") ? "Eğitmen Paneli" : "Öğrenci Paneli"}
            </p>
          </div>
        )}
        {collapsed && (
          <Link href="/" className="font-display text-xl tracking-widest text-sage-100 hover:text-white transition-colors btn-press">
            A
          </Link>
        )}
      </div>
      
      <nav className={`flex-1 py-6 ${collapsed ? "px-2" : "px-4"} space-y-1 overflow-y-auto`}>
        {links.map((link: any, idx: number) => {
          const Icon = link.icon
          let isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/dashboard' && link.href !== '/teach' && link.href !== '/admin')

          if (pathname === '/admin' && link.href.includes('?tab=')) {
            const requested = searchParams.get('tab') || 'overview'
            const currentTab = ADMIN_TABS.some((t) => t.id === requested) ? requested : 'overview'
            isActive = link.href === `/admin?tab=${currentTab}`
          }
          const showGroup = adminMode && link.group && (idx === 0 || (links[idx - 1] as any).group !== link.group)

          return (
            <div key={link.href}>
              {showGroup && !collapsed && (
                <p className={`px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-sage-600 ${idx === 0 ? "mb-1" : "mt-5 mb-1"}`}>{link.group}</p>
              )}
              {showGroup && collapsed && idx !== 0 && <div className="my-3 border-t border-sage-800/60" />}
              <Link
                href={link.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? link.name : undefined}
                aria-current={isActive ? "page" : undefined}
                data-testid={link.href.includes("?tab=") ? `nav-${link.href.split("tab=")[1]}` : undefined}
                className={`relative flex items-center gap-3 ${collapsed ? "justify-center px-3" : "px-4"} py-2.5 rounded-xl transition-all btn-press ${
                  isActive
                    ? "bg-sage-700/60 text-white shadow-inner"
                    : "hover:bg-sage-800/40 text-sage-400 hover:text-sage-200"
                }`}
              >
                <Icon size={19} className={`flex-shrink-0 ${isActive ? "text-sage-200" : "text-sage-500"}`} />
                {!collapsed && <span className="font-medium text-sm truncate flex-1">{link.name}</span>}
                {link.badge && (
                  <span className={`${collapsed ? "absolute -top-1 -right-1" : ""} min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${BADGE_TONE[link.badge.tone as keyof typeof BADGE_TONE]}`}>
                    {link.badge.value}
                  </span>
                )}
              </Link>
            </div>
          )
        })}
      </nav>
      
      {/* User Section */}
      <div className={`${collapsed ? "px-2" : "px-4"} py-4 border-t border-sage-800/50`}>
        {!collapsed && session?.user && (
          <div className="px-4 py-3 mb-2 rounded-xl bg-sage-800/30">
            <p className="text-sage-200 text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-sage-500 text-xs truncate">{session.user.email}</p>
          </div>
        )}
        <button 
          onClick={() => signOut({ callbackUrl: '/' })}
          title={collapsed ? "Çıkış" : undefined}
          className={`flex items-center gap-3 ${collapsed ? "justify-center px-3" : "px-4"} py-3 rounded-xl w-full text-sage-400 hover:bg-red-500/10 hover:text-red-400 transition-all btn-press`}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span className="font-medium text-sm">Çıkış Yap</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-cream flex page-enter page-enter-active">
      {/* Desktop Sidebar */}
      <aside className={`${collapsed ? "w-[72px]" : "w-64"} bg-sage-900 text-sage-50 flex-col hidden md:flex border-r border-sage-800 shadow-2xl z-20 transition-all duration-300 relative`}>
        {sidebarContent}
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-24 w-6 h-6 bg-sage-700 border border-sage-600 rounded-full flex items-center justify-center text-sage-300 hover:text-white hover:bg-sage-600 transition-all z-30 shadow-md"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
      
      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-sage-900 text-sage-50 flex flex-col shadow-2xl animate-slide-right z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
      
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile Header */}
        <header className="h-16 md:h-14 glass-card border-b border-sage-100/50 flex items-center justify-between md:justify-end gap-4 px-6 md:px-10 sticky top-0 z-30 shadow-sm">
          <button onClick={() => setMobileOpen(true)} aria-label="Menüyü aç" className="text-sage-700 p-1 md:hidden">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </button>
          <Link href="/" className="font-display text-xl tracking-widest text-sage-900 btn-press md:hidden">
            AYA
          </Link>
          <Link href="/" className="hidden md:inline text-sm text-sage-600 hover:text-ink">Siteye dön</Link>
          <NotificationBell />
        </header>
        
        <div className="flex-1 p-6 md:p-10 overflow-y-auto texture-overlay relative">
          <div className="max-w-6xl mx-auto w-full relative z-10">
            <WarningBanner />
            {!adminMode && <VerifyEmailBanner />}
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
