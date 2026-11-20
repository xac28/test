'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

type MountState = 'loading' | 'ready' | 'slow';

/**
 * Shows a payment form that arrives as HTML (iyzico's checkout form, or the local mock). Scripts inserted through
 * innerHTML never run, so each one is re-created; iyzico's script then draws its form into #iyzipay-checkout-form.
 * The box itself (and its testId) is always rendered so existing visibility checks keep working — a loading
 * skeleton only overlays it until real content (iyzico's iframe/inputs, or the local mock's form) appears,
 * and a slow-network note appears alongside it (never replacing it) if that takes unusually long.
 */
export function PayForm({ html, testId = 'pay-form' }: { html: string; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MountState>('loading');

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    setState('loading');
    box.innerHTML = html;
    box.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.text;
      old.replaceWith(s);
    });

    const checkReady = () => box.querySelector('iframe, input, form') !== null;
    if (checkReady()) { setState('ready'); return; }

    const slow = setTimeout(() => setState((s) => (s === 'loading' ? 'slow' : s)), 8000);
    const observer = new MutationObserver(() => {
      if (checkReady()) { setState('ready'); clearTimeout(slow); observer.disconnect(); }
    });
    observer.observe(box, { childList: true, subtree: true });
    return () => { observer.disconnect(); clearTimeout(slow); };
  }, [html]);

  return (
    <div className="relative">
      {state !== 'ready' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/90 py-10" aria-live="polite" aria-busy="true">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sage-200 border-t-sage-600" />
          <p className="text-sm text-sage-500">Güvenli ödeme sayfası yükleniyor…</p>
        </div>
      )}
      <div ref={ref} id="iyzipay-checkout-form" data-testid={testId} className="responsive min-h-[12rem]" />
      {state === 'slow' && (
        <p role="status" className="mt-3 text-center text-sm text-amber-700">
          Bu biraz uzun sürüyor; bağlantını kontrol et. Sorun devam ederse sayfayı yenileyip tekrar dene.
        </p>
      )}
      {state === 'ready' && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-sage-500">
          <Lock size={12} /> 256-bit SSL ile şifrelenir · iyzico güvencesiyle 3D Secure doğrulama
        </p>
      )}
    </div>
  );
}
