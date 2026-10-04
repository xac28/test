'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, LogOut, User, LayoutDashboard, Search, MessageSquare, Compass, BookOpen, GraduationCap } from 'lucide-react';

export default function Navbar() {
  const { t, locale, setLocale } = useI18n();
  const { data: session, status } = useSession();
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN';

  const navLinks = [
    { href: '/teachers', label: t.nav.findTeacher, icon: Search },
    { href: '/messages', label: locale === 'en' ? 'Messages' : 'Mesajlar', icon: MessageSquare },
    { href: '/pricing', label: locale === 'en' ? 'Plans' : 'Paketler', icon: Compass },
    { href: '/become-teacher', label: t.nav.becomeTeacher, icon: GraduationCap },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-xl border-b border-sage-100/80 shadow-sm shadow-sage-100/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <svg viewBox="0 0 32 32" className="w-7 h-7 text-sage-600 group-hover:text-sage-700 transition-colors" fill="currentColor">
            <path d="M16 4c-1 4-4 6-7 7 3 1 6 3 7 7 1-4 4-6 7-7-3-1-6-3-7-7z" opacity="0.7" />
            <path d="M16 13c-.5 2-2 3-3.5 3.5 1.5.5 3 1.5 3.5 3.5.5-2 2-3 3.5-3.5-1.5-.5-3-1.5-3.5-3.5z" />
          </svg>
          <span className="font-display text-2xl italic text-ink">AYA</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className="group relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-sage-600 hover:text-sage-900 transition-all hover:bg-sage-50/80">
                <Icon size={16} className="text-sage-400 group-hover:text-sage-600 transition-colors" />
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sage-200 hover:border-sage-400 transition-all text-sm hover:shadow-sm"
            >
              <span>{locale === 'en' ? '🇬🇧' : '🇹🇷'}</span>
              <span className="font-medium uppercase text-xs">{locale}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-cream border border-sage-200 rounded-xl shadow-lg overflow-hidden animate-slide-down z-50">
                <button
                  onClick={() => { setLocale('en'); setLangOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-sage-50 flex items-center gap-2"
                >
                  🇬🇧 English
                </button>
                <button
                  onClick={() => { setLocale('tr'); setLangOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-sage-50 flex items-center gap-2"
                >
                  🇹🇷 Türkçe
                </button>
              </div>
            )}
          </div>

          {/* Auth Section */}
          {status === 'loading' ? (
            <div className="w-20 h-9 skeleton-pulse rounded-full" />
          ) : session?.user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-sage-200 hover:border-sage-400 transition-all hover:shadow-sm"
              >
                <img
                  src={session.user.image || `https://i.pravatar.cc/150?u=${session.user.id}`}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span className="text-xs font-medium text-ink/80 hidden sm:inline max-w-[100px] truncate">{session.user.name}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-sage-200 rounded-2xl shadow-xl overflow-hidden animate-slide-down z-50">
                  <div className="px-4 py-3 border-b border-sage-100 bg-sage-50/50">
                    <p className="text-sm font-semibold text-ink truncate">{session.user.name}</p>
                    <p className="text-xs text-sage-500 truncate">{session.user.email}</p>
                  </div>
                  <Link href="/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-sage-50 transition">
                    <LayoutDashboard size={16} className="text-sage-500" /> Dashboard
                  </Link>
                  <Link href="/dashboard/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-sage-50 transition">
                    <User size={16} className="text-sage-500" /> Profil
                  </Link>
                  {isTeacher && (
                    <Link href="/teach" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-sage-50 transition">
                      🧘 Eğitmen Paneli
                    </Link>
                  )}
                  {session.user.role === 'ADMIN' && (
                    <Link href="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-sage-50 transition">
                      ⚙️ Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition border-t border-sage-100"
                  >
                    <LogOut size={16} /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login" className="text-sm text-ink/70 hover:text-sage-700 px-4 py-2 transition animated-underline">
                {t.nav.signIn}
              </Link>
              <Link href="/login" className="text-sm bg-sage-700 hover:bg-sage-800 text-cream px-5 py-2 rounded-full transition-all btn-magnetic">
                {t.nav.signUp}
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-ink/70 hover:text-sage-700 transition"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-sage-100 animate-slide-down shadow-xl absolute w-full left-0 mt-0">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-sage-700 hover:bg-sage-50 hover:text-sage-900 rounded-xl transition-all"
                >
                  <Icon size={18} className="text-sage-400" />
                  {link.label}
                </Link>
              )
            })}
            {!session && (
              <Link href="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3.5 mt-4 text-sm font-bold text-white bg-sage-900 rounded-xl text-center shadow-md">
                Giriş Yap / Kayıt Ol
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

