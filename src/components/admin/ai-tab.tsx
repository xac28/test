"use client"

import { useState } from "react"
import { Bot, Check, EyeOff, Pencil, Plus, Sparkles, ThumbsDown, Trash2 } from "lucide-react"
import { Button, Card, Drawer, Empty, ErrorNote, Pager, Pill, SearchBox, SectionTitle, Segmented, Spinner, Stat, Table, ago, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast } from "./ui"

type View = "overview" | "llm" | "unknown" | "unhelpful" | "taught"

export interface TeachInit { question: string; answer?: string; norm?: string; id?: string; keywords?: string; linkLabel?: string; linkHref?: string }

/** Create (or edit) an answer the guide will use from now on. */
export function TeachDialog({ init, onClose, onDone }: { init: TeachInit; onClose: () => void; onDone: (msg: string) => void }) {
  const [question, setQuestion] = useState(init.question)
  const [answer, setAnswer] = useState(init.answer ?? "")
  const [keywords, setKeywords] = useState(init.keywords ?? "")
  const [linkLabel, setLinkLabel] = useState(init.linkLabel ?? "")
  const [linkHref, setLinkHref] = useState(init.linkHref ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = !!init.id

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (editing) await api(`/api/admin/ai/taught/${init.id}`, { method: "PATCH", json: { question, answer, keywords: keywords || undefined, linkHref, linkLabel } })
      else {
        const r = await api("/api/admin/ai", { method: "POST", json: { action: "teach", question, answer, keywords: keywords || undefined, linkHref: linkHref || undefined, linkLabel, norm: init.norm } })
        onDone(r.notified ? `Öğretildi · ${r.notified} üyeye haber verildi` : "Rehbere öğretildi")
        return onClose()
      }
      onDone("Güncellendi")
      onClose()
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }
  const field = "mt-1.5 w-full px-3 py-2 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-ink"
  return (
    <Drawer title={editing ? "Cevabı düzenle" : "Rehbere öğret"} subtitle="Bu cevap, yerleşik bilgilerden önce kullanılır." onClose={onClose} testid="teach-dialog">
      <label className="block"><span className="text-xs font-semibold text-sage-500">Soru (örnek)</span>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} data-testid="teach-question" className={field} /></label>
      <label className="block"><span className="text-xs font-semibold text-sage-500">Cevap</span>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} maxLength={2000} data-testid="teach-answer" placeholder="**kalın** yazabilirsin, satır atlayabilirsin." className={field} />
        <span className="text-xs text-sage-500">{answer.length}/2000</span></label>
      <label className="block"><span className="text-xs font-semibold text-sage-500">Anahtar kelimeler (virgülle, isteğe bağlı)</span>
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="iade, para iadesi, geri ödeme" data-testid="teach-keywords" className={field} />
        <span className="text-xs text-sage-500">Boş bırakırsan sorudaki önemli kelimeler kullanılır. Bir satırdaki kelimelerin <strong>hepsi</strong> soruda geçmeli; birden çok ifade için virgül kullan.</span></label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block"><span className="text-xs font-semibold text-sage-500">Bağlantı etiketi</span>
          <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} maxLength={60} placeholder="Paketleri gör" className={field} /></label>
        <label className="block"><span className="text-xs font-semibold text-sage-500">Bağlantı</span>
          <input value={linkHref} onChange={(e) => setLinkHref(e.target.value)} placeholder="/pricing" data-testid="teach-href" className={field} /></label>
      </div>
      {error && <p role="alert" data-testid="teach-error" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose} disabled={busy}>Vazgeç</Button>
        <Button tone="primary" onClick={save} disabled={busy || question.trim().length < 3 || answer.trim().length < 5} data-testid="teach-save"><Check size={14} /> {editing ? "Kaydet" : "Öğret"}</Button>
      </div>
    </Drawer>
  )
}

