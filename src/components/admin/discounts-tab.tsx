"use client"

import { useState } from "react"
import { Gift, Megaphone, Plus, Trash2, X } from "lucide-react"
import { Button, Drawer, Empty, ErrorNote, Pill, SearchBox, SectionTitle, Segmented, Spinner, Table, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast } from "./ui"
import { Field, inputCls } from "./forms"

interface DiscountRow {
  id: string; name: string | null; email: string | null; role: "STUDENT" | "TEACHER"; banned: boolean
  discount: { discountPct: number; reason: string | null; endsAt: string | null } | null
}
interface CampaignRow {
  id: string; name: string; discountPct: number; scope: "STUDENTS" | "TEACHERS" | "ALL"
  bannerMessage: string | null; startsAt: string; endsAt: string
}

const SCOPE_LABEL: Record<CampaignRow["scope"], string> = { STUDENTS: "Öğrenciler", TEACHERS: "Öğretmenler", ALL: "Herkes" }
const campaignStatus = (c: CampaignRow) => {
  const now = Date.now()
  if (new Date(c.endsAt).getTime() < now) return { label: "Bitti", tone: "gray" as const }
  if (new Date(c.startsAt).getTime() > now) return { label: "Planlandı", tone: "amber" as const }
  return { label: "Aktif", tone: "green" as const }
}
const toLocalInput = (iso: string) => iso.slice(0, 16)

/** Admin-granted lesson-price breaks: a personal discount/free account for one student or teacher,
 * and scheduled, platform-wide campaigns (New Year's, etc.) that activate automatically by date. */
export function DiscountsTab({ onChanged }: { onChanged: () => void }) {
  return (
    <div className="space-y-10" data-testid="tab-discounts">
      <PersonalDiscountsSection onChanged={onChanged} />
      <CampaignsSection onChanged={onChanged} />
    </div>
  )
}

