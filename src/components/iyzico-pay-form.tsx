'use client';

import { useEffect, useRef } from 'react';

/**
 * Shows a payment form that arrives as HTML (iyzico's checkout form, or the local mock). Scripts inserted through
 * innerHTML never run, so each one is re-created; iyzico's script then draws its form into #iyzipay-checkout-form.
 */
export function PayForm({ html, testId = 'pay-form' }: { html: string; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.innerHTML = html;
    box.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.text;
      old.replaceWith(s);
    });
  }, [html]);
  return <div ref={ref} id="iyzipay-checkout-form" data-testid={testId} className="responsive" />;
}
