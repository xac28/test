'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n';
import { Wordmark } from './Navbar';
import { Aurora, Reveal } from '@/components/motion';

export default function Footer() {
  const { t, locale } = useI18n();
  const year = new Date().getFullYear();
  const tr = locale === 'tr';

  const cols = [
    {
      title: tr ? 'Keşfet' : 'Discover',
      links: [
        { href: '/atolyeler', label: t.nav.workshops },
        { href: '/live', label: t.nav.live },
        { href: '/teachers', label: t.nav.teachers },
        { href: '/icerikler', label: t.nav.articles },
        { href: '/community', label: tr ? 'Topluluk' : 'Community' },
        { href: '/shop', label: 'Shop' },
        { href: '/podcast', label: 'Podcast' },
        { href: '/duyurular', label: tr ? 'Duyurular' : 'News' },
      ],
    },
    {
      title: tr ? 'Yoga' : 'Yoga',
      links: [
        { href: '/yoga-stilleri', label: tr ? 'Yoga stilleri' : 'Yoga styles' },
        { href: '/pozlar', label: tr ? 'Poz kütüphanesi' : 'Pose library' },
        { href: '/nasil-calisir', label: tr ? 'Nasıl çalışır?' : 'How it works' },
        { href: '/sss', label: tr ? 'Sık sorulan sorular' : 'FAQ' },
      ],
    },
    {
      title: t.footer.teachers,
      links: [
        { href: '/ogretmenler-icin', label: tr ? 'Eğitmenler için' : 'For teachers' },
        { href: '/become-teacher', label: t.footer.becomeTeacher },
        { href: '/live/studio', label: tr ? 'Yayın stüdyosu' : 'Broadcast studio' },
        { href: '/pricing', label: t.footer.pricing },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { href: '/hakkimizda', label: tr ? 'Hakkımızda' : 'About' },
        { href: '/community/rules', label: tr ? 'Topluluk kuralları' : 'Community rules' },
        { href: '/terms', label: t.footer.terms },
        { href: '/privacy', label: t.footer.privacy },
        { href: '/cerezler', label: t.footer.cookies },
      ],
    },
  ];

  return (
    <footer className="relative overflow-hidden bg-sage-900 text-cream/80 grain">
      <Aurora dark />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-10">
        <div className="grid md:grid-cols-12 gap-12 pb-12 border-b border-white/15">
          <div className="md:col-span-4">
            <Link href="/" className="text-cream text-4xl"><Wordmark /></Link>
            <p className="font-display text-2xl leading-snug text-cream/90 mt-6 max-w-sm">
              {tr ? 'Nefes, beden ve zihin için bir okul. Canlı, birebir ve herkese açık.' : 'A school for breath, body and mind. Live, one-to-one and open to all.'}
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title} className="md:col-span-2">
              <h4 className="eyebrow !text-cream/50 mb-4">{c.title}</h4>
              <ul className="space-y-2.5 text-sm">
                {c.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="footer-link">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Reveal y={40}><p className="footer-mark font-display text-center pt-8 pb-2 -mb-4" aria-hidden>AYA</p></Reveal>
        <div className="pt-6 text-xs text-cream/50 flex flex-wrap justify-between gap-2">
          <p>© {year} AYA. {t.footer.rights}</p>
          <p>{tr ? 'Dersler yalnızca öğretmen ve öğrenci tarafından indirilebilen kayıtlarla, 30 gün saklanır.' : 'Lesson recordings are available only to teacher and student and kept for 30 days.'}</p>
        </div>
      </div>
    </footer>
  );
}