function PersonalDiscountsSection({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState("")
  const dq = useDebounced(q)
  const [role, setRole] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL")
  const { data, error, loading, reload } = useLoader<{ users: DiscountRow[] }>(
    () => api(`/api/admin/discounts?${new URLSearchParams({ ...(dq && { q: dq }), ...(role !== "ALL" && { role }) })}`),
    [dq, role],
  )
  const [draft, setDraft] = useState<DiscountRow | null>(null)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Kişisel indirim / ücretsiz hesap"
        hint="Bir öğrenci ya da öğretmene ders fiyatında kişisel indirim verin — %100, o hesabı tamamen ücretsiz yapar. Öğretmene verilen indirim, o öğretmenden ders alan herkese yansır (yeni öğretmenleri çekmek için 'ücretsiz deneme dersi' gibi kullanılabilir)."
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="İsim veya e-posta…" testid="discount-search" />
        <Segmented value={role} onChange={setRole} options={[{ id: "ALL", label: "Hepsi" }, { id: "STUDENT", label: "Öğrenciler" }, { id: "TEACHER", label: "Öğretmenler" }]} testid="discount-role" />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.users.length === 0 ? <Empty icon={<Gift size={32} />}>Eşleşen kullanıcı yok.</Empty> : data ? (
        <Table head={["Kullanıcı", "Rol", "İndirim", "Bitiş", ""]}>
          {data.users.map((u) => (
            <tr key={u.id} data-testid="discount-row" className="align-top">
              <td className="px-4 py-3">
                <p className="font-medium">{u.name || "—"}</p>
                <p className="text-xs text-sage-500">{u.email}</p>
              </td>
              <td className="px-4 py-3">{u.role === "TEACHER" ? "Öğretmen" : "Öğrenci"}</td>
              <td className="px-4 py-3">
                {u.discount ? <Pill tone={u.discount.discountPct >= 100 ? "green" : "amber"}>{u.discount.discountPct >= 100 ? "Ücretsiz hesap" : `%${u.discount.discountPct} indirim`}</Pill> : <span className="text-xs text-sage-400">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-sage-500 whitespace-nowrap">{u.discount?.endsAt ? fmtDateTime(u.discount.endsAt) : u.discount ? "Süresiz" : "—"}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                <Button data-testid="discount-grant" onClick={() => setDraft(u)}><Gift size={14} /> {u.discount ? "Düzenle" : "İndirim ver"}</Button>
                {u.discount && (
                  <Button tone="ghost" data-testid="discount-cancel" onClick={() => ask({
                    title: "İndirimi iptal et", description: `“${u.name || u.email}” için tanımlı indirim kaldırılacak.`, confirmLabel: "İptal et", tone: "danger",
                    onConfirm: async () => { await api(`/api/admin/discounts/${u.id}`, { method: "DELETE" }); show("İndirim iptal edildi"); reload(); onChanged() },
                  })}><Trash2 size={14} /></Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {draft && <DiscountDrawer row={draft} onClose={() => setDraft(null)} onSaved={() => { reload(); onChanged() }} />}
      {dialog}
      {toast}
    </div>
  )
}

function DiscountDrawer({ row, onClose, onSaved }: { row: DiscountRow; onClose: () => void; onSaved: () => void }) {
  const [pct, setPct] = useState(row.discount ? String(row.discount.discountPct) : "100")
  const [reason, setReason] = useState(row.discount?.reason ?? "")
  const [endsAt, setEndsAt] = useState(row.discount?.endsAt ? toLocalInput(row.discount.endsAt) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api("/api/admin/discounts", { method: "POST", json: { userId: row.id, discountPct: Number(pct.replace(",", ".")), reason, endsAt: endsAt || null } })
      onSaved()
      onClose()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <Drawer title={`${row.name || row.email} — indirim`} subtitle={row.role === "TEACHER" ? "Bu öğretmenden ders alan herkese yansır." : "Bu öğrencinin kendi ders ücretine uygulanır."} onClose={onClose} testid="discount-drawer">
      <Field label="İndirim oranı (%)" hint="100 = tamamen ücretsiz hesap."><input className={inputCls} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} data-testid="discount-pct" /></Field>
      <Field label="Not (opsiyonel)" hint="Yalnızca yönetim panelinde görünür."><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="örn. Yeni eğitmen tanıtımı" data-testid="discount-reason" /></Field>
      <Field label="Bitiş tarihi (opsiyonel)" hint="Boş bırakılırsa, siz iptal edene kadar sürer."><input className={inputCls} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} data-testid="discount-ends-at" /></Field>
      {error && <p role="alert" data-testid="discount-error" className="text-sm text-red-600">{error}</p>}
      <Button tone="primary" disabled={saving} data-testid="discount-save" onClick={save}>Kaydet</Button>
    </Drawer>
  )
}

const EMPTY_CAMPAIGN = { name: "", discountPct: "20", scope: "ALL" as CampaignRow["scope"], bannerMessage: "", startsAt: "", endsAt: "" }

function CampaignsSection({ onChanged }: { onChanged: () => void }) {
  const { data, error, loading, reload } = useLoader<{ campaigns: CampaignRow[] }>(() => api("/api/admin/campaigns"), [])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY_CAMPAIGN)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()

  const create = async () => {
    setSaving(true)
    setFormError(null)
    try {
      await api("/api/admin/campaigns", { method: "POST", json: { ...draft, discountPct: Number(draft.discountPct.replace(",", ".")) } })
      show("Kampanya oluşturuldu")
      setOpen(false)
      setDraft(EMPTY_CAMPAIGN)
      reload()
      onChanged()
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  const endEarly = (c: CampaignRow) => ask({
    title: "Kampanyayı şimdi bitir", description: `“${c.name}” kampanyası hemen sona erdirilecek.`, confirmLabel: "Şimdi bitir", tone: "danger",
    onConfirm: async () => { await api(`/api/admin/campaigns/${c.id}`, { method: "PATCH", json: { endsAt: new Date().toISOString() } }); show("Kampanya bitirildi"); reload(); onChanged() },
  })
  const remove = (c: CampaignRow) => ask({
    title: "Kampanyayı sil", description: `“${c.name}” tamamen silinecek.`, confirmLabel: "Sil", tone: "danger",
    onConfirm: async () => { await api(`/api/admin/campaigns/${c.id}`, { method: "DELETE" }); show("Kampanya silindi"); reload(); onChanged() },
  })

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Toplu kampanya (yılbaşı, özel günler…)"
        hint="Tarih aralığı verin; kampanya o tarihe gelince kendiliğinden devreye girer ve sitede duyurulur, bitiş tarihinde kendiliğinden sona erer. Ders fiyatını yalnızca 'Öğrenciler' veya 'Herkes' kapsamı indirir; 'Öğretmenler' kapsamı şimdilik yalnızca duyuru/etiketleme amaçlıdır."
        actions={<Button tone="primary" data-testid="campaign-new" onClick={() => { setDraft(EMPTY_CAMPAIGN); setFormError(null); setOpen(true) }}><Plus size={15} /> Yeni kampanya</Button>}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.campaigns.length === 0 ? <Empty icon={<Megaphone size={32} />}>Henüz kampanya yok.</Empty> : data ? (
        <Table head={["Kampanya", "Kapsam", "İndirim", "Tarih aralığı", "Durum", ""]}>
          {data.campaigns.map((c) => {
            const st = campaignStatus(c)
            return (
              <tr key={c.id} data-testid="campaign-row" className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  {c.bannerMessage && <p className="text-xs text-sage-500">{c.bannerMessage}</p>}
                </td>
                <td className="px-4 py-3">{SCOPE_LABEL[c.scope]}</td>
                <td className="px-4 py-3">%{c.discountPct}</td>
                <td className="px-4 py-3 text-xs text-sage-500 whitespace-nowrap">{fmtDateTime(c.startsAt)} → {fmtDateTime(c.endsAt)}</td>
                <td className="px-4 py-3"><Pill tone={st.tone}>{st.label}</Pill></td>
                <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                  {st.label === "Aktif" && <Button tone="ghost" data-testid="campaign-end" onClick={() => endEarly(c)}><X size={14} /> Bitir</Button>}
                  <Button tone="ghost" data-testid="campaign-delete" onClick={() => remove(c)}><Trash2 size={14} /></Button>
                </td>
              </tr>
            )
          })}
        </Table>
      ) : null}

      {open && (
        <Drawer title="Yeni kampanya" onClose={() => setOpen(false)} testid="campaign-drawer">
          <Field label="Kampanya adı"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="örn. Yılbaşı Kampanyası" data-testid="campaign-name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="İndirim oranı (%)"><input className={inputCls} inputMode="decimal" value={draft.discountPct} onChange={(e) => setDraft({ ...draft, discountPct: e.target.value })} data-testid="campaign-pct" /></Field>
            <Field label="Kapsam">
              <select className={inputCls} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as CampaignRow["scope"] })} data-testid="campaign-scope">
                <option value="ALL">Herkes</option>
                <option value="STUDENTS">Yalnızca öğrenciler</option>
                <option value="TEACHERS">Yalnızca öğretmenler</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Başlangıç"><input className={inputCls} type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} data-testid="campaign-starts" /></Field>
            <Field label="Bitiş"><input className={inputCls} type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} data-testid="campaign-ends" /></Field>
          </div>
          <Field label="Site duyuru metni (opsiyonel)" hint="Kampanya aktifken sitede üst şeritte gösterilir."><input className={inputCls} value={draft.bannerMessage} onChange={(e) => setDraft({ ...draft, bannerMessage: e.target.value })} placeholder="örn. Yılbaşına özel derslerde %20 indirim!" data-testid="campaign-banner" /></Field>
          {formError && <p role="alert" data-testid="campaign-error" className="text-sm text-red-600">{formError}</p>}
          <Button tone="primary" disabled={saving} data-testid="campaign-save" onClick={create}>Oluştur</Button>
        </Drawer>
      )}
      {dialog}
      {toast}
    </div>
  )
}
