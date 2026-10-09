'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, LogOut, LayoutDashboard, Radio, Settings, Shield, ChevronDown, ShoppingBag } from 'lucide-react';
import { CART_EVENT, cartCount } from '@/lib/cart';
import { ARTICLE_CATEGORIES } from '@/lib/articles';
import { useI18n } from '@/i18n';
import { NotificationBell } from '@/components/notification-bell';
import { Portrait } from '@/components/person-avatar';
import { homePathFor } from '@/lib/home-path';

/** AYA wordmark: set in the display serif with wide tracking. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-display font-medium tracking-[0.28em] ${className}`}>AYA</span>;
}

export default function Navbar() {
  const { t, locale, setLocale } = useI18n();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [drawerMax, setDrawerMax] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [cartN, setCartN] = useState(0);
  useEffect(() => {
    const sync = () => setCartN(cartCount());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(CART_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const openMenu = (id: string) => { clearTimeout(closeTimer.current); setOpenId(id); };
  const scheduleClose = () => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpenId(null), 160); };
  // the drawer must end at the bottom of the screen wherever the header currently is (a notice bar can sit above it)
  useEffect(() => {
    if (!mobileOpen) return;
    const measure = () => {
      const b = headerRef.current?.getBoundingClientRect().bottom ?? 68;
      setDrawerMax(Math.max(200, window.innerHeight - b));
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [mobileOpen]);
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

  useEffect(() => { setMobileOpen(false); setOpenId(null); }, [pathname]);

  useEffect(() => {
    if (!openId) return;
    const close = (e: MouseEvent) => { if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [openId]);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [profileOpen]);

  const tr = locale === 'tr';
  interface NavItem { href: string; label: string }
  interface NavGroup { id: string; label: string; href: string; items: NavItem[]; live?: boolean }
  const groups: NavGroup[] = [
    { id: 'shop', label: 'Shop', href: '/shop', items: [
      { href: '/shop/wellness', label: 'Wellness' },
      { href: '/shop/matlar', label: tr ? 'Matlar' : 'Mats' },
      { href: '/shop/aromaterapi', label: tr ? 'Aromaterapi' : 'Aromatherapy' },
    ] },
    { id: 'yoga', label: 'Yoga', href: '/yoga-stilleri', items: [
      { href: '/pozlar', label: tr ? 'Poz Kütüphanesi' : 'Pose Library' },
      { href: '/teachers', label: tr ? 'Eğitmenler' : 'Teachers' },
      { href: '/yoga-stilleri', label: tr ? 'Yoga Stilleri' : 'Yoga Styles' },
    ] },
    { id: 'yazilar', label: tr ? 'Yazılar' : 'Articles', href: '/icerikler', items: ARTICLE_CATEGORIES.map((c) => ({ href: `/icerikler?category=${encodeURIComponent(c)}`, label: c })) },
    { id: 'dersler', label: tr ? 'Dersler' : 'Lessons', href: '/live', live: liveCount > 0, items: [
      { href: '/live', label: tr ? 'Canlı' : 'Live' },
      { href: '/dersler/kayit', label: tr ? 'Kayıt' : 'Recordings' },
    ] },
    { id: 'atolye', label: tr ? 'Atölye' : 'Workshops', href: '/atolyeler', items: [
      { href: '/atolyeler?mode=LIVE', label: tr ? 'Canlı' : 'Live' },
      { href: '/atolyeler?mode=RECORDED', label: tr ? 'Kayıt' : 'Recorded' },
    ] },
    { id: 'podcast', label: 'Podcast', href: '/podcast', items: [
      { href: '/podcast', label: tr ? 'Konuşmalar' : 'Conversations' },
    ] },
  ];
  const isActive = (href: string) => { const base = href.split('?')[0]; return pathname === base || pathname.startsWith(base + '/'); };
  const groupActive = (g: NavGroup) => isActive(g.href) || g.items.some((i) => isActive(i.href));

  return (
    <header ref={headerRef} className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-rule">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between gap-8">
        <Link href="/" aria-label="AYA ana sayfa" className="tap-area text-ink text-[1.65rem] leading-none inline-flex items-start gap-0.5">
          <Wordmark /><span aria-hidden className="text-[0.55rem] mt-0.5 font-body text-teal-600">®</span>
        </Link>

        <nav ref={navRef} aria-label="Ana menü" className="hidden lg:flex items-center gap-1 xl:gap-2 flex-1">
          {groups.map((g) => {
            const open = openId === g.id;
            return (
              <div key={g.id} className="relative" onMouseEnter={() => openMenu(g.id)} onMouseLeave={scheduleClose}>
                <div className={`flex items-center rounded-full pl-3.5 pr-1.5 transition-colors ${open ? 'bg-teal-50' : ''}`}>
                  <Link
                    href={g.href}
                    aria-current={isActive(g.href) ? 'page' : undefined}
                    onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) openMenu(g.id); }}
                    className={`relative text-[0.92rem] font-semibold py-2 transition-colors ${groupActive(g) || open ? 'text-teal-700' : 'text-ink hover:text-teal-700'}`}
                  >
                    {g.label}
                    {g.live && <span aria-hidden className="inline-block ml-1.5 w-1.5 h-1.5 rounded-full bg-accent align-middle animate-pulse" />}
                  </Link>
                  <button
                    onClick={() => openMenu(g.id)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label={`${g.label} ${tr ? 'alt menüsü' : 'submenu'}`}
                    data-testid={`nav-toggle-${g.id}`}
                    className="p-1.5 text-sage-500 hover:text-teal-700"
                  >
                    <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {open && (
                  <div role="menu" data-testid={`nav-panel-${g.id}`} className="absolute left-0 top-full pt-2 z-50 animate-fade-up" style={{ animationDuration: '0.18s' }}>
                    <div className="min-w-[13.5rem] bg-white border border-rule rounded-2xl shadow-xl p-2">
                      {g.items.map((i) => (
                        <Link key={i.label + i.href} href={i.href} role="menuitem" className="flex items-center justify-between gap-6 px-4 py-2.5 rounded-xl text-sm text-sage-800 hover:bg-teal-50 hover:text-teal-700 transition-colors">
                          {i.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <Link href="/community" aria-current={isActive('/community') ? 'page' : undefined} className={`text-[0.92rem] font-semibold px-3.5 py-2 transition-colors ${isActive('/community') ? 'text-teal-700' : 'text-ink hover:text-teal-700'}`}>
            {tr ? 'Topluluk' : 'Community'}
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {cartN > 0 && (
            <Link href="/shop/sepet" aria-label={`Sepet (${cartN})`} data-testid="nav-cart" className="relative tap-area p-2 text-ink hover:text-teal-700">
              <ShoppingBag size={20} />
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">{cartN}</span>
            </Link>
          )}
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
                  <MenuLink href={homePathFor(role)} icon={<LayoutDashboard size={15} />} onClick={() => setProfileOpen(false)}>Panelim</MenuLink>
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
            <div className="hidden sm:flex items-center gap-3">
              <Link href="/login" data-testid="nav-signin" className="text-sm font-semibold border-[1.5px] border-ink text-ink hover:bg-ink hover:text-white px-5 py-2 rounded-full transition-colors">{t.nav.signIn}</Link>
              <Link href="/login?mode=register" data-testid="nav-signup" className="hidden xl:inline-flex text-sm font-semibold bg-accent text-white hover:bg-accent-dark px-5 py-2.5 rounded-full shadow-glow transition-colors">
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
        <div className="lg:hidden border-t border-rule bg-cream absolute w-full left-0 shadow-lg overflow-y-auto overscroll-contain" style={drawerMax ? { maxHeight: drawerMax } : { maxHeight: 'calc(100dvh - 4.25rem)' }} data-testid="mobile-menu">
          <nav className="max-w-7xl mx-auto px-6 py-4 flex flex-col">
            {groups.map((g) => (
              <div key={g.id} className="py-3 border-b border-rule">
                <Link href={g.href} className="text-xl font-display flex items-center gap-2">
                  {g.label}
                  {g.live && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                </Link>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5">
                  {g.items.map((i) => (
                    <Link key={i.label + i.href} href={i.href} className="text-sm text-sage-600 py-1.5">{i.label}</Link>
                  ))}
                </div>
              </div>
            ))}
            <Link href="/community" className="py-3.5 border-b border-rule text-xl font-display">{tr ? 'Topluluk' : 'Community'}</Link>
            <div className="flex items-center justify-between pt-4">
              {!session?.user ? (
                <Link href="/login?mode=register" className="text-sm font-medium bg-ink text-cream px-5 py-2.5 rounded-md">{t.nav.signIn} / {t.nav.signUp}</Link>
              ) : (
                <Link href={homePathFor(role)} className="text-sm font-medium bg-ink text-cream px-5 py-2.5 rounded-md">Panelim</Link>
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
