'use client';

import { useEffect, useState } from 'react';
import { useI18n, hasChosenLocale, Locale } from '@/i18n';

export default function LanguagePicker() {
  const { setLocale, isReady } = useI18n();
  const [show, setShow] = useState(false);
  const [hover, setHover] = useState<Locale | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!hasChosenLocale()) setShow(true);
  }, [isReady]);

  const choose = (l: Locale) => {
    setLocale(l);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 backdrop-blur-md animate-fade-in">
      <div className="relative max-w-md w-[92%] mx-auto bg-cream rounded-3xl shadow-2xl p-10 md:p-14 border border-sage-200">
        {/* Decorative breathing circle */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-sage-300 animate-breathe" style={{ width: '96px', height: '96px' }} />
            <div className="relative w-24 h-24 rounded-full bg-cream border border-sage-200 flex items-center justify-center">
              <svg viewBox="0 0 32 32" className="w-12 h-12 text-sage-600" fill="currentColor">
                <path d="M16 4c-1 4-4 6-7 7 3 1 6 3 7 7 1-4 4-6 7-7-3-1-6-3-7-7z" opacity="0.7" />
                <path d="M16 13c-.5 2-2 3-3.5 3.5 1.5.5 3 1.5 3.5 3.5.5-2 2-3 3.5-3.5-1.5-.5-3-1.5-3.5-3.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <h1 className="font-display text-4xl md:text-5xl text-ink mb-3 italic">
            AYA
          </h1>
          <p className="font-display text-xl md:text-2xl text-sage-700 mb-2">
            Welcome · Hoş Geldiniz
          </p>
          <p className="text-ink/60 text-sm mb-8">
            Choose your language · Dilinizi seçin
          </p>

          <div className="space-y-3">
            <button
              onClick={() => choose('en')}
              onMouseEnter={() => setHover('en')}
              onMouseLeave={() => setHover(null)}
              className="w-full group flex items-center justify-between px-6 py-4 rounded-2xl bg-sage-50 border border-sage-200 hover:bg-sage-600 hover:border-sage-600 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🇬🇧</span>
                <span className={`font-medium ${hover === 'en' ? 'text-cream' : 'text-ink'} transition-colors`}>
                  English
                </span>
              </div>
              <span className={`text-xl ${hover === 'en' ? 'text-cream translate-x-1' : 'text-sage-500'} transition-all`}>→</span>
            </button>

            <button
              onClick={() => choose('tr')}
              onMouseEnter={() => setHover('tr')}
              onMouseLeave={() => setHover(null)}
              className="w-full group flex items-center justify-between px-6 py-4 rounded-2xl bg-sage-50 border border-sage-200 hover:bg-sage-600 hover:border-sage-600 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🇹🇷</span>
                <span className={`font-medium ${hover === 'tr' ? 'text-cream' : 'text-ink'} transition-colors`}>
                  Türkçe
                </span>
              </div>
              <span className={`text-xl ${hover === 'tr' ? 'text-cream translate-x-1' : 'text-sage-500'} transition-all`}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
