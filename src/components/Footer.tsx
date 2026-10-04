'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n';
import { Wordmark } from './Navbar';

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
      ],
    },
    {
      title: t.footer.teachers,
      links: [
        { href: '/become-teacher', label: t.footer.becomeTeacher },
        { href: '/live/studio', label: tr ? 'Yayın stüdyosu' : 'Broadcast studio' },
        { href: '/pricing', label: t.footer.pricing },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { href: '/terms', label: t.footer.terms },
        { href: '/privacy', label: t.footer.privacy },
      ],
    },
  ];

  return (
    <footer className="bg-sage-900 text-cream/80 mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-10">
        <div className="grid md:grid-cols-12 gap-12 pb-12 border-b border-white/15">
          <div className="md:col-span-5">
            <Link href="/" className="text-cream text-4xl"><Wordmark /></Link>
            <p className="font-display text-2xl leading-snug text-cream/90 mt-6 max-w-sm">
              {tr ? 'Nefes, beden ve zihin için bir okul. Canlı, birebir ve herkese açık.' : 'A school for breath, body and mind. Live, one-to-one and open to all.'}
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title} className="md:col-span-2 md:first:col-start-7">
              <h4 className="eyebrow !text-cream/50 mb-4">{c.title}</h4>
              <ul className="space-y-2.5 text-sm">
                {c.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="hover:text-cream underline-offset-4 hover:underline">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 text-xs text-cream/50 flex flex-wrap justify-between gap-2">
          <p>© {year} AYA. {t.footer.rights}</p>
          <p>{tr ? 'Dersler yalnızca öğretmen ve öğrenci tarafından indirilebilen kayıtlarla, 30 gün saklanır.' : 'Lesson recordings are available only to teacher and student and kept for 30 days.'}</p>
        </div>
      </div>
    </footer>
  );
}
