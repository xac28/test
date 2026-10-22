'use client';

import Link from 'next/link';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useL } from '@/components/editorial';

export function UnsubscribeView({ token }: { token: string }) {
  const L = useL();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const go = async () => {
    setState('busy');
    const res = await fetch('/api/newsletter/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null);
    setState(res?.ok ? 'done' : 'error');
  };
  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-6 py-24 text-center" data-testid="unsubscribe-page">
        <h1 className="font-display text-5xl mb-4">{L('Bültenden ayrıl', 'Unsubscribe')}</h1>
        {state === 'done' ? (
          <p data-testid="unsub-done" className="text-lg text-sage-700">{L('Abonelikten çıktınız. Artık bülten e-postası almayacaksınız.', 'You are unsubscribed. You will not receive newsletter emails any more.')}</p>
        ) : (
          <>
            <p className="text-sage-600 mb-8">{L('AYA bültenine artık e-posta gönderilmesini istemiyor musunuz?', 'Do you want to stop receiving the AYA newsletter?')}</p>
            {state === 'error' && <p role="alert" data-testid="unsub-error" className="text-red-600 mb-4">{L('Bağlantı geçersiz veya süresi dolmuş.', 'This link is invalid or has expired.')}</p>}
            <button onClick={go} disabled={!token || state === 'busy'} data-testid="unsub-confirm" className="btn-cta disabled:opacity-60">{L('Evet, abonelikten çık', 'Yes, unsubscribe')}</button>
          </>
        )}
        <p className="mt-10"><Link href="/" className="underline text-sage-600">{L('Ana sayfaya dön', 'Back to home')}</Link></p>
      </main>
      <Footer />
    </>
  );
}
