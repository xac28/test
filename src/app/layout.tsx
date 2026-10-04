import type { Metadata, Viewport } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import { I18nProvider } from '@/i18n';
import { Providers } from '@/components/providers';
import { AiAssistant } from '@/components/ai-assistant';
import { SignupNudge } from '@/components/signup-nudge';
import { ErrorBoundary } from '@/components/error-boundary';
import './globals.css';

// `latin-ext` carries ı ş ğ İ Ş Ğ — without it Turkish text silently falls back to a system font mid-word.
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
  adjustFontFallback: false, // no override metrics are published for Newsreader; avoids a build warning
});

export const metadata: Metadata = {
  title: { default: 'AYA — Yoga ve meditasyonda canlı dersler', template: '%s · AYA' },
  description:
    'AYA: sertifikalı eğitmenlerle birebir dersler, canlı yayınlar, atölyeler ve yoga, nefes ve meditasyon üzerine yazılar.',
};

export const viewport: Viewport = {
  themeColor: '#f6f2ea',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${newsreader.variable}`}>
      <body className={inter.className}>
        <Providers>
          <I18nProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <SignupNudge />
            <AiAssistant />
          </I18nProvider>
        </Providers>
      </body>
    </html>
  );
}
