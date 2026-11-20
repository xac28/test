'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, Radio, Users, X } from 'lucide-react';
import { WORKSHOP_CATEGORIES, WORKSHOP_LEVELS, STATE_LABEL_TR, WorkshopState, formatPriceTR } from '@/lib/workshops';

export interface ManagedWorkshop {
  id: string;
  slug: string;
  title: string;
  category: string;
  mode: 'LIVE' | 'RECORDED';
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
  state: WorkshopState;
  startsAt: string | null;
  durationMin: number;
  capacity: number;
  priceUsd: number;
  active: number;
}

interface Enrollment {
  id: string;
  status: 'RESERVED' | 'CONFIRMED' | 'CANCELLED';
  user: { id: string; name: string | null; email: string | null };
}

const ENROLL_LABEL = { RESERVED: 'Ödeme bekliyor', CONFIRMED: 'Onaylı', CANCELLED: 'İptal' } as const;

/** Teacher-side workshop management: create, publish/cancel, broadcast, participants & payment confirmation. */
export function WorkshopManager({ initial }: { initial: ManagedWorkshop[] }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(initial.length === 0);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // reload via the public list + own drafts is overkill — the server page is the source of truth
    window.location.reload();
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <p className="text-sm text-sage-600">{items.length} atölye</p>
        <button
          data-testid="new-workshop"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 bg-ink text-cream px-5 py-2.5 text-sm font-semibold rounded-md hover:bg-sage-800"
        >
          {open ? <X size={16} /> : <Plus size={16} />} {open ? 'Formu kapat' : 'Yeni atölye'}
        </button>
      </div>

      {open && <WorkshopForm onCreated={refresh} />}

      {items.length === 0 ? (
        <p className="text-sage-600">Henüz atölyeniz yok. Yukarıdaki formla ilkini oluşturun.</p>
      ) : (
        <ul className="border-t border-ink" data-testid="managed-workshops">
          {items.map((w) => (
            <li key={w.id} className="border-b border-rule py-5" data-testid="managed-workshop">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow mb-1">{w.category} · {w.mode === 'LIVE' ? 'Canlı' : 'Kayıtlı'} · {STATE_LABEL_TR[w.state]}</p>
                  <Link href={`/atolyeler/${w.slug}`} className="font-display text-2xl hover:underline underline-offset-4 decoration-1">{w.title}</Link>
                  <p className="text-sm text-sage-600 mt-1">
                    {w.startsAt ? new Date(w.startsAt).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' }) : `${w.durationMin} dk`}
                    {' · '}{w.active}/{w.capacity} katılımcı · {formatPriceTR(w.priceUsd)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {w.mode === 'LIVE' && w.status === 'PUBLISHED' && w.state !== 'ended' && (
                    <Link href={`/live/studio?workshop=${w.id}`} className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white px-4 py-2 text-sm font-semibold rounded-md">
                      <Radio size={14} /> Yayınla
                    </Link>
                  )}
                  <button onClick={() => setOpenId(openId === w.id ? null : w.id)} className="inline-flex items-center gap-1.5 border border-ink px-4 py-2 text-sm font-semibold rounded-md hover:bg-sage-100">
                    <Users size={14} /> Katılımcılar
                  </button>
                  <StatusButtons w={w} onChange={(s) => setItems((list) => list.map((x) => (x.id === w.id ? { ...x, status: s, state: s === 'CANCELLED' ? 'cancelled' : x.state } : x)))} />
                </div>
              </div>
              {openId === w.id && <Participants workshopId={w.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusButtons({ w, onChange }: { w: ManagedWorkshop; onChange: (s: ManagedWorkshop['status']) => void }) {
  const [busy, setBusy] = useState(false);
  const set = async (status: ManagedWorkshop['status'], confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    const res = await fetch(`/api/workshops/${w.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setBusy(false);
    if (res.ok) onChange(status);
    else alert((await res.json().catch(() => ({}))).error || 'İşlem başarısız oldu.');
  };
  return (
    <>
      {w.status === 'DRAFT' && <button disabled={busy} onClick={() => set('PUBLISHED')} className="border border-rule px-4 py-2 text-sm rounded-md hover:border-ink">Yayına al</button>}
      {w.status === 'PUBLISHED' && <button disabled={busy} onClick={() => set('DRAFT')} className="border border-rule px-4 py-2 text-sm rounded-md hover:border-ink">Taslağa al</button>}
      {w.status !== 'CANCELLED' && (
        <button disabled={busy} onClick={() => set('CANCELLED', 'Atölyeyi iptal etmek istediğinize emin misiniz?')} className="border border-rule px-4 py-2 text-sm text-clay-600 rounded-md hover:border-clay-500">İptal et</button>
      )}
    </>
  );
}

function Participants({ workshopId }: { workshopId: string }) {
  const [rows, setRows] = useState<Enrollment[] | null>(null);
  const load = useCallback(() => {
    fetch(`/api/workshops/${workshopId}/enrollments`).then((r) => (r.ok ? r.json() : { enrollments: [] })).then((d) => setRows(d.enrollments));
  }, [workshopId]);
  useEffect(load, [load]);

  const set = async (userId: string, status: 'CONFIRMED' | 'CANCELLED') => {
    await fetch(`/api/workshops/${workshopId}/enrollments/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  };

  if (!rows) return <p className="text-sm text-sage-500 mt-4 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Yükleniyor…</p>;
  const active = rows.filter((r) => r.status !== 'CANCELLED');
  return (
    <div className="mt-5 bg-paper border border-rule p-4" data-testid="participants">
      {active.length === 0 ? (
        <p className="text-sm text-sage-500">Henüz katılımcı yok.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {active.map((r) => (
            <li key={r.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <span><strong>{r.user.name}</strong> <span className="text-sage-500">{r.user.email}</span></span>
              <span className="flex items-center gap-3">
                <span className={r.status === 'CONFIRMED' ? 'text-emerald-700' : 'text-amber-700'}>{ENROLL_LABEL[r.status]}</span>
                {r.status === 'RESERVED' && (
                  <button data-testid="confirm-payment" onClick={() => set(r.user.id, 'CONFIRMED')} className="inline-flex items-center gap-1 bg-ink text-cream px-3 py-1 text-xs font-semibold rounded-md">
                    <Check size={12} /> Ödeme alındı
                  </button>
                )}
                <button onClick={() => confirm(`${r.user.name} kayıttan çıkarılsın mı?`) && set(r.user.id, 'CANCELLED')} className="text-xs text-clay-600 underline">Çıkar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkshopForm({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<'LIVE' | 'RECORDED'>('LIVE');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const field = 'w-full border border-rule bg-paper px-3 py-2.5 text-sm focus:border-ink focus:outline-none rounded-md';
  const label = 'eyebrow block mb-1.5';

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'video');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok) setVideoUrl(data.url);
    else setError(data.error || 'Video yüklenemedi.');
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) || '');
    const startsLocal = get('startsAt');
    const body = {
      title: get('title'),
      subtitle: get('subtitle'),
      description: get('description'),
      category: get('category'),
      level: get('level'),
      mode,
      startsAt: startsLocal ? new Date(startsLocal).toISOString() : undefined,
      durationMin: Number(get('durationMin')),
      capacity: Number(get('capacity')),
      priceUsd: Number(get('priceUsd')),
      coverUrl: get('coverUrl'),
      videoUrl,
      status: get('publish') === 'on' ? 'PUBLISHED' : 'DRAFT',
    };
    setBusy(true);
    const res = await fetch('/api/workshops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Atölye oluşturulamadı.');
    onCreated();
  };

  return (
    <form onSubmit={submit} data-testid="workshop-form" className="border border-ink bg-paper p-6 grid md:grid-cols-2 gap-5">
      <div className="md:col-span-2"><label className={label}>Başlık</label><input name="title" required minLength={4} maxLength={160} className={field} placeholder="Örn. Sabah Yogası: Güneşe Selam" /></div>
      <div className="md:col-span-2"><label className={label}>Alt başlık (isteğe bağlı)</label><input name="subtitle" maxLength={240} className={field} /></div>
      <div className="md:col-span-2"><label className={label}>Açıklama</label><textarea name="description" required minLength={30} rows={5} className={field} placeholder="Atölyede neler yapılacak, kimler için uygun, ne getirmeli?" /></div>
      <div><label className={label}>Kategori</label><select name="category" className={field}>{WORKSHOP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div><label className={label}>Seviye</label><select name="level" className={field}>{WORKSHOP_LEVELS.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div>
        <label className={label}>Tür</label>
        <div className="flex gap-2">
          {(['LIVE', 'RECORDED'] as const).map((m) => (
            <button type="button" key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`flex-1 px-4 py-2.5 text-sm border rounded-md ${mode === m ? 'bg-ink text-cream border-ink' : 'border-rule'}`}>
              {m === 'LIVE' ? 'Canlı' : 'Kayıtlı'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'LIVE' ? (
        <div><label className={label}>Başlangıç</label><input name="startsAt" type="datetime-local" required className={field} data-testid="workshop-starts" /></div>
      ) : (
        <div>
          <label className={label}>Video</label>
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={field} placeholder="https://… veya dosya yükleyin" />
          <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="mt-2 text-xs" />
          {uploading && <p className="text-xs text-sage-500 mt-1">Yükleniyor…</p>}
        </div>
      )}
      <div><label className={label}>Süre (dk)</label><input name="durationMin" type="number" min={10} max={480} defaultValue={60} className={field} /></div>
      <div><label className={label}>Kontenjan</label><input name="capacity" type="number" min={1} max={500} defaultValue={20} className={field} /></div>
      <div><label className={label}>Ücret (USD, 0 = ücretsiz)</label><input name="priceUsd" type="number" min={0} max={1000} step="0.01" defaultValue={0} className={field} /></div>
      <div><label className={label}>Kapak görseli (bağlantı)</label><input name="coverUrl" className={field} placeholder="https://…" /></div>
      <label className="md:col-span-2 flex items-center gap-2 text-sm"><input name="publish" type="checkbox" defaultChecked className="accent-orange-700" /> Hemen yayınla (işaretlenmezse taslak olarak kaydedilir)</label>
      {error && <p role="alert" className="md:col-span-2 text-sm text-clay-600">{error}</p>}
      <div className="md:col-span-2">
        <button data-testid="create-workshop" disabled={busy} className="bg-ink text-cream px-7 py-3 text-sm font-semibold rounded-md hover:bg-sage-800 disabled:opacity-60">
          {busy ? 'Kaydediliyor…' : 'Atölyeyi oluştur'}
        </button>
      </div>
    </form>
  );
}
