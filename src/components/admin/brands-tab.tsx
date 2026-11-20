"use client"

import { useState } from "react"
import { Banknote, Handshake, Pencil, Plus, Trash2 } from "lucide-react"
import { Button, Drawer, Empty, ErrorNote, Pill, SearchBox, SectionTitle, Spinner, Stat, Table, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast } from "./ui"
import { Field, inputCls } from "./forms"
import { formatKurus } from "@/lib/shop"

interface BrandRow { id: string; name: string; contactName: string | null; contactEmail: string | null; contactPhone: string | null; commissionRate: number; iban: string | null; accountName: string | null; active: boolean; _count: { products: number } }
interface BrandDetail {
  brand: BrandRow & { products: { id: string; name: string; status: string; priceKurus: number; stock: number }[] }
  earnedKurus: number; claimedKurus: number; availableKurus: number
  payouts: { id: string; amountKurus: number; note: string | null; paidAt: string }[]
}

interface Draft { id?: string; name: string; contactName: string; contactEmail: string; contactPhone: string; commissionRatePct: string; iban: string; accountName: string; active: boolean }
const EMPTY: Draft = { name: "", contactName: "", contactEmail: "", contactPhone: "", commissionRatePct: "20", iban: "", accountName: "", active: true }

/** Brand partners (mat, aromatherapy-oil brands, …): onboard them, link their products, see what they're owed and record what was paid. */
export function BrandsTab({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState("")
  const dq = useDebounced(q)
  const { data, error, loading, reload } = useLoader<{ brands: BrandRow[] }>(() => api(`/api/admin/brands?${new URLSearchParams({ ...(dq && { q: dq }) })}`), [dq])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()

  const openEdit = (b?: BrandRow) => {
    setFormError(null)
    setDraft(b ? { id: b.id, name: b.name, contactName: b.contactName ?? "", contactEmail: b.contactEmail ?? "", contactPhone: b.contactPhone ?? "", commissionRatePct: String(Math.round(b.commissionRate * 1000) / 10), iban: b.iban ?? "", accountName: b.accountName ?? "", active: b.active } : { ...EMPTY })
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    setFormError(null)
    try {
      const body = { name: draft.name, contactName: draft.contactName, contactEmail: draft.contactEmail, contactPhone: draft.contactPhone, commissionRate: Number(draft.commissionRatePct.replace(",", ".")) / 100, iban: draft.iban, accountName: draft.accountName, active: draft.active }
      await api(draft.id ? `/api/admin/brands/${draft.id}` : "/api/admin/brands", { method: draft.id ? "PATCH" : "POST", json: body })
      show(draft.id ? "Marka güncellendi" : "Marka eklendi")
      setDraft(null)
      reload()
      onChanged()
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4" data-testid="tab-brands">
      <SectionTitle title="Markalar" hint="Shop'ta satılan ortak marka ürünleri (mat, aromaterapi yağı vb.). Her markanın komisyon oranı burada belirlenir; ürün eklerken markasını seçersiniz." actions={<Button tone="primary" data-testid="brand-new" onClick={() => openEdit()}><Plus size={15} /> Yeni marka</Button>} />
      <SearchBox value={q} onChange={setQ} placeholder="Marka adı…" testid="brand-search" />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.brands.length === 0 ? <Empty icon={<Handshake size={32} />}>Henüz marka eklenmedi.</Empty> : data ? (
        <Table head={["Marka", "İletişim", "Komisyon", "Ürün", "Durum", ""]}>
          {data.brands.map((b) => (
            <tr key={b.id} data-testid="brand-row" className="align-top">
              <td className="px-4 py-3 font-medium">{b.name}</td>
              <td className="px-4 py-3 text-xs text-sage-500">{b.contactName}{b.contactName && b.contactEmail && " · "}{b.contactEmail}</td>
              <td className="px-4 py-3 whitespace-nowrap">%{Math.round(b.commissionRate * 100)}</td>
              <td className="px-4 py-3">{b._count.products}</td>
              <td className="px-4 py-3"><Pill tone={b.active ? "green" : "gray"}>{b.active ? "Aktif" : "Pasif"}</Pill></td>
              <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                <Button data-testid="brand-balance" onClick={() => setOpenId(b.id)}><Banknote size={14} /> Bakiye</Button>
                <Button data-testid="brand-edit" onClick={() => openEdit(b)}><Pencil size={14} /> Düzenle</Button>
                {b.active && (
                  <Button tone="ghost" data-testid="brand-deactivate" onClick={() => ask({ title: "Markayı pasifleştir", description: `“${b.name}” artık ürün formunda seçilemez. Mevcut ürünleri etkilenmez; dilerseniz onları da ayrıca taslağa alın.`, confirmLabel: "Pasifleştir", tone: "danger", onConfirm: async () => { await api(`/api/admin/brands/${b.id}`, { method: "DELETE" }); show("Pasifleştirildi"); reload() } })}><Trash2 size={14} /></Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {draft && (
        <Drawer title={draft.id ? "Markayı düzenle" : "Yeni marka"} onClose={() => setDraft(null)} testid="brand-drawer">
          <Field label="Marka adı"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} data-testid="brand-name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Yetkili adı"><input className={inputCls} value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} data-testid="brand-contact-name" /></Field>
            <Field label="Yetkili e-posta"><input className={inputCls} type="email" value={draft.contactEmail} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} data-testid="brand-contact-email" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Yetkili telefon"><input className={inputCls} value={draft.contactPhone} onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })} data-testid="brand-contact-phone" /></Field>
            <Field label="AYA komisyonu (%)" hint="Her satıştan AYA'nın alacağı pay; kalanı markaya aittir."><input className={inputCls} inputMode="decimal" value={draft.commissionRatePct} onChange={(e) => setDraft({ ...draft, commissionRatePct: e.target.value })} data-testid="brand-commission" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IBAN" hint="Ödeme kaydederken hatırlatma amaçlı; para burada otomatik gitmez."><input className={inputCls} value={draft.iban} onChange={(e) => setDraft({ ...draft, iban: e.target.value })} placeholder="TR.." data-testid="brand-iban" /></Field>
            <Field label="Hesap sahibi"><input className={inputCls} value={draft.accountName} onChange={(e) => setDraft({ ...draft, accountName: e.target.value })} data-testid="brand-account-name" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Aktif (ürün formunda seçilebilir)</label>
          {formError && <p role="alert" data-testid="brand-error" className="text-sm text-red-600">{formError}</p>}
          <Button tone="primary" disabled={saving} data-testid="brand-save" onClick={save}>{draft.id ? "Kaydet" : "Ekle"}</Button>
        </Drawer>
      )}

      {openId && <BrandBalanceDrawer brandId={openId} onClose={() => setOpenId(null)} onPaid={() => { onChanged() }} />}
      {dialog}
      {toast}
    </div>
  )
}

function BrandBalanceDrawer({ brandId, onClose, onPaid }: { brandId: string; onClose: () => void; onPaid: () => void }) {
  const { data, error, loading, reload } = useLoader<BrandDetail>(() => api(`/api/admin/brands/${brandId}`), [brandId])
  const [amountTL, setAmountTL] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { show, toast } = useToast()

  const recordPayout = async () => {
    setSaving(true)
    setFormError(null)
    try {
      const tl = Number(amountTL.replace(",", "."))
      await api(`/api/admin/brands/${brandId}/payouts`, { method: "POST", json: { amountKurus: Math.round(tl * 100), note } })
      show("Ödeme kaydedildi")
      setAmountTL("")
      setNote("")
      reload()
      onPaid()
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  return (
    <Drawer title={data ? `${data.brand.name} — bakiye` : "Bakiye"} onClose={onClose} testid="brand-balance-drawer">
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Toplam hak ediş" value={formatKurus(data.earnedKurus)} hint="Ödenmiş/kargodaki/teslim edilen siparişlerden, komisyon düşülmüş" />
            <Stat label="Ödenen" value={formatKurus(data.claimedKurus)} />
            <Stat label="Çekilebilir bakiye" value={formatKurus(data.availableKurus)} tone={data.availableKurus > 0 ? "green" : undefined} data-testid="brand-available" />
          </div>

          <div className="rounded-xl border border-rule p-4 space-y-3">
            <p className="text-sm font-semibold">Ödeme kaydet</p>
            <p className="text-xs text-sage-500">Markaya bankadan havale gönderdikten sonra burada kaydedin; sistem herhangi bir ödeme göndermez.{data.brand.iban && <> IBAN: <span className="font-mono">{data.brand.iban}</span>{data.brand.accountName && ` (${data.brand.accountName})`}</>}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tutar (₺)"><input className={inputCls} inputMode="decimal" value={amountTL} onChange={(e) => setAmountTL(e.target.value)} data-testid="brand-payout-amount" /></Field>
              <Field label="Not (opsiyonel)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} data-testid="brand-payout-note" /></Field>
            </div>
            {formError && <p role="alert" data-testid="brand-payout-error" className="text-sm text-red-600">{formError}</p>}
            <Button tone="primary" disabled={saving || !amountTL} data-testid="brand-payout-save" onClick={recordPayout}>Kaydet</Button>
          </div>

          <div>
            <p className="eyebrow mb-2">Ödeme geçmişi</p>
            {data.payouts.length === 0 ? <p className="text-sm text-sage-500">Henüz ödeme kaydedilmedi.</p> : (
              <Table head={["Tutar", "Not", "Tarih"]}>
                {data.payouts.map((p) => (
                  <tr key={p.id} data-testid="brand-payout-row">
                    <td className="px-4 py-2.5">{formatKurus(p.amountKurus)}</td>
                    <td className="px-4 py-2.5 text-sage-500">{p.note || "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-sage-500">{fmtDateTime(p.paidAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>

          <div>
            <p className="eyebrow mb-2">Ürünleri ({data.brand.products.length})</p>
            {data.brand.products.length === 0 ? <p className="text-sm text-sage-500">Bu markaya henüz ürün bağlanmadı. Ürün formunda "Marka" alanından seçebilirsiniz.</p> : (
              <ul className="divide-y divide-rule border-y border-rule text-sm">
                {data.brand.products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-sage-500 shrink-0">{formatKurus(p.priceKurus)} · {p.status === "PUBLISHED" ? "Yayında" : "Taslak"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
      {toast}
    </Drawer>
  )
}
