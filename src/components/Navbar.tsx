'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, LogOut, LayoutDashboard, Radio, Settings, Shield } from 'lucide-react';
import { useI18n } from '@/i18n';

/** AYA wordmark: set in the display serif with wide tracking. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-display font-medium tracking-[0.28em] ${className}`}>AYA</span>;
}

export default function Navbar() {
  const { t, locale, setLocale } = useI18n();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  const role = session?.user?.role;
  const isTeacher = role === 'TEACHER' || role === 'ADMIN';

  // little red dot next to "Canlı Yayın" while someone is on air
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/live/status')
        .then((r) => (r.ok ? r.json() : { live: 0 }))
        .then((d) => alive && setLiveCount(d.live || 0))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [profileOpen]);

  const navLinks = [
    { href: '/atolyeler', label: t.nav.workshops },
    { href: '/live', label: t.nav.live, live: liveCount > 0 },
    { href: '/teachers', label: t.nav.teachers },
    { href: '/icerikler', label: t.nav.articles },
    { href: '/pricing', label: t.nav.plans },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const initial = (session?.user?.name || session?.user?.email || 'A').trim()[0]?.toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-cream border-b border-rule">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between gap-8">
        <Link href="/" aria-label="AYA ana sayfa" className="text-ink text-[1.65rem] leading-none">
          <Wordmark />
        </Link>

        <nav aria-label="Ana menü" className="hidden lg:flex items-center gap-8 flex-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? 'page' : undefined}
              className={`relative text-[0.9rem] font-medium py-1 transition-colors ${
                isActive(l.href) ? 'text-ink' : 'text-sage-600 hover:text-ink'
              } after:absolute after:left-0 after:-bottom-0.5 after:h-px after:bg-ink after:transition-all ${
                isActive(l.href) ? 'after:w-full' : 'after:w-0 hover:after:w-full'
              }`}
            >
              {l.label}
              {l.live && (
                <span title="Şu anda canlı yayın var" className="inline-block ml-1.5 w-1.5 h-1.5 rounded-full bg-accent align-middle animate-pulse" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {/* language */}
          <div className="hidden sm:flex items-center text-xs font-semibold tracking-wider" role="group" aria-label="Dil">
            {(['tr', 'en'] as const).map((l, i) => (
              <span key={l} className="flex items-center">
                {i > 0 && <span className="text-rule mx-1.5">/</span>}
                <button
                  onClick={() => setLocale(l)}
                  aria-pressed={locale === l}
                  className={`uppercase ${locale === l ? 'text-ink' : 'text-sage-500 hover:text-ink'}`}
                >
                  {l}
                </button>
              </span>
            ))}
          </div>

          {status === 'loading' ? (
            <div className="w-24 h-9 shimmer rounded-md" />
          ) : session?.user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                data-testid="profile-menu-button"
                className="flex items-center gap-2.5 py-1 pl-1 pr-3 border border-rule hover:border-ink rounded-full transition-colors"
              >
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-ink text-cream text-xs font-semibold flex items-center justify-center">{initial}</span>
                )}
                <span className="text-xs font-medium hidden sm:inline max-w-[110px] truncate">{session.user.name}</span>
              </button>
              {profileOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-60 bg-paper border border-ink shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-rule">
                    <p className="text-sm font-semibold truncate">{session.user.name}</p>
                    <p className="text-xs text-sage-500 truncate">{session.user.email}</p>
                  </div>
                  <MenuLink href="/dashboard" icon={<LayoutDashboard size={15} />} onClick={() => setProfileOpen(false)}>Panelim</MenuLink>
                  <MenuLink href="/dashboard/profile" icon={<Settings size={15} />} onClick={() => setProfileOpen(false)}>Profil</MenuLink>
                  <MenuLink href="/messages" icon={<span className="w-[15px]" />} onClick={() => setProfileOpen(false)}>{t.nav.messages}</MenuLink>
                  {isTeacher && <MenuLink href="/teach" icon={<Radio size={15} />} onClick={() => setProfileOpen(false)}>Eğitmen paneli</MenuLink>}
                  {role === 'ADMIN' && <MenuLink href="/admin" icon={<Shield size={15} />} onClick={() => setProfileOpen(false)}>Yönetim paneli</MenuLink>}
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-clay-600 hover:bg-clay-50 border-t border-rule"
                  >
                    <LogOut size={15} /> Çıkış yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-5">
              <Link href="/login" className="text-sm font-medium text-sage-700 hover:text-ink">{t.nav.signIn}</Link>
              <Link href="/login?mode=register" className="text-sm font-medium bg-ink text-cream hover:bg-sage-800 px-5 py-2.5 rounded-md transition-colors">
                {t.nav.signUp}
              </Link>
            </div>
          )}

          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={mobileOpen}
            className="lg:hidden p-2 -mr-2 text-ink"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-rule bg-cream absolute w-full left-0 shadow-lg">
          <nav className="max-w-7xl mx-auto px-6 py-4 flex flex-col">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="py-3.5 border-b border-rule text-lg font-display flex items-center gap-2">
                {l.label}
                {l.live && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
              </Link>
            ))}
            <div className="flex items-center justify-between pt-4">
              {!session?.user ? (
                <Link href="/login?mode=register" className="text-sm font-medium bg-ink text-cream px-5 py-2.5 rounded-md">{t.nav.signIn} / {t.nav.signUp}</Link>
              ) : (
                <Link href="/dashboard" className="text-sm font-medium bg-ink text-cream px-5 py-2.5 rounded-md">Panelim</Link>
              )}
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <button onClick={() => setLocale('tr')} className={locale === 'tr' ? 'text-ink' : 'text-sage-500'}>TR</button>
                <span className="text-rule">/</span>
                <button onClick={() => setLocale('en')} className={locale === 'en' ? 'text-ink' : 'text-sage-500'}>EN</button>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} role="menuitem" onClick={onClick} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-sage-100 text-sage-800">
      <span className="text-sage-500">{icon}</span> {children}
    </Link>
  );
}
