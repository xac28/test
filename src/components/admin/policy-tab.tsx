"use client"

import { useState } from "react"
import { Ban, CheckCircle2, ScanSearch, ShieldBan, Undo2 } from "lucide-react"
import { POACH_LABEL_TR, PoachKind } from "@/lib/poaching"
import { POLICY_LADDER_TR } from "@/lib/policy-ladder"
import { Button, Card, DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, SectionTitle, Segmented, Spinner, Stat, Table, ago, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast } from "./ui"

type View = "violations" | "users" | "scan" | "rules"
const SURFACE_TR: Record<string, string> = { POST: "Topluluk paylaşımı", COMMENT: "Yorum", MESSAGE: "Özel mesaj", LIVE_CHAT: "Canlı sohbet", LIVE_TITLE: "Yayın başlığı", REVIEW: "Değerlendirme", PROFILE: "Profil metni", WORKSHOP: "Atölye", VIDEO: "Video", SCAN: "İçerik taraması" }
const ACTION_TONE: Record<string, string> = { WARNED: "amber", SUSPENDED: "orange", BANNED: "red", NONE: "gray" }
const ACTION_TR: Record<string, string> = { WARNED: "Uyarıldı", SUSPENDED: "Uzaklaştırıldı", BANNED: "Banlandı", NONE: "Sayılmadı (tekrar)" }

