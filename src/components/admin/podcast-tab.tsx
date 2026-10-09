"use client"

import { useState } from "react"
import { Eye, EyeOff, Headphones, Pencil, Plus, Trash2 } from "lucide-react"
import { Button, Drawer, Empty, ErrorNote, Pill, SectionTitle, Spinner, Stat, Table, api, fmtDate, useConfirm, useLoader, useToast } from "./ui"
import { Field, UploadField, audioDuration, inputCls } from "./forms"
import { formatDuration } from "@/lib/podcast"

interface Draft { id?: string; title: string; description: string; audioUrl: string; coverUrl: string; guest: string; durationSec: string; episodeNo: string; status: "DRAFT" | "PUBLISHED"; notify: boolean }
const EMPTY: Draft = { title: "", description: "", audioUrl: "", coverUrl: "", guest: "", durationSec: "", episodeNo: "", status: "DRAFT", notify: false }

/** Podcast "Konuşmalar": add episodes (audio upload), publish, tell the subscribers, see the listens. */
export function PodcastTab({ onChanged }: { onChanged: () => void }) {
  const { data, error, loading, reload } = useLoader<any>(() => api("/api/admin/podcast"), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()

  const open = (e?: any) => {
    setFormError(null)
    setDraft(e ? { id: e.id, title: e.title, description: e.description, audioUrl: e.audioUrl, coverUrl: e.coverUrl || "", guest: e.guest || "", durationSec: e.durationSec ? String(e.durationSec) : "", episodeNo: e.episodeNo ? String(e.episodeNo) : "", status: e.status, notify: false } : { ...EMPTY, episodeNo: String((data?.count ?? 0) + 1) })
  }

  const save = async (status: "DRAFT" | "PUBLISHED") => {
    if (!draft) return
    setSaving(true)
    setFormError(null)
    try {
      const res = await api(draft.id ? `/api/admin/podcast/${draft.id}` : "/api/admin/podcast", { method: draft.id ? "PATCH" : "POST", json: { ...draft, status } })
      const n = res.newsletter
      show(status === "PUBLISHED" ? `Yayınlandı${n ? (n.skipped ? " (e-posta ayarı yok: bülten gönderilmedi)" : `, ${n.sent} aboneye e-posta gitti`) : ""}` : "Taslak kaydedildi")
      setDraft(null)
      reload()
      onChanged()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (e: any) => {
    try {
      await api(`/api/admin/podcast/${e.id}`, { method: "PATCH", json: { status: e.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" } })
      show(e.status === "PUBLISHED" ? "Yayından kaldırıldı" : "Yayınlandı")
      reload()
    } catch (err: any) { show(err.message) }
  }

  return (
    <div className="space-y-4" data-testid="tab-podcast">
      <SectionTitle title="Podcast" hint="Konuşmalar bölümleri. Ses dosyasını yükleyin (mp3, m4a, ogg, wav · en çok 200 MB); yayınlanan bölümler /podcast sayfasında ve RSS beslemesinde görünür." actions={<Button tone="primary" data-testid="episode-new" onClick={() => open()}><Plus size={15} /> Yeni bölüm</Button>} />
      {data && (
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          <Stat label="Bölüm" value={data.count} />
          <Stat label="Yayında" value={data.episodes.filter((e: any) => e.status === "PUBLISHED").length} tone="green" />
          <Stat label="Toplam dinlenme" value={data.totalPlays} />
        </div>
      )}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.episodes.length === 0 ? <Empty icon={<Headphones size={32} />}>Henüz bölüm yok. “Yeni bölüm” ile ilkini ekleyin.</Empty> : data ? (
        <Table head={["Bölüm", "Durum", "Süre", "Dinlenme", "Tarih", ""]}>
          {data.episodes.map((e: any) => (
            <tr key={e.id} data-testid="episode-row" className="align-top">
              <td className="px-4 py-3 max-w-sm"><p className="font-medium break-words">{e.episodeNo ? `#${e.episodeNo} · ` : ""}{e.title}</p>{e.guest && <p className="text-xs text-sage-500">Konuk: {e.guest}</p>}</td>
              <td className="px-4 py-3"><Pill tone={e.status === "PUBLISHED" ? "green" : "gray"}>{e.status === "PUBLISHED" ? "Yayında" : "Taslak"}</Pill></td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDuration(e.durationSec) || "—"}</td>
              <td className="px-4 py-3">{e.plays}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500">{fmtDate(e.publishedAt ?? e.createdAt)}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                <Button data-testid="episode-toggle" onClick={() => toggle(e)}>{e.status === "PUBLISHED" ? <><EyeOff size={14} /> Kaldır</> : <><Eye size={14} /> Yayınla</>}</Button>
                <Button data-testid="episode-edit" onClick={() => open(e)}><Pencil size={14} /> Düzenle</Button>
                <Button tone="ghost" data-testid="episode-delete" onClick={() => ask({ title: "Bölümü sil", description: `“${e.title}” kalıcı olarak silinir.`, confirmLabel: "Sil", tone: "danger", onConfirm: async () => { await api(`/api/admin/podcast/${e.id}`, { method: "DELETE" }); show("Silindi"); reload(); onChanged() } })}><Trash2 size={14} /></Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {draft && (
        <Drawer title={draft.id ? "Bölümü düzenle" : "Yeni bölüm"} onClose={() => setDraft(null)} testid="episode-drawer">
          <Field label="Başlık"><input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} data-testid="episode-title" /></Field>
          <Field label="Açıklama" hint="Podcast uygulamalarında ve sayfada görünür."><textarea className={inputCls} rows={6} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} data-testid="episode-description" /></Field>
          <UploadField type="audio" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,.mp3,.m4a,.ogg,.wav" label="Ses dosyası" testid="episode-audio" preview="audio" hint="Yüklenince süre otomatik okunur."
            value={draft.audioUrl} onChange={async (url, file) => { setDraft((d) => d && { ...d, audioUrl: url }); if (file) { const sec = await audioDuration(url); if (sec) setDraft((d) => d && { ...d, durationSec: String(sec) }) } }} />
          <UploadField type="product" accept="image/jpeg,image/png,image/webp" label="Kapak görseli (isteğe bağlı)" testid="episode-cover" preview="image" value={draft.coverUrl} onChange={(url) => setDraft((d) => d && { ...d, coverUrl: url })} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Konuk"><input className={inputCls} value={draft.guest} onChange={(e) => setDraft({ ...draft, guest: e.target.value })} data-testid="episode-guest" /></Field>
            <Field label="Süre (sn)"><input className={inputCls} inputMode="numeric" value={draft.durationSec} onChange={(e) => setDraft({ ...draft, durationSec: e.target.value })} data-testid="episode-duration" /></Field>
            <Field label="Bölüm no"><input className={inputCls} inputMode="numeric" value={draft.episodeNo} onChange={(e) => setDraft({ ...draft, episodeNo: e.target.value })} data-testid="episode-no" /></Field>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={draft.notify} onChange={(e) => setDraft({ ...draft, notify: e.target.checked })} data-testid="episode-notify" /> <span>Yayınlarken bülten abonelerine e-posta gönder<span className="block text-xs text-sage-500">Her bölüm için yalnızca bir kez gönderilir.</span></span></label>
          {formError && <p role="alert" data-testid="episode-error" className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <Button tone="primary" disabled={saving} data-testid="episode-publish" onClick={() => save("PUBLISHED")}>{draft.id && draft.status === "PUBLISHED" ? "Kaydet" : "Yayınla"}</Button>
            <Button disabled={saving} data-testid="episode-draft" onClick={() => save("DRAFT")}>Taslak olarak kaydet</Button>
          </div>
        </Drawer>
      )}
      {dialog}
      {toast}
    </div>
  )
}
