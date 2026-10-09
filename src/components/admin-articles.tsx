'use client';

import { useConfirm } from './admin/ui';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { ARTICLE_ADMIN_CATEGORIES } from '@/lib/articles';
import { formatSchedule, fromLocalInput, toLocalInput } from '@/lib/schedule';

interface Row {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}

interface Draft {
  id?: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  coverUrl: string;
  status: 'DRAFT' | 'PUBLISHED';
  notify?: boolean;
  /** datetime-local value (browser time); empty = not scheduled */
  scheduledAt?: string;
}

const EMPTY: Draft = { title: '', excerpt: '', body: '', category: ARTICLE_ADMIN_CATEGORIES[0], coverUrl: '', status: 'DRAFT' };

export function AdminArticles() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/articles');
    if (res.ok) setRows((await res.json()).articles);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const edit = async (id: string) => {
    const res = await fetch(`/api/admin/articles/${id}`);
    if (!res.ok) return;
    const { article } = await res.json();
    setDraft({ id, title: article.title, excerpt: article.excerpt, body: article.body, category: article.category, coverUrl: article.coverUrl || '', status: article.status, scheduledAt: toLocalInput(article.scheduledAt) });
  };

  const save = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    const res = await fetch(draft.id ? `/api/admin/articles/${draft.id}` : '/api/admin/articles', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, status, scheduledAt: status === 'DRAFT' ? fromLocalInput(draft.scheduledAt || '') : null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Kaydedilemedi.');
    setDraft(null);
    load();
  };

  const toggle = async (r: Row) => {
    await fetch(`/api/admin/articles/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: r.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }) });
    load();
  };

  const { ask, dialog } = useConfirm();
  const remove = (r: Row) =>
    ask({
      title: 'Yazıyı sil',
      description: `“${r.title}” kalıcı olarak silinir.`,
      confirmLabel: 'Sil',
      tone: 'danger',
      onConfirm: async () => {
        const res = await fetch(`/api/admin/articles/${r.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Yazı silinemedi.');
        load();
      },
    });

  const field = 'w-full border border-sage-200 bg-white px-3 py-2.5 text-sm focus:border-ink focus:outline-none rounded-md';

  return (
    <div className="space-y-6" data-testid="admin-articles">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3"><FileText className="text-sage-600" /> İçerikler</h2>
          <p className="text-sm text-sage-500 mt-1">Sitenin “İçerikler” bölümündeki yazıları yönetin. Taslaklar yalnızca burada görünür.</p>
        </div>
        {!draft && (
          <button data-testid="new-article" onClick={() => setDraft({ ...EMPTY })} className="inline-flex items-center gap-2 bg-ink text-cream px-5 py-2.5 text-sm font-semibold rounded-md">
            <Plus size={16} /> Yeni yazı
          </button>
        )}
      </div>

      {draft && (
        <div className="glass-card p-6 space-y-4" data-testid="article-form">
          <div><label className="eyebrow block mb-1.5">Başlık</label><input data-testid="article-title-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={field} /></div>
          <div><label className="eyebrow block mb-1.5">Özet (20–400 karakter)</label><textarea value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} rows={2} className={field} /></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="eyebrow block mb-1.5">Kategori</label><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={field}>{ARTICLE_ADMIN_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="eyebrow block mb-1.5">Kapak görseli (bağlantı)</label><input value={draft.coverUrl} onChange={(e) => setDraft({ ...draft, coverUrl: e.target.value })} className={field} placeholder="https://…" /></div>
          </div>
          <div>
            <label className="eyebrow block mb-1.5">Yazı</label>
            <textarea data-testid="article-body-input" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={14} className={`${field} font-mono`} />
            <p className="text-xs text-sage-500 mt-1.5">Biçim: <code>## Başlık</code>, <code>### Alt başlık</code>, <code>&gt; Alıntı</code>, <code>- madde</code>. Paragrafları boş satırla ayırın.</p>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" data-testid="article-notify" checked={!!draft.notify} onChange={(e) => setDraft({ ...draft, notify: e.target.checked })} /> <span>Yayınlarken bülten abonelerine e-posta gönder<span className="block text-xs text-sage-500">Duyuru ve haberler için önerilir. Her yazı için yalnızca bir kez gönderilir.</span></span></label>
          <div>
            <label className="eyebrow block mb-1.5" htmlFor="article-schedule">Yayın zamanı (isteğe bağlı)</label>
            <input id="article-schedule" data-testid="schedule-input" type="datetime-local" value={draft.scheduledAt || ''} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} className={`${field} max-w-xs`} />
            <p className="text-xs text-sage-500 mt-1.5">Bir zaman seçip “Zamanla”ya basarsan yazı o saatte kendiliğinden yayınlanır{draft.notify ? ' ve abonelere e-posta gider' : ''}.</p>
          </div>
          {error && <p role="alert" className="text-sm text-clay-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            {draft.scheduledAt && <button data-testid="schedule-article" disabled={busy} onClick={() => save('DRAFT')} className="bg-teal-700 text-white px-6 py-2.5 text-sm font-semibold rounded-md disabled:opacity-60">Zamanla</button>}
            <button data-testid="publish-article" disabled={busy} onClick={() => save('PUBLISHED')} className="bg-ink text-cream px-6 py-2.5 text-sm font-semibold rounded-md disabled:opacity-60">{draft.id && draft.status === 'PUBLISHED' ? 'Güncelle' : 'Yayınla'}</button>
            <button data-testid="save-draft" disabled={busy} onClick={() => save('DRAFT')} className="border border-ink px-6 py-2.5 text-sm font-semibold rounded-md disabled:opacity-60">Taslak olarak kaydet</button>
            <button onClick={() => { setDraft(null); setError(null); }} className="px-4 py-2.5 text-sm text-sage-600 underline">Vazgeç</button>
          </div>
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-sage-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="glass-card p-10 text-center text-sage-500">Henüz yazı yok.</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-sage-50 border-b border-sage-200 text-xs text-sage-500">
              <tr><th className="px-5 py-3">Başlık</th><th className="px-5 py-3">Kategori</th><th className="px-5 py-3">Durum</th><th className="px-5 py-3 text-right">İşlem</th></tr>
            </thead>
            <tbody className="divide-y divide-sage-100">
              {rows.map((r) => (
                <tr key={r.id} data-testid="article-row">
                  <td className="px-5 py-3 text-sm font-medium text-sage-900">{r.title}</td>
                  <td className="px-5 py-3 text-sm text-sage-600">{r.category}</td>
                  <td className="px-5 py-3"><span data-testid="article-status" className={`text-xs font-bold px-2.5 py-1 rounded-full border ${r.status === 'PUBLISHED' ? 'bg-green-50 text-green-800 border-green-200' : r.scheduledAt ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{r.status === 'PUBLISHED' ? 'Yayında' : r.scheduledAt ? `Zamanlandı · ${formatSchedule(r.scheduledAt)}` : 'Taslak'}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => edit(r.id)} title="Düzenle" className="p-2 hover:bg-sage-100 rounded-md"><Pencil size={15} /></button>
                      <button onClick={() => toggle(r)} className="px-3 py-1.5 text-xs font-semibold border border-sage-200 hover:border-ink rounded-md">{r.status === 'PUBLISHED' ? 'Taslağa al' : 'Yayınla'}</button>
                      <button onClick={() => remove(r)} title="Sil" className="p-2 text-clay-600 hover:bg-clay-50 rounded-md"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
