"use client"

import { useState } from "react"
import { Package, PackageCheck, Truck } from "lucide-react"
import { Button, Drawer, DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, SectionTitle, Segmented, Spinner, Stat, Table, ago, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast } from "./ui"
import { Field, inputCls } from "./forms"
import { ORDER_STATUS_LABEL, OrderStatusId, PAY_METHOD_LABEL, formatKurus, nextStatuses } from "@/lib/shop"

const TONE: Record<OrderStatusId, string> = { PENDING_PAYMENT: "amber", PAID: "blue", SHIPPED: "blue", DELIVERED: "green", CANCELLED: "red" }

/** Shop orders: payment confirmation, shipping with tracking number, cancelling (stock goes back), CSV export. */
export function OrdersTab({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState("all")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/orders?${new URLSearchParams({ status, page: String(page), ...(dq && { q: dq }) })}`), [status, dq, page])
  const [open, setOpen] = useState<any | null>(null)
  const [tracking, setTracking] = useState("")
  const [note, setNote] = useState("")
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const c = data?.statusCounts ?? {}

  const move = async (o: any, to: OrderStatusId, extra: object = {}) => {
    try {
      const res = await api(`/api/admin/orders/${o.id}`, { method: "POST", json: { status: to, trackingNo: tracking, adminNote: note, ...extra } })
      show(`${o.code}: ${ORDER_STATUS_LABEL[to]}`)
      setOpen(res.order)
      reload()
      onChanged()
    } catch (e: any) { show(e.message) }
  }
  const view = (o: any) => { setOpen(o); setTracking(o.trackingNo ?? ""); setNote(o.adminNote ?? "") }

  return (
    <div className="space-y-4" data-testid="tab-orders">
      <SectionTitle title="Siparişler" hint="Havale/EFT siparişlerinde ödemeyi onaylayın, kargoya verirken takip numarası girin. Müşteri her adımda e-posta alır; iptalde stok geri döner; 3 gün ödenmeyen havale siparişleri otomatik iptal edilir." actions={<DownloadCsv href={`/api/admin/orders?format=csv&status=${status}`} />} />
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
          <Stat label="Ödeme bekleyen" value={c.PENDING_PAYMENT ?? 0} tone={c.PENDING_PAYMENT ? "amber" : undefined} />
          <Stat label="Hazırlanacak" value={c.PAID ?? 0} tone={c.PAID ? "amber" : undefined} />
          <Stat label="Kargoda" value={c.SHIPPED ?? 0} />
          <Stat label="Ciro (ödenen)" value={formatKurus(data.revenueKurus)} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented testid="order-status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ id: "all", label: "Tümü" }, ...(Object.keys(ORDER_STATUS_LABEL) as OrderStatusId[]).map((s) => ({ id: s, label: ORDER_STATUS_LABEL[s], count: c[s] }))]} />
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Sipariş no, ad, e-posta, telefon…" testid="order-search" />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.orders.length === 0 ? <Empty icon={<Package size={32} />}>Bu filtreyle sipariş yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Sipariş", "Müşteri", "Ürünler", "Tutar", "Durum", "Zaman"]}>
            {data.orders.map((o: any) => (
              <tr key={o.id} data-testid="order-row" className="align-top cursor-pointer hover:bg-sage-50" onClick={() => view(o)}>
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{o.code}</td>
                <td className="px-4 py-3"><p className="font-medium">{o.name}</p><p className="text-xs text-sage-500">{o.city}</p></td>
                <td className="px-4 py-3 text-xs max-w-[16rem]">{o.items.map((i: any) => `${i.name} ×${i.quantity}`).join(", ")}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatKurus(o.totalKurus)}<p className="text-xs text-sage-500">{PAY_METHOD_LABEL[o.payMethod]}</p></td>
                <td className="px-4 py-3"><Pill tone={TONE[o.status as OrderStatusId]}>{ORDER_STATUS_LABEL[o.status as OrderStatusId]}</Pill></td>
                <td className="px-4 py-3 text-xs text-sage-500 whitespace-nowrap" title={fmtDateTime(o.createdAt)}>{ago(o.createdAt)}</td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}

      {open && (
        <Drawer title={open.code} subtitle={<Pill tone={TONE[open.status as OrderStatusId]}>{ORDER_STATUS_LABEL[open.status as OrderStatusId]}</Pill>} onClose={() => setOpen(null)} testid="order-drawer">
          <section className="text-sm space-y-1">
            <p className="font-semibold">{open.name}</p>
            <p><a className="underline" href={`mailto:${open.email}`}>{open.email}</a> · <a className="underline" href={`tel:${open.phone}`}>{open.phone}</a></p>
            <p className="whitespace-pre-line">{open.address}, {open.city}</p>
            {open.note && <p className="text-sage-600">Not: {open.note}</p>}
            <p className="text-sage-500">{PAY_METHOD_LABEL[open.payMethod]} · {fmtDateTime(open.createdAt)}</p>
          </section>
          <ul className="divide-y divide-rule text-sm border-y border-rule">
            {open.items.map((i: any) => <li key={i.id} className="flex justify-between py-2"><span>{i.name} × {i.quantity}</span><span>{formatKurus(i.unitKurus * i.quantity)}</span></li>)}
            <li className="flex justify-between py-2"><span>Kargo</span><span>{open.shippingKurus ? formatKurus(open.shippingKurus) : "Ücretsiz"}</span></li>
            <li className="flex justify-between py-2 font-semibold"><span>Toplam</span><span>{formatKurus(open.totalKurus)}</span></li>
          </ul>
          <Field label="Kargo takip no" hint="Kargoya verirken zorunlu."><input className={inputCls} value={tracking} onChange={(e) => setTracking(e.target.value)} data-testid="order-tracking" /></Field>
          <Field label="Yönetici notu (müşteri görmez)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} data-testid="order-note" /></Field>
          <div className="flex flex-wrap gap-2">
            {nextStatuses(open.status, open.payMethod).map((to) => to === "CANCELLED" ? (
              <Button key={to} tone="danger" data-testid="order-cancel" onClick={() => ask({ title: "Siparişi iptal et", description: "Stok geri eklenir ve müşteriye e-posta gider.", confirmLabel: "İptal et", tone: "danger", onConfirm: async () => { await move(open, to) } })}>İptal et</Button>
            ) : (
              <Button key={to} tone="primary" data-testid={`order-to-${to}`} onClick={() => move(open, to)}>{to === "PAID" ? <PackageCheck size={15} /> : to === "SHIPPED" ? <Truck size={15} /> : null} {to === "PAID" ? "Ödemeyi onayla" : to === "SHIPPED" ? "Kargoya ver" : to === "DELIVERED" ? "Teslim edildi" : ORDER_STATUS_LABEL[to]}</Button>
            ))}
            <Button data-testid="order-save-note" onClick={async () => { try { const r = await api(`/api/admin/orders/${open.id}`, { method: "POST", json: { trackingNo: tracking, adminNote: note } }); setOpen(r.order); reload(); show("Kaydedildi") } catch (e: any) { show(e.message) } }}>Notu kaydet</Button>
          </div>
        </Drawer>
      )}
      {dialog}
      {toast}
    </div>
  )
}
