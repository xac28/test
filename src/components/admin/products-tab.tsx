"use client"

import { useState } from "react"
import { AlertTriangle, Eye, EyeOff, Package, Pencil, Plus, Star, Trash2, X } from "lucide-react"
import { Button, Drawer, Empty, ErrorNote, Pill, SearchBox, SectionTitle, Segmented, Spinner, Stat, Table, api, useConfirm, useDebounced, useLoader, useToast } from "./ui"
import { Field, UploadField, inputCls } from "./forms"
import { LOW_STOCK, SHOP_CATEGORIES, formatKurus, parseImages } from "@/lib/shop"

interface Draft { id?: string; name: string; summary: string; description: string; category: string; priceTL: string; stock: string; images: string[]; featured: boolean; status: "DRAFT" | "PUBLISHED"; notify: boolean }
const EMPTY: Draft = { name: "", summary: "", description: "", category: SHOP_CATEGORIES[0].slug, priceTL: "", stock: "0", images: [], featured: false, status: "DRAFT", notify: false }

/** Shop products: add, price, stock, pictures, publish; low-stock warning. */
export function ProductsTab({ onChanged }: { onChanged: () => void }) {
  const [category, setCategory] = useState("all")
  const [q, setQ] = useState("")
  const dq = useDebounced(q)
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/products?${new URLSearchParams({ ...(category !== "all" && { category }), ...(dq && { q: dq }) })}`), [category, dq])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()

  const open = (p?: any) => {
    setFormError(null)
    setDraft(p ? { id: p.id, name: p.name, summary: p.summary, description: p.description, category: p.category, priceTL: String(p.priceKurus / 100), stock: String(p.stock), images: parseImages(p.images), featured: p.featured, status: p.status, notify: false } : { ...EMPTY })
  }

  const save = async (status: "DRAFT" | "PUBLISHED") => {
    if (!draft) return
    setSaving(true)
    setFormError(null)
    try {
      const res = await api(draft.id ? `/api/admin/products/${draft.id}` : "/api/admin/products", { method: draft.id ? "PATCH" : "POST", json: { ...draft, status } })
      const n = res.newsletter
      show(status === "PUBLISHED" ? `Yayında${n ? (n.skipped ? " (e-posta ayarı yok: bülten gönderilmedi)" : `, ${n.sent} aboneye e-posta gitti`) : ""}` : "Taslak kaydedildi")
      setDraft(null)
      reload()
      onChanged()
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  const patch = async (p: any, body: object, msg: string) => {
    try { await api(`/api/admin/products/${p.id}`, { method: "PATCH", json: body }); show(msg); reload() } catch (e: any) { show(e.message) }
  }

  return (
    <div className="space-y-4" data-testid="tab-products">
      <SectionTitle title="Ürünler" hint="Shop ürünleri. Yayındaki ürünler /shop sayfasında görünür; stok sipariş verildikçe düşer, iptal edilince geri gelir." actions={<Button tone="primary" data-testid="product-new" onClick={() => open()}><Plus size={15} /> Yeni ürün</Button>} />
      {data && (
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          <Stat label="Ürün" value={data.products.length} />
          <Stat label="Yayında" value={data.products.filter((p: any) => p.status === "PUBLISHED").length} tone="green" />
          <Stat label="Stok azalan" value={data.lowStock} tone={data.lowStock ? "amber" : undefined} hint={`≤ ${LOW_STOCK} adet`} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented testid="product-category" value={category} onChange={setCategory} options={[{ id: "all", label: "Tümü" }, ...SHOP_CATEGORIES.map((c) => ({ id: c.slug, label: c.name.tr }))]} />
        <SearchBox value={q} onChange={setQ} placeholder="Ürün adı…" testid="product-search" />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.products.length === 0 ? <Empty icon={<Package size={32} />}>Bu filtreyle ürün yok.</Empty> : data ? (
        <Table head={["Ürün", "Kategori", "Fiyat", "Stok", "Durum", ""]}>
          {data.products.map((p: any) => (
            <tr key={p.id} data-testid="product-row" className="align-top">
              <td className="px-4 py-3 max-w-sm"><p className="font-medium break-words">{p.name}{p.featured && <Star size={13} className="inline ml-1 text-yellow-600" fill="currentColor" />}</p><p className="text-xs text-sage-500 line-clamp-1">{p.summary}</p></td>
              <td className="px-4 py-3">{SHOP_CATEGORIES.find((c) => c.slug === p.category)?.name.tr ?? p.category}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatKurus(p.priceKurus)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{p.stock <= LOW_STOCK && p.status === "PUBLISHED" ? <Pill tone={p.stock === 0 ? "red" : "amber"}><AlertTriangle size={11} className="inline mr-1" />{p.stock}</Pill> : p.stock}</td>
              <td className="px-4 py-3"><Pill tone={p.status === "PUBLISHED" ? "green" : "gray"}>{p.status === "PUBLISHED" ? "Yayında" : "Taslak"}</Pill></td>
              <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                <Button data-testid="product-toggle" onClick={() => patch(p, { status: p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }, p.status === "PUBLISHED" ? "Yayından kaldırıldı" : "Yayınlandı")}>{p.status === "PUBLISHED" ? <><EyeOff size={14} /> Kaldır</> : <><Eye size={14} /> Yayınla</>}</Button>
                <Button data-testid="product-edit" onClick={() => open(p)}><Pencil size={14} /> Düzenle</Button>
                <Button tone="ghost" data-testid="product-delete" onClick={() => ask({ title: "Ürünü sil", description: `“${p.name}” silinir. Eski siparişler etkilenmez.`, confirmLabel: "Sil", tone: "danger", onConfirm: async () => { await api(`/api/admin/products/${p.id}`, { method: "DELETE" }); show("Silindi"); reload(); onChanged() } })}><Trash2 size={14} /></Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {draft && (
        <Drawer title={draft.id ? "Ürünü düzenle" : "Yeni ürün"} onClose={() => setDraft(null)} testid="product-drawer">
          <Field label="Ürün adı"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={160} data-testid="product-name" /></Field>
          <Field label="Kısa açıklama" hint="Kartlarda ve arama sonuçlarında görünür (10–300 karakter)."><input className={inputCls} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} maxLength={300} data-testid="product-summary" /></Field>
          <Field label="Açıklama"><textarea className={inputCls} rows={5} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} data-testid="product-description" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Kategori"><select className={inputCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} data-testid="product-cat">{SHOP_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name.tr}</option>)}</select></Field>
            <Field label="Fiyat (₺)"><input className={inputCls} inputMode="decimal" value={draft.priceTL} onChange={(e) => setDraft({ ...draft, priceTL: e.target.value })} data-testid="product-price" /></Field>
            <Field label="Stok"><input className={inputCls} inputMode="numeric" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} data-testid="product-stock" /></Field>
          </div>
          <div className="space-y-3">
            <span className="eyebrow block">Görseller (ilki kapak olur)</span>
            {draft.images.map((src, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-12 h-12 rounded-lg object-cover border border-rule" />
                <span className="flex-1 truncate text-xs text-sage-500">{src}</span>
                <button type="button" aria-label="Görseli kaldır" onClick={() => setDraft({ ...draft, images: draft.images.filter((_, j) => j !== i) })} className="p-2 text-sage-500 hover:text-red-600"><X size={15} /></button>
              </div>
            ))}
            {draft.images.length < 8 && <UploadField type="product" accept="image/jpeg,image/png,image/webp" label="Görsel ekle" testid="product-image" value="" onChange={(url) => url && setDraft((d) => d && { ...d, images: [...d.images, url] })} />}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} /> Öne çıkan ürün (Shop ana sayfasında göster)</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={draft.notify} onChange={(e) => setDraft({ ...draft, notify: e.target.checked })} data-testid="product-notify" /> <span>Yayınlarken bülten abonelerine e-posta gönder<span className="block text-xs text-sage-500">Her ürün için yalnızca bir kez gönderilir.</span></span></label>
          {formError && <p role="alert" data-testid="product-error" className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <Button tone="primary" disabled={saving} data-testid="product-publish" onClick={() => save("PUBLISHED")}>{draft.id && draft.status === "PUBLISHED" ? "Kaydet" : "Yayınla"}</Button>
            <Button disabled={saving} data-testid="product-draft" onClick={() => save("DRAFT")}>Taslak olarak kaydet</Button>
          </div>
        </Drawer>
      )}
      {dialog}
      {toast}
    </div>
  )
}
