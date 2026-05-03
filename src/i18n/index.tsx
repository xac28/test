'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { en } from './en';
import { tr } from './tr';

export type Locale = 'en' | 'tr';
export type Translations = typeof en;

const dictionaries: Record<Locale, Translations> = { en, tr };

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
  isReady: boolean;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('namaste-locale') : null;
    if (stored === 'en' || stored === 'tr') {
      setLocaleState(stored);
    }
    setIsReady(true);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem('namaste-locale', l);
    }
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: dictionaries[locale], isReady }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Has the user already chosen a language? */
export function hasChosenLocale(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('namaste-locale');
}