export function AiTab({ onChanged }: { onChanged: () => void }) {
  const [view, setView] = useState<View>("overview")
  return (
    <div className="space-y-5" data-testid="tab-ai">
      <SectionTitle title="Yapay zeka (AYA Rehber)" hint="Rehberin bilmediği soruları öğret, geri bildirimleri izle, öğretilmiş cevapları yönet." />
      <Segmented testid="ai-view" value={view} onChange={setView} options={[
        { id: "overview", label: "Özet" }, { id: "llm", label: "Rehber analizi" }, { id: "unknown", label: "Bilinmeyen sorular" }, { id: "unhelpful", label: "Yardımcı olmadı" }, { id: "taught", label: "Öğretilenler" },
      ]} />
      {view === "overview" && <Overview go={setView} />}
      {view === "llm" && <Llm />}
      {view === "unknown" && <Unknown onChanged={onChanged} />}
      {view === "unhelpful" && <Unhelpful onChanged={onChanged} />}
      {view === "taught" && <Taught />}
    </div>
  )
}

function Overview({ go }: { go: (v: View) => void }) {
  const { data, error, reload } = useLoader<any>(() => api("/api/admin/ai?view=overview"), [])
  if (!data) return error ? <ErrorNote message={error} onRetry={reload} /> : <Spinner />
  return (
    <div className="space-y-5" data-testid="ai-overview">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Son 7 gün soru" value={data.asked7} />
        <Stat label="Yardımcı oldu" value={data.helpfulRate === null ? "—" : `%${data.helpfulRate}`} hint={`${data.good} 👍 · ${data.bad} 👎`} tone={data.helpfulRate !== null && data.helpfulRate < 60 ? "red" : "green"} />
        <Stat label="Bilinmeyen (açık)" value={data.unknownOpen} tone={data.unknownOpen ? "amber" : undefined} hint={`Son 7 gün oranı %${data.unknownRate}`} />
        <Stat label="Canlı desteğe geçen" value={data.handoffs} hint={`${data.taughtCount} öğretilmiş cevap aktif`} />
      </div>
      <Card className="p-5">
        <h3 className="font-display text-xl mb-3 flex items-center gap-2"><Bot size={18} /> En çok sorulup cevaplanamayanlar</h3>
        {data.topUnknown.length === 0 ? <p className="text-sm text-sage-500">Cevapsız soru yok. 🎉</p> : (
          <ul className="space-y-2">
            {data.topUnknown.map((t: any) => (
              <li key={t.norm} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{t.norm}</span><Pill tone="amber">{t.count}×</Pill></li>
            ))}
          </ul>
        )}
        <div className="mt-4"><Button onClick={() => go("unknown")}>Hepsini gör ve öğret</Button></div>
      </Card>
      <Card className="p-5">
        <h3 className="font-display text-xl mb-3">Cevap türleri (7 gün)</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.byKind).map(([k, n]) => <Pill key={k}>{KIND_TR[k] ?? k}: {n as number}</Pill>)}
          {Object.keys(data.byKind).length === 0 && <span className="text-sm text-sage-500">Henüz veri yok.</span>}
        </div>
      </Card>
    </div>
  )
}
const KIND_TR: Record<string, string> = { taught: "Öğretilmiş", knowledge: "Bilgi tabanı", navigation: "Yönlendirme", unknown: "Bilinmeyen", crisis: "Kriz mesajı", support: "Canlı destek isteği" }

