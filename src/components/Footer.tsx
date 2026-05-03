'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n';

export default function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-sage-900 text-cream/80 mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <svg viewBox="0 0 32 32" className="w-7 h-7 text-sage-300" fill="currentColor">
                <path d="M16 4c-1 4-4 6-7 7 3 1 6 3 7 7 1-4 4-6 7-7-3-1-6-3-7-7z" opacity="0.7" />
                <path d="M16 13c-.5 2-2 3-3.5 3.5 1.5.5 3 1.5 3.5 3.5.5-2 2-3 3.5-3.5-1.5-.5-3-1.5-3.5-3.5z" />
              </svg>
              <span className="font-display text-2xl italic text-cream">Namaste</span>
            </div>
            <p className="font-display italic text-cream/60 text-lg max-w-xs">
              {t.footer.tagline}
            </p>
          </div>

          <div>
            <h4 className="text-cream font-medium mb-4 text-sm uppercase tracking-wide">{t.footer.students}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/teachers" className="hover:text-cream transition-colors">{t.footer.findTeacher}</Link></li>
              <li><Link href="/pricing" className="hover:text-cream transition-colors">{t.footer.pricing}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-cream font-medium mb-4 text-sm uppercase tracking-wide">{t.footer.teachers}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/become-teacher" className="hover:text-cream transition-colors">{t.footer.becomeTeacher}</Link></li>
              <li><Link href="/become-teacher" className="hover:text-cream transition-colors">{t.footer.teacherFaq}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-cream font-medium mb-4 text-sm uppercase tracking-wide">{t.footer.company}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-cream transition-colors">{t.footer.about}</Link></li>
              <li><Link href="/" className="hover:text-cream transition-colors">{t.footer.contact}</Link></li>
              <li><Link href="/terms" className="hover:text-cream transition-colors">{t.footer.terms}</Link></li>
              <li><Link href="/privacy" className="hover:text-cream transition-colors">{t.footer.privacy}</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-sage-700 text-xs text-cream/50 flex justify-between items-center">
          <p>© {year} Namaste. {t.footer.rights}</p>
          <p className="font-display italic">🙏</p>
        </div>
      </div>
    </footer>
  );
}
