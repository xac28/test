"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bot, CheckCircle2, Lock, LifeBuoy, RotateCcw, Send, Star, UserCheck } from "lucide-react"
import { SOURCE_LABEL_TR } from "@/lib/support"
import { TeachDialog, TeachInit } from "./ai-tab"
import { Button, Card, Drawer, DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, Segmented, SectionTitle, Select, Spinner, Stat, Table, ago, api, fmtDateTime, useDebounced, useLoader, useToast } from "./ui"

const CANNED: { label: string; text: string }[] = [
  { label: "Karşılama", text: "Merhaba, AYA destek ekibi olarak yardımcı olmaktan memnuniyet duyarız. Sorununuzu inceliyorum, birkaç dakika içinde döneceğim." },
  { label: "Daha fazla bilgi", text: "Konuyu netleştirebilmem için hangi sayfada/ders ya da yayında bu durumu yaşadığınızı ve yaklaşık saatini yazabilir misiniz?" },
  { label: "Ödeme / iade", text: "Ödeme ve iade talepleriniz 2-3 iş günü içinde incelenir. İşlem numaranızı ve ödeme tarihini yazarsanız hızlandırabilirim." },
  { label: "Teknik sorun", text: "Yaşadığınız sorun için üzgünüz. Tarayıcınızı yenileyip kamera/mikrofon izinlerini kontrol eder misiniz? Sorun sürerse cihaz ve tarayıcı bilginizi yazın." },
  { label: "Kapanış", text: "Başka bir sorunuz yoksa görüşmeyi kapatıyorum. Yeniden yazmaktan çekinmeyin. İyi pratikler! 🙏" },
]

interface Row {
  id: string; subject: string; source: string; status: string; priority: string; awaitingStaff: boolean; assignedToId: string | null
  createdAt: string; lastMessageAt: string; messageCount: number; rating: number | null; user: { id: string; name: string | null; email: string | null }
}