/** Teachers who try to take students off the platform: every blocked attempt, the ladder and the tools to act. */
export function PolicyTab({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [view, setView] = useState<View>("violations")
  return (
    <div className="space-y-5" data-testid="tab-policy">
      <SectionTitle title="Politika ihlalleri" hint="Eğitmenlerin öğrencileri platform dışına (sosyal medya, WhatsApp, telefon, kendi kursu, dışarıdan ödeme) çekme girişimleri. İçerik otomatik engellenir; ihlaller kademeli yaptırıma bağlanır." />
      <Segmented testid="policy-view" value={view} onChange={setView} options={[
        { id: "violations", label: "İhlal günlüğü" }, { id: "users", label: "Eğitmenler" }, { id: "scan", label: "Mevcut içerik taraması" }, { id: "rules", label: "Kurallar" },
      ]} />
      {view === "violations" && <Violations onChanged={onChanged} onOpenUser={onOpenUser} />}
      {view === "users" && <Users onChanged={onChanged} onOpenUser={onOpenUser} />}
      {view === "scan" && <Scan onChanged={onChanged} onOpenUser={onOpenUser} />}
      {view === "rules" && <Rules />}
    </div>
  )
}

const Kinds = ({ kinds }: { kinds: string[] }) => <span className="flex flex-wrap gap-1">{kinds.map((k) => <Pill key={k} tone="red">{POACH_LABEL_TR[k as PoachKind] ?? k}</Pill>)}</span>

function Violations({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const qs = new URLSearchParams({ view: "violations", ...(dq && { q: dq }) })
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/policy?${qs}&page=${page}`), [dq, page])
  const s = data?.stats
  const done = (m: string) => { show(m); reload(); onChanged() }
  return (
    <div className="space-y-4" data-testid="policy-violations">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Son 24 saat" value={s?.last24h ?? "—"} tone={s?.last24h ? "amber" : undefined} />
        <Stat label="Son 7 gün" value={s?.last7d ?? "—"} />
        <Stat label="Şu an uzaklaştırılmış" value={s?.suspendedNow ?? "—"} tone={s?.suspendedNow ? "amber" : undefined} />
        <Stat label="Otomatik banlanan" value={s?.bannedByPolicy ?? "—"} tone={s?.bannedByPolicy ? "red" : undefined} />
      </div>
      {s && Object.keys(s.byKind).length > 0 && <div className="flex flex-wrap gap-2">{Object.entries(s.byKind).map(([k, n]) => <Pill key={k}>{POACH_LABEL_TR[k as PoachKind] ?? k}: {n as number}</Pill>)}</div>}
      <div className="flex flex-wrap gap-3 items-center">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Eğitmen, e-posta veya metin…" testid="policy-search" />
        <DownloadCsv href={`/api/admin/policy?${qs}&format=csv`} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.violations.length === 0 ? <Empty icon={<ShieldBan size={32} />}>Kayıtlı ihlal yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Zaman", "Eğitmen", "Yer / tür", "Engellenen metin", "Sonuç", ""]}>
            {data.violations.map((v: any) => (
              <tr key={v.id} data-testid="policy-row" className={`align-top ${v.forgiven ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500" title={fmtDateTime(v.createdAt)}>{ago(v.createdAt)}</td>
                <td className="px-4 py-3"><button className="underline text-left" onClick={() => onOpenUser(v.user.id)}>{v.user.name ?? v.user.email}</button>
                  <p className="text-[11px] text-sage-500">{v.user.banned ? "Yasaklı" : v.user.suspendedUntil && new Date(v.user.suspendedUntil) > new Date() ? `Uzaklaştırılmış → ${new Date(v.user.suspendedUntil).toLocaleDateString("tr-TR")}` : ""}</p></td>
                <td className="px-4 py-3"><p className="text-xs text-sage-600 mb-1">{SURFACE_TR[v.surface] ?? v.surface}</p><Kinds kinds={v.kinds} /></td>
                <td className="px-4 py-3 max-w-sm break-words text-sage-700">{v.excerpt}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Pill tone={ACTION_TONE[v.action]}>{v.counted ? `${v.strike}. ihlal · ${ACTION_TR[v.action]}` : ACTION_TR[v.action]}</Pill>{v.forgiven && <Pill tone="green">Affedildi</Pill>}</td>
                <td className="px-4 py-3 text-right">
                  {!v.forgiven && v.counted && (
                    <Button data-testid="policy-forgive" onClick={() => ask({
                      title: "İhlali affet", description: "İhlal sayımdan düşer; yanlış alarmsa uzaklaştırma/ban da kaldırılır.", confirmLabel: "Affet", tone: "primary",
                      input: { label: "Gerekçe", min: 3, multiline: false, placeholder: "Örn. yanlış alarm" },
                      onConfirm: async (reason) => { const r = await api("/api/admin/policy", { method: "POST", json: { action: "forgive", id: v.id, reason } }); done(r.lifted ? "Affedildi, kısıtlama kaldırıldı" : "Affedildi") },
                    })}><Undo2 size={14} /> Affet</Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {dialog}
      {toast}
    </div>
  )
}

function Users({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [page, setPage] = useState(1)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/policy?view=users&page=${page}`), [page])
  const done = (m: string) => { show(m); reload(); onChanged() }
  return (
    <div className="space-y-4" data-testid="policy-users">
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.items.length === 0 ? <Empty icon={<CheckCircle2 size={32} />}>Sicilinde ihlal olan eğitmen yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Eğitmen", "İhlal", "Durum", "Son ihlal", ""]}>
            {data.items.map((it: any) => {
              const susp = it.user.suspendedUntil && new Date(it.user.suspendedUntil) > new Date()
              return (
                <tr key={it.user.id} data-testid="policy-user-row" className="align-top">
                  <td className="px-4 py-3"><button className="underline" onClick={() => onOpenUser(it.user.id)}>{it.user.name ?? it.user.email}</button><p className="text-xs text-sage-500">{it.user.email}</p></td>
                  <td className="px-4 py-3"><Pill tone={it.strikes >= 3 ? "red" : it.strikes === 2 ? "orange" : "amber"}>{it.strikes} / 3</Pill></td>
                  <td className="px-4 py-3">{it.user.banned ? <Pill tone="red">Yasaklı</Pill> : susp ? <Pill tone="orange">Uzaklaştırılmış → {new Date(it.user.suspendedUntil).toLocaleDateString("tr-TR")}</Pill> : <Pill tone="gray">Aktif</Pill>}</td>
                  <td className="px-4 py-3 text-xs text-sage-500" title={fmtDateTime(it.lastAt)}>{ago(it.lastAt)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {susp && <Button data-testid="policy-lift" onClick={() => ask({ title: "Uzaklaştırmayı kaldır", description: "Eğitmen hemen yeniden ders, yayın ve paylaşım yapabilir.", confirmLabel: "Kaldır", tone: "primary", onConfirm: async () => { await api("/api/admin/policy", { method: "POST", json: { action: "lift", userId: it.user.id } }); done("Uzaklaştırma kaldırıldı") } })}>Uzaklaştırmayı kaldır</Button>}{" "}
                    {!it.user.banned && !susp && <Button onClick={() => ask({ title: "Eğitmeni uzaklaştır", description: "Listelerden çıkar; ders/yayın/atölye açamaz, mesaj ve paylaşım yapamaz.", confirmLabel: "Uzaklaştır", tone: "danger", input: { label: "Gerekçe", min: 5, multiline: true }, onConfirm: async (reason) => { await api("/api/admin/policy", { method: "POST", json: { action: "suspend", userId: it.user.id, reason } }); done("Uzaklaştırıldı") } })}><Ban size={14} /> Uzaklaştır</Button>}
                  </td>
                </tr>
              )
            })}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {dialog}
      {toast}
    </div>
  )
}

function Scan({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [page, setPage] = useState(1)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/policy?view=scan&page=${page}`), [page])
  return (
    <div className="space-y-4" data-testid="policy-scan">
      <p className="text-sm text-sage-500 flex items-center gap-2"><ScanSearch size={16} /> Yayındaki profil metinlerini, atölyeleri ve videoları tarar. Bulunanı "ihlal olarak kaydet" ile uyarı/uzaklaştırma basamağına bağlayabilirsin.</p>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.hits.length === 0 ? <Empty icon={<CheckCircle2 size={32} />}>Yayındaki içerikte platform dışı yönlendirme bulunamadı. 🎉</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <ul className="space-y-2">
            {data.hits.map((h: any, i: number) => (
              <li key={i} data-testid="policy-scan-hit" className="bg-paper border border-rule rounded-xl p-4 flex flex-wrap gap-3 items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><button className="font-semibold underline" onClick={() => onOpenUser(h.owner.id)}>{h.owner.name ?? h.owner.email}</button> · {h.field}</p>
                  <p className="text-sm text-sage-700 mt-1 break-words">{h.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 items-center"><Kinds kinds={h.kinds} />{h.matches.map((m: string) => <code key={m} className="text-[11px] bg-sage-100 px-1.5 py-0.5 rounded">{m}</code>)}</div>
                </div>
                <Button onClick={() => ask({ title: "İhlal olarak kaydet", description: "Eğitmen bir sonraki basamağa taşınır (1. ihlal uyarı, 2. ihlal 10 gün uzaklaştırma, 3. ihlal kalıcı ban).", confirmLabel: "Kaydet ve yaptırım uygula", tone: "danger", onConfirm: async () => { const r = await api("/api/admin/policy", { method: "POST", json: { action: "record", userId: h.owner.id, text: h.text } }); show(`${r.outcome.strike}. ihlal kaydedildi (${ACTION_TR[r.outcome.action] ?? r.outcome.action})`); reload(); onChanged() } })} data-testid="policy-scan-record"><ShieldBan size={14} /> İhlal olarak kaydet</Button>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {dialog}
      {toast}
    </div>
  )
}

function Rules() {
  return (
    <div className="space-y-4" data-testid="policy-rules">
      <Card className="p-5 space-y-3">
        <h3 className="font-display text-xl">Kademeli yaptırım (yalnızca eğitmenler)</h3>
        <ol className="space-y-2">
          {POLICY_LADDER_TR.map((l) => (
            <li key={l.strike} className="flex gap-3 items-start"><span className="font-display text-3xl text-clay-500 w-8">{l.strike}</span><div><p className="font-semibold">{l.action}</p><p className="text-sm text-sage-600">{l.detail}</p></div></li>
          ))}
        </ol>
        <p className="text-sm text-sage-600">Aynı mesajı 30 dakika içinde tekrar denemek yeni ihlal sayılmaz (günlüğe "tekrar" olarak yazılır). Yanlış alarmları <strong>İhlal günlüğü</strong>'nden "Affet" ile düzeltebilirsin; sayım düşer, gerekirse kısıtlama kalkar.</p>
      </Card>
      <Card className="p-5 space-y-2">
        <h3 className="font-display text-xl">Neler engellenir?</h3>
        <ul className="text-sm text-sage-700 list-disc pl-5 space-y-1">
          <li>Sosyal medya: Instagram, TikTok, YouTube kanalı, Telegram, Facebook, Snapchat, LinkedIn, @kullanıcıadı, "ig: …"</li>
          <li>İletişim: WhatsApp / "wp", telefon numarası, e-posta, harici bağlantı, IBAN</li>
          <li>Yönlendirme cümleleri: "benimle iletişime geç", "özelden yaz", "kendi kursuma/stüdyoma gel", "platform dışında", "komisyonsuz", "havale/papara ile öde"</li>
          <li>Harf aralama, rakam yerine harf ve noktalama oyunları (w h a t s a p p, 1nstagram, i.n.s.t.a) yakalanır</li>
          <li>Yer: profil metni, atölye başlık/açıklaması, yayın başlığı, video başlığı, özel mesajlar, topluluk, yorumlar, canlı sohbet (eğitmenin kendi mesajları)</li>
        </ul>
        <p className="text-xs text-sage-500">Küfür/hakaret ve spam ayrı bir hat: geçici susturma ve uyarı (Fotoğraflar → Otomatik filtre). Öğrenciler için bu hat banla sonuçlanmaz.</p>
      </Card>
    </div>
  )
}
