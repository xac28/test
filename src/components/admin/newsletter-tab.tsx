"use client"

import { useState } from "react"
import { Mail, Send, Sparkles, Trash2, UserPlus } from "lucide-react"
import { Button, DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, SectionTitle, Segmented, Spinner, Stat, Table, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast } from "./ui"
import { Field, inputCls } from "./forms"

/** Newsletter: subscriber list (search, CSV, delete), add addresses, write and send a campaign, send log. */
export function NewsletterTab() {
  const [status, setStatus] = useState("active")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/newsletter?${new URLSearchParams({ status, page: String(page), ...(dq && { q: dq }) })}`), [status, dq, page])
  const [form, setForm] = useState({ subject: "", body: "", ctaLabel: "", ctaHref: "" })
  const [busy, setBusy] = useState(false)
  const [emails, setEmails] = useState("")
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()

  /** A draft from what was published in the last 7 days: the editor reads it, changes it, sends it. */
  const makeDraft = async () => {
    setBusy(true)
    try {
      const d = await api("/api/admin/writing?draft=newsletter&days=7")
      if (!d.count) { show("Son 7 günde yeni içerik yok; taslak için önce içerik yayınla."); return }
      setForm((f) => ({ ...f, subject: d.subject, body: d.body, ctaLabel: f.ctaLabel || "AYA'yı aç", ctaHref: f.ctaHref || window.location.origin }))
      show(`${d.count} içerikten taslak hazırlandı; göndermeden önce oku`)
    } catch (e: any) { show(e.message) } finally { setBusy(false) }
  }

  const run = async (action: "send" | "test") => {
    setBusy(true)
    try {
      const r = await api("/api/admin/newsletter", { method: "POST", json: { action, ...form } })
      if (action === "test") show(`Test e-postası gönderildi: ${r.to}`)
      else {
        show(r.skipped ? `E-posta ayarı (SMTP) yok: ${r.recipients} aboneye gönderim atlandı, kayıt tutuldu` : `${r.sent} aboneye gönderildi${r.failed ? `, ${r.failed} hata` : ""}`)
        setForm({ subject: "", body: "", ctaLabel: "", ctaHref: "" })
        reload()
      }
    } catch (e: any) { show(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6" data-testid="tab-newsletter">
      <SectionTitle title="Bülten" hint="“Gelişmeleri takip edin” formundan gelen aboneler. Her e-postada abonelikten çıkış bağlantısı bulunur; çıkanlara bir daha gönderilmez." actions={<DownloadCsv href={`/api/admin/newsletter?format=csv&status=${status}`} />} />
      {data && !data.smtp && <p data-testid="smtp-warning" className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4">E-posta (SMTP) ayarı yapılmamış: <code>SMTP_USER</code> ve <code>SMTP_PASS</code> tanımlanana kadar gönderimler yalnızca kayıt altına alınır, kimseye e-posta gitmez.</p>}
      {data && (
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          <Stat label="Aktif abone" value={data.counts.active} tone="green" />
          <Stat label="Ayrılan" value={data.counts.unsub} />
          <Stat label="Gönderilen kampanya" value={data.campaigns.length} />
        </div>
      )}

      <section className="rounded-2xl border border-rule bg-paper p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-2xl">Yeni kampanya</h3>
          <Button disabled={busy} data-testid="nl-draft" onClick={makeDraft}><Sparkles size={15} /> Son içeriklerden taslak oluştur</Button>
        </div>
        <Field label="Konu"><input className={inputCls} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} data-testid="nl-subject" /></Field>
        <Field label="İleti" hint="Boş satır yeni paragraf açar. Düz bağlantılar tıklanabilir olur."><textarea className={inputCls} rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} data-testid="nl-body" /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Düğme yazısı (isteğe bağlı)"><input className={inputCls} value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} data-testid="nl-cta-label" /></Field>
          <Field label="Düğme bağlantısı"><input className={inputCls} value={form.ctaHref} onChange={(e) => setForm({ ...form, ctaHref: e.target.value })} placeholder="https://…" data-testid="nl-cta-href" /></Field>
        </div>
        <div className="flex gap-2">
          <Button disabled={busy} data-testid="nl-test" onClick={() => run("test")}><Mail size={15} /> Bana test gönder</Button>
          <Button tone="primary" disabled={busy || !data} data-testid="nl-send" onClick={() => ask({ title: "Kampanyayı gönder", description: `${data?.counts.active ?? 0} aktif aboneye gönderilecek. Geri alınamaz.`, confirmLabel: "Gönder", onConfirm: async () => { await run("send") } })}><Send size={15} /> Abonelere gönder</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-rule bg-paper p-5 space-y-3">
        <h3 className="font-display text-2xl">Abone ekle</h3>
        <div className="flex gap-2">
          <input className={inputCls} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="a@ornek.com, b@ornek.com" data-testid="nl-add-input" />
          <Button data-testid="nl-add" onClick={async () => { try { const r = await api("/api/admin/newsletter", { method: "POST", json: { action: "add", emails } }); show(`${r.added} adres eklendi${r.invalid ? `, ${r.invalid} geçersiz` : ""}`); setEmails(""); reload() } catch (e: any) { show(e.message) } }}><UserPlus size={15} /> Ekle</Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented testid="nl-status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ id: "active", label: "Aktif", count: data?.counts.active }, { id: "unsub", label: "Ayrılan", count: data?.counts.unsub }, { id: "all", label: "Tümü" }]} />
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="E-posta…" testid="nl-search" />
        </div>
        {error && <ErrorNote message={error} onRetry={reload} />}
        {!data && loading ? <Spinner /> : data && data.subscribers.length === 0 ? <Empty icon={<Mail size={32} />}>Abone yok.</Empty> : data ? (
          <div className={loading ? "opacity-60" : ""}>
            <Table head={["E-posta", "Kaynak", "Katılma", "Durum", ""]}>
              {data.subscribers.map((s: any) => (
                <tr key={s.id} data-testid="subscriber-row">
                  <td className="px-4 py-2.5 break-all">{s.email}</td>
                  <td className="px-4 py-2.5 text-xs text-sage-500">{s.source ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-sage-500 whitespace-nowrap">{fmtDateTime(s.createdAt)}</td>
                  <td className="px-4 py-2.5"><Pill tone={s.unsubscribedAt ? "gray" : "green"}>{s.unsubscribedAt ? "Ayrıldı" : "Aktif"}</Pill></td>
                  <td className="px-4 py-2.5 text-right"><Button tone="ghost" aria-label="Sil" data-testid="subscriber-delete" onClick={() => ask({ title: "Aboneyi sil", description: `${s.email} kalıcı olarak silinir.`, confirmLabel: "Sil", tone: "danger", onConfirm: async () => { await api(`/api/admin/newsletter/${s.id}`, { method: "DELETE" }); show("Silindi"); reload() } })}><Trash2 size={14} /></Button></td>
                </tr>
              ))}
            </Table>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </div>
        ) : null}
      </section>

      {data && data.campaigns.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-2xl">Gönderim geçmişi</h3>
          <Table head={["Konu", "Tür", "Gönderilen", "Zaman"]}>
            {data.campaigns.map((c: any) => (
              <tr key={c.id} data-testid="campaign-row"><td className="px-4 py-2.5">{c.subject}</td><td className="px-4 py-2.5 text-xs">{({ manual: "Kampanya", article: "Yazı", podcast: "Podcast", product: "Ürün" } as any)[c.kind] ?? c.kind}</td><td className="px-4 py-2.5">{c.skipped ? <Pill tone="amber">SMTP yok</Pill> : `${c.sentCount}${c.failedCount ? ` (${c.failedCount} hata)` : ""}`}</td><td className="px-4 py-2.5 text-xs text-sage-500 whitespace-nowrap">{fmtDateTime(c.createdAt)}</td></tr>
            ))}
          </Table>
        </section>
      )}
      {dialog}
      {toast}
    </div>
  )
}
