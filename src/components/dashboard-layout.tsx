"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"
import { LogOut, Home, Calendar, CreditCard, Settings, Users, FileText, ChevronLeft, ChevronRight, Video, Activity, ShieldAlert } from "lucide-react"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  
  const role = session?.user?.role || "STUDENT"

  const studentLinks = [
    { name: "My Practice", href: "/dashboard", icon: Home },
    { name: "My Profile", href: "/dashboard/profile", icon: Settings },
    { name: "Find Teachers", href: "/teachers", icon: Users },
  ]

  const teacherLinks = [
    { name: "Dashboard", href: "/teach", icon: Home },
    { name: "My Classes", href: "/teach/bookings", icon: Calendar },
    { name: "Availability", href: "/teach/availability", icon: Calendar },
    { name: "Earnings", href: "/teach/earnings", icon: CreditCard },
    { name: "Live Room", href: "/room", icon: Video },
  ]

  const adminLinks = [
    { name: "Overview", href: "/admin?tab=overview", icon: Activity },
    { name: "Applications", href: "/admin?tab=applications", icon: FileText },
    { name: "Live Rooms", href: "/admin?tab=rooms", icon: Video },
    { name: "Users", href: "/admin?tab=users", icon: Users },
    { name: "Security & Logs", href: "/admin?tab=reports", icon: ShieldAlert },
  ]

  let links = studentLinks
  if (pathname.startsWith("/teach")) links = teacherLinks
  if (pathname.startsWith("/admin")) links = adminLinks

  const sidebarContent = (
    <>
      <div className={`p-6 ${collapsed ? "px-4" : "p-8"} border-b border-sage-800/50 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div>
            <Link href="/" className="font-display text-2xl tracking-widest text-sage-100 hover:text-white transition-colors btn-press inline-block">
              NAMASTE
            </Link>
            <p className="text-sage-500 text-xs font-medium tracking-widest uppercase mt-1">
              {pathname.startsWith("/admin") ? "Admin Panel" : pathname.startsWith("/teach") ? "Teacher Portal" : "Student Hub"}
            </p>
          </div>
        )}
        {collapsed && (
          <Link href="/" className="font-display text-xl tracking-widest text-sage-100 hover:text-white transition-colors btn-press">
            N
          </Link>
        )}
      </div>
      
      <nav className={`flex-1 py-6 ${collapsed ? "px-2" : "px-4"} space-y-1.5 overflow-y-auto`}>
        {links.map((link) => {
          const Icon = link.icon
          let isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/dashboard' && link.href !== '/teach' && link.href !== '/admin')
          
          if (pathname === '/admin' && link.href.includes('?tab=')) {
            const currentTab = searchParams.get('tab') || 'overview'
            isActive = link.href.includes(`tab=${currentTab}`)
          }
          
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? link.name : undefined}
              className={`flex items-center gap-3 ${collapsed ? "justify-center px-3" : "px-4"} py-3 rounded-xl transition-all btn-press ${
                isActive 
                  ? "bg-sage-700/60 text-white shadow-inner" 
                  : "hover:bg-sage-800/40 text-sage-400 hover:text-sage-200"
              }`}
            >
              <Icon size={20} className={`flex-shrink-0 ${isActive ? "text-sage-200" : "text-sage-500"}`} />
              {!collapsed && <span className="font-medium text-sm truncate">{link.name}</span>}
            </Link>
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
          title={collapsed ? "Logout" : undefined}
          className={`flex items-center gap-3 ${collapsed ? "justify-center px-3" : "px-4"} py-3 rounded-xl w-full text-sage-400 hover:bg-red-500/10 hover:text-red-400 transition-all btn-press`}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span className="font-medium text-sm">Logout</span>}
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
        <header className="h-16 glass-card border-b border-sage-100/50 flex items-center justify-between px-6 md:hidden sticky top-0 z-10 shadow-sm">
          <button onClick={() => setMobileOpen(true)} className="text-sage-700 p-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </button>
          <Link href="/" className="font-display text-xl tracking-widest text-sage-900 btn-press">
            NAMASTE
          </Link>
          <div className="w-8" />
        </header>
        
        <div className="flex-1 p-6 md:p-10 overflow-y-auto texture-overlay relative">
          <div className="max-w-6xl mx-auto w-full relative z-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
