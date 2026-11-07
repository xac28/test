'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check, Loader2, Mail } from 'lucide-react';
import { useL } from '@/components/editorial';

/** "Gelişmeleri takip edin!" e-mail sign-up. `tone="dark"` for use on the deep-blue band. */
export function NewsletterForm({ tone = 'light', className = '', source = 'site', variant = 'pill', testId = 'newsletter' }: { tone?: 'light' | 'dark'; className?: string; source?: string; variant?: 'pill' | 'line'; testId?: string }) {
  const L = useL();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === 'busy') return;
    setState('busy');
    setError('');
    try {
      const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || L('Kaydedilemedi.', 'Could not subscribe.'));
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : L('Kaydedilemedi.', 'Could not subscribe.'));
      setState('idle');
    }
  };

  const dark = tone === 'dark';
  if (state === 'done') {
    return (
      <p data-testid={`${testId}-done`} className={`inline-flex items-center gap-2 text-base font-medium ${dark ? 'text-white' : 'text-ink'} ${className}`}>
        <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center"><Check size={16} /></span>
        {L('Teşekkürler! Gelişmeleri e-postana göndereceğiz.', 'Thank you! We will email you updates.')}
      </p>
    );
  }
  if (variant === 'line') {
    return (
      <form onSubmit={submit} className={className} noValidate>
        <div className="flex items-stretch border border-ink/70 focus-within:border-accent transition-colors">
          <input
            type="email"
            required
            data-testid={`${testId}-email`}
            aria-label={L('E-posta adresiniz', 'Your email address')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={L('E-POSTA ADRESİ', 'EMAIL ADDRESS')}
            className="flex-1 min-w-0 bg-transparent px-3.5 py-3 text-xs tracking-wider outline-none text-ink placeholder:text-sage-400"
          />
          <button type="submit" data-testid={`${testId}-submit`} disabled={state === 'busy'} aria-label={L('Abone ol', 'Subscribe')} className="shrink-0 w-14 border-l border-ink/70 flex items-center justify-center text-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-70">
            {state === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={18} />}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    );
  }
  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className={`flex items-center gap-2 p-1.5 rounded-full border max-w-xl ${dark ? 'bg-white/10 border-white/25 backdrop-blur' : 'bg-white border-rule shadow-md'}`}>
        <Mail size={18} className={`ml-3 shrink-0 ${dark ? 'text-white/60' : 'text-sage-500'}`} aria-hidden />
        <input
          type="email"
          required
          data-testid={`${testId}-email`}
          aria-label={L('E-posta adresiniz', 'Your email address')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={L('E-posta adresiniz', 'Your email address')}
          className={`flex-1 min-w-0 bg-transparent px-2 py-2.5 text-sm outline-none ${dark ? 'text-white placeholder:text-white/50' : 'text-ink placeholder:text-sage-400'}`}
        />
        <button type="submit" data-testid={`${testId}-submit`} disabled={state === 'busy'} className="shrink-0 inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent-dark text-white text-sm font-semibold px-5 py-2.5 transition-colors disabled:opacity-70">
          {state === 'busy' ? <Loader2 size={15} className="animate-spin" /> : <>{L('Abone ol', 'Subscribe')} <ArrowRight size={15} /></>}
        </button>
      </div>
      {error && <p role="alert" className={`mt-2 text-sm ${dark ? 'text-red-200' : 'text-red-600'}`}>{error}</p>}
    </form>
  );
}