function Unknown({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const [teach, setTeach] = useState<TeachInit | null>(null)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/ai?view=unknown&page=${page}&q=${encodeURIComponent(dq)}`), [page, dq])
  const done = (msg: string) => { show(msg); reload(); onChanged() }
  return (
    <div className="space-y-4" data-testid="ai-unknown">
      <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Soruda ara…" testid="ai-unknown-search" />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.items.length === 0 ? <Empty icon={<Sparkles size={32} />}>Cevaplanmayı bekleyen soru yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <ul className="space-y-2">
            {data.items.map((it: any) => (
              <li key={it.norm} data-testid="ai-unknown-row" className="bg-paper border border-rule rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink break-words">{it.sample}</p>
                  <p className="text-xs text-sage-500 mt-0.5">{it.count} kez soruldu · {it.askers} üye · son {ago(it.lastAt)}</p>
                </div>
                <Button tone="primary" onClick={() => setTeach({ question: it.sample, norm: it.norm })} data-testid="ai-teach"><Plus size={14} /> Öğret</Button>
                <Button onClick={() => ask({
                  title: "Cevap gerekmiyor", description: "Anlamsız ya da kötüye kullanım içeren bir soruysa listeden kaldırılır.", confirmLabel: "Listeden kaldır",
                  onConfirm: async () => { await api("/api/admin/ai", { method: "POST", json: { action: "dismiss", norm: it.norm } }); done("Listeden kaldırıldı") },
                })} data-testid="ai-dismiss"><EyeOff size={14} /> Yoksay</Button>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {teach && <TeachDialog init={teach} onClose={() => setTeach(null)} onDone={done} />}
      {dialog}
      {toast}
    </div>
  )
}

function Unhelpful({ onChanged }: { onChanged: () => void }) {
  const [page, setPage] = useState(1)
  const [teach, setTeach] = useState<TeachInit | null>(null)
  const { show, toast } = useToast()
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/ai?view=unhelpful&page=${page}`), [page])
  return (
    <div className="space-y-4" data-testid="ai-unhelpful-list">
      <p className="text-sm text-sage-500">Üyelerin "Hayır, yardımcı olmadı" dediği cevaplar. Daha iyi bir cevap öğretirsen bir dahaki sefere o kullanılır.</p>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.items.length === 0 ? <Empty icon={<ThumbsDown size={32} />}>Olumsuz geri bildirim yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <ul className="space-y-2">
            {data.items.map((it: any) => (
              <li key={it.id} data-testid="ai-unhelpful-row" className="bg-paper border border-rule rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink break-words">{it.message}</p>
                  <p className="text-xs text-sage-500 mt-0.5 flex flex-wrap gap-2 items-center"><Pill>{KIND_TR[it.kind] ?? it.kind}</Pill>{it.matched && <span>Eşleşen: “{it.matched}”</span>}<span>{fmtDateTime(it.at)}</span></p>
                </div>
                <Button onClick={() => setTeach({ question: it.message, norm: it.norm })}><Plus size={14} /> Daha iyi cevap öğret</Button>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {teach && <TeachDialog init={teach} onClose={() => setTeach(null)} onDone={(m) => { show(m); reload(); onChanged() }} />}
      {toast}
    </div>
  )
}

function Taught() {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const [teach, setTeach] = useState<TeachInit | null>(null)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/ai?view=taught&page=${page}&q=${encodeURIComponent(dq)}`), [page, dq])
  const toggle = async (id: string, active: boolean) => { try { await api(`/api/admin/ai/taught/${id}`, { method: "PATCH", json: { active } }); show(active ? "Etkinleştirildi" : "Devre dışı"); reload() } catch (e: any) { show(e.message) } }
  return (
    <div className="space-y-4" data-testid="ai-taught">
      <div className="flex flex-wrap gap-3 items-center">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Soru ya da cevapta ara…" testid="ai-taught-search" />
        <Button tone="primary" onClick={() => setTeach({ question: "" })} data-testid="ai-new"><Plus size={14} /> Yeni cevap</Button>
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.items.length === 0 ? <Empty icon={<Bot size={32} />}>Henüz öğretilmiş cevap yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <ul className="space-y-2">
            {data.items.map((it: any) => (
              <li key={it.id} data-testid="ai-taught-row" className={`bg-paper border border-rule rounded-xl p-4 ${it.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink break-words">{it.question}</p>
                    <p className="text-sm text-sage-700 mt-1 line-clamp-3 whitespace-pre-line">{it.answer}</p>
                    <p className="text-xs text-sage-500 mt-2 flex flex-wrap gap-2 items-center">
                      {it.keys.map((k: string) => <Pill key={k}>{k}</Pill>)}
                      <span>{it.hits} kullanım · 👍 {it.helpful} · 👎 {it.unhelpful}</span>
                      {!it.active && <Pill tone="amber">Devre dışı</Pill>}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button onClick={() => setTeach({ id: it.id, question: it.question, answer: it.answer, keywords: it.keys.join(", "), linkLabel: it.linkLabel ?? "", linkHref: it.linkHref ?? "" })} aria-label="Düzenle"><Pencil size={14} /></Button>
                    <Button onClick={() => toggle(it.id, !it.active)}>{it.active ? "Kapat" : "Aç"}</Button>
                    <Button tone="danger" aria-label="Sil" onClick={() => ask({ title: "Cevabı sil", description: "Rehber bu soruya artık bu cevabı vermez.", confirmLabel: "Sil", tone: "danger", onConfirm: async () => { await api(`/api/admin/ai/taught/${it.id}`, { method: "DELETE" }); show("Silindi"); reload() } })}><Trash2 size={14} /></Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {teach && <TeachDialog init={teach} onClose={() => setTeach(null)} onDone={(m) => { show(m); reload() }} />}
      {dialog}
      {toast}
    </div>
  )
}

/** The AI behind the guide: is it on, what does it cost today, how do people rate it, what did it say. */
function Llm() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [low, setLow] = useState(false)
  const dq = useDebounced(q)
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/ai?view=llm&page=${page}&q=${encodeURIComponent(dq)}${low ? "&low=1" : ""}`), [page, dq, low])
  if (error) return <ErrorNote message={error} onRetry={reload} />
  if (!data) return <Spinner />
  return (
    <div className="space-y-5" data-testid="ai-llm">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Bugün soru" value={data.today} hint={`son 7 gün: ${data.count7}`} />
        <Stat label="Ortalama güven" value={data.avgConfidence === null ? "—" : `%${data.avgConfidence}`} hint="motorun kendi kesinlik puanı" tone={data.avgConfidence !== null && data.avgConfidence < 50 ? "amber" : undefined} />
        <Stat label="Düşük güvenli" value={data.lowConfidence} hint="öğretilmeye değer sorular" tone={data.lowConfidence > 0 ? "amber" : undefined} />
        <Stat label="Memnuniyet (7 gün)" value={data.helpfulRate === null ? "—" : `%${data.helpfulRate}`} hint={`👍 ${data.good} · 👎 ${data.bad}`} tone={data.helpfulRate !== null && data.helpfulRate < 60 ? "amber" : "green"} />
      </div>
      <p className="text-xs text-sage-500">Rehber kendi motorumuzla çalışır: dışarıya veri göndermez, anahtar ya da kota gerektirmez. “Düşük güvenli” yanıtları inceleyip doğrusunu “Öğretilenler” sekmesinden öğretebilirsin.</p>
      {data.intents.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="ai-intents">
          {data.intents.map((i: any) => <Pill key={i.intent} tone="blue">{i.intent} · {i.count}</Pill>)}
        </div>
      )}
      {Object.keys(data.toolCounts).length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="ai-tools-used">
          {Object.entries(data.toolCounts).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => <Pill key={k} tone="gray">{k} · {v}</Pill>)}
        </div>
      )}
      <div className="flex items-center gap-3"><SectionTitle title="Rehberin son yanıtları" hint="Yardımcı olmadı diye işaretlenenleri “Yardımcı olmadı” sekmesinden Rehbere öğretebilirsin." /></div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Sorularda ara…" testid="ai-llm-search" />
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" data-testid="ai-low-only" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1) }} /> Yalnızca düşük güvenli</label>
      </div>
      {data.items.length === 0 ? <Empty icon={<Bot size={32} />}>Henüz kayıtlı yanıt yok.</Empty> : (
        <div className={loading ? "opacity-60" : ""}>
          <ul className="space-y-3">
            {data.items.map((r: any) => (
              <li key={r.id} data-testid="ai-llm-row" className="rounded-xl border border-rule bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-sm break-words">{r.message}</p>
                  <span className="text-xs text-sage-500 whitespace-nowrap">{ago(r.createdAt)}</span>
                </div>
                <p className="text-sm text-sage-700 mt-1.5 whitespace-pre-line line-clamp-5">{r.reply}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-sage-500">
                  {r.helpful === true && <Pill tone="green">👍</Pill>}
                  {r.helpful === false && <Pill tone="red">👎</Pill>}
                  <Pill tone="gray">{r.intent}</Pill>
                  {r.confidence !== null && <Pill tone={r.confidence < 0.4 ? "amber" : "gray"}>güven %{Math.round(r.confidence * 100)}</Pill>}
                  {r.tools && <span>araçlar: {r.tools}</span>}
                </div>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
