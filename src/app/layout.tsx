import type { Metadata } from 'next';
import { Inter, Cormorant_Garamond } from 'next/font/google';
import { I18nProvider } from '@/i18n';
import { Providers } from '@/components/providers';
import { AiAssistant } from '@/components/ai-assistant';
import { ErrorBoundary } from '@/components/error-boundary';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'AYA — Your practice, anywhere you breathe.',
  description: 'Live 1-on-1 yoga and meditation classes with certified teachers worldwide.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body className={inter.className}>
        <Providers>
          <I18nProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <AiAssistant />
          </I18nProvider>
        </Providers>
      </body>
    </html>
  );
}