export function SupportTab({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [status, setStatus] = useState("waiting")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const dq = useDebounced(q)
  const qs = new URLSearchParams({ status, ...(dq && { q: dq }) })
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/support?${qs}&page=${page}`), [status, dq, page])

  // the queue refreshes itself: new messages from members must not wait for a manual reload
  useEffect(() => {
    const t = setInterval(reload, 15_000)
    return () => clearInterval(t)
  }, [reload])

  const st = data?.stats
  return (
    <div className="space-y-5" data-testid="tab-support">
      <SectionTitle title="Canlı destek" hint="Üyelerin Rehber üzerinden ya da doğrudan açtığı görüşmeler. Yanıtlar üyeye anında iletilir ve zil bildirimi gönderilir." actions={<DownloadCsv href={`/api/admin/support?${qs}&format=csv`} />} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Yanıt bekleyen" value={st?.waiting ?? "—"} tone={st?.waiting ? "amber" : undefined} />
        <Stat label="Açık görüşme" value={st?.open ?? "—"} />
        <Stat label="Ort. ilk yanıt" value={st?.avgFirstReplyMin == null ? "—" : `${st.avgFirstReplyMin} dk`} />
        <Stat label="Memnuniyet" value={st?.avgRating ? `${st.avgRating}/5` : "—"} hint={st ? `${st.ratedCount} puan` : undefined} tone={st?.avgRating && st.avgRating < 3.5 ? "red" : "green"} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented testid="support-status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
          { id: "waiting", label: "Yanıt bekleyen", count: st?.waiting }, { id: "open", label: "Açık", count: st?.open }, { id: "mine", label: "Benim" }, { id: "closed", label: "Kapalı", count: st?.closed }, { id: "all", label: "Tümü" },
        ]} />
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Üye, e-posta veya konu…" testid="support-search" />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.tickets.length === 0 ? (
        <Empty icon={<LifeBuoy size={32} />}>{status === "waiting" ? "Yanıt bekleyen görüşme yok. 🎉" : "Bu filtreyle eşleşen görüşme yok."}</Empty>
      ) : data ? (
        <div>
          <Table head={["Üye", "Konu", "Kaynak", "Son mesaj", "Durum"]}>
            {data.tickets.map((t: Row) => (
              <tr key={t.id} data-testid="support-row" onClick={() => setOpenId(t.id)} className="hover:bg-sage-50 cursor-pointer align-top">
                <td className="px-4 py-3"><p className="font-medium text-ink">{t.user.name ?? "—"}</p><p className="text-xs text-sage-500">{t.user.email}</p></td>
                <td className="px-4 py-3 max-w-xs"><p className="line-clamp-2">{t.subject}</p><p className="text-xs text-sage-500">{t.messageCount} mesaj</p></td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-600">{SOURCE_LABEL_TR[t.source] ?? t.source}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500" title={fmtDateTime(t.lastMessageAt)}>{ago(t.lastMessageAt)}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {t.status === "CLOSED" ? <Pill tone="gray">Kapalı{t.rating ? ` · ${t.rating}★` : ""}</Pill> : t.awaitingStaff ? <Pill tone="amber">Yanıt bekliyor</Pill> : <Pill tone="green">Yanıtlandı</Pill>}
                    {t.priority === "HIGH" && <Pill tone="red">Yüksek</Pill>}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {openId && <TicketDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => { reload(); onChanged() }} onOpenUser={(id) => { setOpenId(null); onOpenUser(id) }} />}
    </div>
  )
}

function TicketDrawer({ id, onClose, onChanged, onOpenUser }: { id: string; onClose: () => void; onChanged: () => void; onOpenUser: (id: string) => void }) {
  const { data, error, reload, setData } = useLoader<any>(() => api(`/api/admin/support/${id}`), [id])
  const [text, setText] = useState("")
  const [note, setNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [teach, setTeach] = useState<TeachInit | null>(null)
  const { show, toast } = useToast()
  const endRef = useRef<HTMLDivElement>(null)
  const count = data?.messages?.length ?? 0

  // new messages from the member arrive while the drawer is open
  const lastAt = data?.messages?.length ? data.messages[data.messages.length - 1].createdAt : null
  useEffect(() => {
    if (!data || data.ticket.status !== "OPEN") return
    const t = setInterval(async () => {
      try {
        const d = await api<any>(`/api/admin/support/${id}${lastAt ? `?after=${encodeURIComponent(lastAt)}` : ""}`)
        if (d.messages.length) setData((cur: any) => cur && { ...cur, ticket: d.ticket, messages: [...cur.messages, ...d.messages.filter((m: any) => !cur.messages.some((x: any) => x.id === m.id))] })
        else if (d.ticket.awaitingStaff !== data.ticket.awaitingStaff) setData((cur: any) => cur && { ...cur, ticket: d.ticket })
      } catch {}
    }, 4000)
    return () => clearInterval(t)
  }, [id, lastAt, data?.ticket.status]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [count])

  const act = useCallback(async (body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try {
      const r = await api<any>(`/api/admin/support/${id}`, { method: "POST", json: body })
      show(ok)
      if (r.message) setData((cur: any) => cur && { ...cur, messages: [...cur.messages, r.message] })
      else await reload()
      onChanged()
      return true
    } catch (e: any) {
      show(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }, [id, onChanged, reload, setData, show])

  if (!data) return <Drawer title="Destek görüşmesi" onClose={onClose} testid="support-drawer">{error ? <ErrorNote message={error} onRetry={reload} /> : <Spinner />}</Drawer>
  const t = data.ticket
  const closed = t.status === "CLOSED"
  const send = async () => {
    if (!text.trim()) return
    if (await act({ action: note ? "note" : "reply", content: text }, note ? "Not eklendi" : "Yanıt gönderildi")) setText("")
  }
  const lastStaff = [...data.messages].reverse().find((m: any) => m.role === "STAFF")

  return (
    <Drawer title={data.user.name ?? "Üye"} subtitle={<span>{data.user.email} · {t.sourceLabel}</span>} onClose={onClose} testid="support-drawer">
      <div className="flex flex-wrap items-center gap-2">
        {closed ? <Pill tone="gray">Kapalı</Pill> : t.awaitingStaff ? <Pill tone="amber">Yanıt bekliyor</Pill> : <Pill tone="green">Yanıtlandı</Pill>}
        {t.assignedToName && <Pill tone="indigo">{t.assignedToName}</Pill>}
        {data.openReportsAgainstUser > 0 && <Pill tone="red">{data.openReportsAgainstUser} açık rapor</Pill>}
        {data.user.banned && <Pill tone="red">Yasaklı</Pill>}
        {t.rating && <Pill tone="green"><Star size={11} /> {t.rating}/5</Pill>}
        <button className="text-xs underline ml-auto" onClick={() => onOpenUser(data.user.id)}>Üyeyi aç</button>
      </div>

      <div className="rounded-xl border border-rule bg-paper max-h-[22rem] overflow-y-auto p-4 space-y-3" data-testid="support-thread" role="log">
        {data.messages.map((m: any) =>
          m.role === "SYSTEM" ? <p key={m.id} className="text-center text-xs text-sage-500">{m.content}</p> : (
            <div key={m.id} data-testid={`thread-${m.role.toLowerCase()}`} className={`flex ${m.role === "USER" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-line break-words ${m.role === "USER" ? "bg-sage-100 text-ink" : m.role === "NOTE" ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-ink text-cream"}`}>
                <span className="block text-xs font-bold opacity-70 mb-0.5">{m.role === "USER" ? data.user.name ?? "Üye" : m.role === "NOTE" ? <><Lock size={9} className="inline" /> İç not · {m.senderName ?? "Yetkili"}</> : m.senderName ?? "Yetkili"}</span>
                {m.content}
                <span className="block text-xs opacity-60 mt-1">{fmtDateTime(m.createdAt)}</span>
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {closed ? (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => act({ action: "reopen" }, "Yeniden açıldı")} disabled={busy} data-testid="support-reopen"><RotateCcw size={14} /> Yeniden aç</Button>
          {t.ratingComment && <p className="text-sm text-sage-600 w-full">Üyenin notu: “{t.ratingComment}”</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select label="Hazır yanıt" value="" onChange={(v) => { const c = CANNED[Number(v)]; if (c) setText((cur) => (cur ? cur + "\n" : "") + c.text) }} testid="support-canned">
              <option value="">Hazır yanıt ekle…</option>
              {CANNED.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
            </Select>
            <label className="inline-flex items-center gap-1.5 text-xs text-sage-600"><input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} data-testid="support-note-toggle" /> İç not (üye görmez)</label>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={3} placeholder={note ? "Yalnızca yöneticilerin göreceği not…" : "Üyeye yanıtınız…"} data-testid="support-reply" className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none ${note ? "bg-amber-50 border-amber-300" : "bg-white border-rule focus:border-ink"}`} />
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="primary" onClick={send} disabled={busy || !text.trim()} data-testid="support-send-reply"><Send size={14} /> {note ? "Notu ekle" : "Yanıtla"}</Button>
            {!t.assignedToId && <Button onClick={() => act({ action: "assign" }, "Üstlenildi")} disabled={busy}><UserCheck size={14} /> Üstlen</Button>}
            <Select label="Öncelik" value={t.priority} onChange={(v) => act({ action: "priority", priority: v }, "Öncelik güncellendi")}>
              <option value="LOW">Düşük</option><option value="NORMAL">Normal</option><option value="HIGH">Yüksek</option>
            </Select>
            <Button onClick={() => act({ action: "close" }, "Görüşme kapatıldı")} disabled={busy} data-testid="support-close-ticket" className="ml-auto"><CheckCircle2 size={14} /> Kapat</Button>
          </div>
        </div>
      )}

      <Card className="p-4 text-sm space-y-2">
        <h4 className="text-xs font-bold text-sage-500 flex items-center gap-1.5"><Bot size={13} /> Rehber ile geçmiş</h4>
        {data.interactions.length === 0 ? <p className="text-sage-500">Bu üyenin Rehber kaydı yok.</p> : (
          <ul className="space-y-1">
            {data.interactions.map((i: any) => (
              <li key={i.id} className="flex items-center gap-2"><span className="truncate flex-1">{i.message}</span>{i.helpful === false && <Pill tone="red">👎</Pill>}{i.kind === "unknown" && <Pill tone="amber">bilinmiyor</Pill>}</li>
            ))}
          </ul>
        )}
        <Button onClick={() => setTeach({ question: t.subject, answer: lastStaff?.content ?? "" })} data-testid="support-teach"><Bot size={14} /> Bu cevabı Rehber'e öğret</Button>
        <p className="text-xs text-sage-500">{data.otherTickets} önceki görüşme · açılış {fmtDateTime(t.createdAt)}</p>
      </Card>
      {teach && <TeachDialog init={teach} onClose={() => setTeach(null)} onDone={show} />}
      {toast}
    </Drawer>
  )
}
