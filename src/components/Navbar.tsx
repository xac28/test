'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, LogOut, LayoutDashboard, Radio, Settings, Shield, ChevronDown, Sparkles, PersonStanding, Compass, HelpCircle, Info, GraduationCap } from 'lucide-react';
import { useI18n } from '@/i18n';
import { NotificationBell } from '@/components/notification-bell';
import { Portrait } from '@/components/person-avatar';

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
  const [exploreOpen, setExploreOpen] = useState(false);
  const exploreRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => { setMobileOpen(false); setExploreOpen(false); }, [pathname]);

  useEffect(() => {
    if (!exploreOpen) return;
    const close = (e: MouseEvent) => { if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) setExploreOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setExploreOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [exploreOpen]);

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
    { href: '/community', label: locale === 'tr' ? 'Topluluk' : 'Community' },
    { href: '/pricing', label: t.nav.plans },
  ];

  const exploreLinks = [
    { href: '/yoga-stilleri', icon: Sparkles, label: locale === 'tr' ? 'Yoga stilleri' : 'Yoga styles', hint: locale === 'tr' ? 'Hatha, Vinyasa, Yin…' : 'Hatha, Vinyasa, Yin…' },
    { href: '/pozlar', icon: PersonStanding, label: locale === 'tr' ? 'Poz kütüphanesi' : 'Pose library', hint: locale === 'tr' ? '3B döndürülebilir pozlar' : 'Rotatable 3D poses' },
    { href: '/nasil-calisir', icon: Compass, label: locale === 'tr' ? 'Nasıl çalışır?' : 'How it works', hint: locale === 'tr' ? 'İlk derse dört adım' : 'Four steps to your first class' },
    { href: '/sss', icon: HelpCircle, label: locale === 'tr' ? 'Sık sorulan sorular' : 'FAQ', hint: locale === 'tr' ? 'Merak edilenler' : 'Common questions' },
    { href: '/ogretmenler-icin', icon: GraduationCap, label: locale === 'tr' ? 'Eğitmenler için' : 'For teachers', hint: locale === 'tr' ? 'AYA\'da ders ver' : 'Teach on AYA' },
    { href: '/hakkimizda', icon: Info, label: locale === 'tr' ? 'Hakkımızda' : 'About', hint: locale === 'tr' ? 'Değerlerimiz' : 'Our values' },
  ];
  const exploreActive = exploreLinks.some((l) => pathname === l.href || pathname.startsWith(l.href + '/'));

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-50 bg-cream border-b border-rule">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between gap-8">
        <Link href="/" aria-label="AYA ana sayfa" className="tap-area text-ink text-[1.65rem] leading-none">
          <Wordmark />
        </Link>

        <nav aria-label="Ana menü" className="hidden lg:flex items-center gap-6 xl:gap-8 flex-1">
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
          <div className="relative" ref={exploreRef}>
            <button
              onClick={() => setExploreOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={exploreOpen}
              data-testid="explore-button"
              className={`inline-flex items-center gap-1 text-[0.9rem] font-medium py-1 transition-colors ${exploreActive || exploreOpen ? 'text-ink' : 'text-sage-600 hover:text-ink'}`}
            >
              {locale === 'tr' ? 'Keşfet' : 'Explore'} <ChevronDown size={15} className={`transition-transform ${exploreOpen ? 'rotate-180' : ''}`} />
            </button>
            {exploreOpen && (
              <div role="menu" data-testid="explore-menu" className="absolute left-1/2 -translate-x-1/2 mt-3 w-[22rem] bg-paper border border-rule rounded-2xl shadow-xl p-2 z-50">
                {exploreLinks.map((l) => (
                  <Link key={l.href} href={l.href} role="menuitem" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-clay-50 group">
                    <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-clay-100 group-hover:text-clay-600 transition-colors"><l.icon size={18} /></span>
                    <span><span className="block text-sm font-semibold text-ink">{l.label}</span><span className="block text-xs text-sage-500">{l.hint}</span></span>
                  </Link>
                ))}
              </div>
            )}
          </div>
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
            <div className="flex items-center gap-1">
            <NotificationBell />
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                data-testid="profile-menu-button"
                className="flex items-center gap-2.5 py-1 pl-1 pr-3 border border-rule hover:border-ink rounded-full transition-colors"
              >
                <Portrait src={session.user.image} name={session.user.name} seed={session.user.id} size={28} />
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
            className="lg:hidden p-2.5 -mr-2.5 text-ink"
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
            <p className="eyebrow pt-5 pb-1">{locale === 'tr' ? 'Keşfet' : 'Explore'}</p>
            {exploreLinks.map((l) => (
              <Link key={l.href} href={l.href} className="py-3 border-b border-rule flex items-center gap-3 text-sage-800">
                <l.icon size={17} className="text-clay-500" /> {l.label}
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
