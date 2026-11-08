"use client"

import { useState } from "react"
import { Radio, ShieldAlert, ShieldCheck } from "lucide-react"
import { Button, Card, Empty, ErrorNote, Pager, Pill, SectionTitle, Segmented, Spinner, Stat, Table, api, fmtDateTime, useConfirm, useLoader, useToast } from "./ui"

interface Stats {
  totalIpBans: number; activeIpBans: number; totalEvasionAttempts: number; recentEvasions24h: number; bannedUsers: number
  totalVisitors: number; totalAttacks: number; recentAttacks24h: number; autoBannedCount: number
}
interface Bans { bans: { id: string; ipAddress: string; reason: string | null; isActive: boolean; expiresAt: string | null; createdAt: string; bannedUserId: string | null }[]; total: number; page: number }
interface Logs { logs: { id: string; ipAddress: string; attemptedEmail: string | null; matchType: string; blocked: boolean; createdAt: string }[]; total: number; page: number }
interface Visitors { visitors: { id: string; ipAddress: string; userAgent: string | null; lastPath: string | null; firstSeenAt: string; lastSeenAt: string; hitCount: number; banned: boolean }[]; total: number; page: number; activeToday: number }
interface Attacks { attacks: { id: string; ipAddress: string; kind: string; path: string | null; userAgent: string | null; autoBanned: boolean; createdAt: string }[]; total: number; page: number }

export function SecurityTab({ onOpenUser }: { onOpenUser: (id: string) => void }) {
  const [view, setView] = useState<"bans" | "evasions" | "visitors" | "attacks">("bans")
  const [page, setPage] = useState(1)
  const [ip, setIp] = useState("")
  const [reason, setReason] = useState("")
  const [days, setDays] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()

  const stats = useLoader<Stats>(() => api("/api/admin/bans?type=stats"), [])
  const bans = useLoader<Bans>(() => (view === "bans" ? api(`/api/admin/bans?type=ip-bans&page=${page}`) : Promise.resolve({ bans: [], total: 0, page: 1 })), [view, page])
  const logs = useLoader<Logs>(() => (view === "evasions" ? api(`/api/admin/bans?type=evasion-logs&page=${page}`) : Promise.resolve({ logs: [], total: 0, page: 1 })), [view, page])
  const visitors = useLoader<Visitors>(() => (view === "visitors" ? api(`/api/admin/bans?type=visitors&page=${page}`) : Promise.resolve({ visitors: [], total: 0, page: 1, activeToday: 0 })), [view, page])
  const attacks = useLoader<Attacks>(() => (view === "attacks" ? api(`/api/admin/bans?type=attacks&page=${page}`) : Promise.resolve({ attacks: [], total: 0, page: 1 })), [view, page])

  const quickBan = (targetIp: string) => ask({
    title: `${targetIp} adresini engelle`, description: "Bu IP sitenin tamamına erişemez (sayfalar ve API dahil).", confirmLabel: "Engelle", tone: "danger",
    input: { label: "Gerekçe (denetim kaydına yazılır)", min: 3 },
    onConfirm: async (r) => { await api("/api/admin/bans", { method: "POST", json: { ipAddress: targetIp, reason: r } }); show("IP engellendi"); visitors.reload(); attacks.reload(); stats.reload() },
  })

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await api("/api/admin/bans", { method: "POST", json: { ipAddress: ip.trim(), reason, ...(days && { expiresAt: new Date(Date.now() + Number(days) * 86_400_000).toISOString() }) } })
      setIp(""); setReason(""); setDays("")
      show("IP engellendi")
      bans.reload(); stats.reload()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const s = stats.data
  return (
    <div className="space-y-6" data-testid="tab-security">
      <SectionTitle title="Güvenlik" hint="IP engelleri ve yasaklı kullanıcıların geri dönme denemeleri. Yerel ve özel ağ adresleri otomatik olarak engellenmez." />
      {stats.error && <ErrorNote message={stats.error} onRetry={stats.reload} />}
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Yasaklı kullanıcı" value={s.bannedUsers} />
          <Stat label="Etkin IP engeli" value={s.activeIpBans} hint={`toplam ${s.totalIpBans}`} />
          <Stat label="Benzersiz ziyaretçi IP" value={s.totalVisitors} />
          <Stat label="Saldırı tespiti (24 sa)" value={s.recentAttacks24h} hint={`toplam ${s.totalAttacks}, otomatik ban ${s.autoBannedCount}`} tone={s.recentAttacks24h > 0 ? "red" : undefined} />
        </div>
      )}

      <Card className="p-5">
        <h3 className="font-display text-xl mb-3">IP adresi engelle</h3>
        <form onSubmit={add} className="grid sm:grid-cols-[1fr_2fr_auto_auto] gap-3 items-start">
          <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="203.0.113.7" aria-label="IP adresi" data-testid="ban-ip" className="px-3 py-2 bg-white border border-rule rounded-lg text-sm font-mono" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Gerekçe" aria-label="Gerekçe" data-testid="ban-reason" className="px-3 py-2 bg-white border border-rule rounded-lg text-sm" />
          <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Süre" className="px-3 py-2 bg-white border border-rule rounded-lg text-sm">
            <option value="">Süresiz</option>
            <option value="1">1 gün</option>
            <option value="7">7 gün</option>
            <option value="30">30 gün</option>
          </select>
          <Button tone="danger" type="submit" disabled={saving || !ip.trim() || reason.trim().length < 3} data-testid="ban-submit">Engelle</Button>
        </form>
        {formError && <p role="alert" data-testid="ban-form-error" className="text-sm text-red-600 mt-2">{formError}</p>}
      </Card>

      <Segmented value={view} onChange={(v) => { setView(v); setPage(1) }} options={[
        { id: "bans", label: "IP engelleri", count: s?.totalIpBans },
        { id: "evasions", label: "Yasak aşma denemeleri", count: s?.totalEvasionAttempts },
        { id: "visitors", label: "Ziyaretçiler", count: s?.totalVisitors },
        { id: "attacks", label: "Saldırı tespitleri", count: s?.totalAttacks },
      ]} />

      {view === "bans" ? (
        bans.error ? <ErrorNote message={bans.error} onRetry={bans.reload} /> :
        !bans.data ? <Spinner /> :
        bans.data.bans.length === 0 ? <Empty icon={<ShieldCheck size={32} />}>IP engeli yok.</Empty> : (
          <>
            <Table head={["IP", "Gerekçe", "Eklenme", "Bitiş", "Durum", ""]}>
              {bans.data.bans.map((b) => (
                <tr key={b.id} data-testid="ipban-row">
                  <td className="px-4 py-3 font-mono">{b.ipAddress}</td>
                  <td className="px-4 py-3 max-w-xs break-words">{b.reason}{b.bannedUserId && <button className="block text-xs underline text-sage-500" onClick={() => onOpenUser(b.bannedUserId!)}>ilgili kullanıcı</button>}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-sage-500">{fmtDateTime(b.createdAt)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-sage-500">{b.expiresAt ? fmtDateTime(b.expiresAt) : "süresiz"}</td>
                  <td className="px-4 py-3">{b.isActive ? <Pill tone="red">Etkin</Pill> : <Pill>Kaldırıldı</Pill>}</td>
                  <td className="px-4 py-3 text-right">
                    {b.isActive && (
                      <Button tone="ghost" data-testid="lift-ban" onClick={() => ask({
                        title: `${b.ipAddress} engelini kaldır`, description: "Bu adres yeniden kayıt olup giriş yapabilir.", confirmLabel: "Engeli kaldır", tone: "primary",
                        onConfirm: async () => { await api("/api/admin/bans", { method: "DELETE", json: { banId: b.id } }); show("Engel kaldırıldı"); bans.reload(); stats.reload() },
                      })}>Kaldır</Button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            <Pager page={bans.data.page} pageSize={50} total={bans.data.total} onPage={setPage} />
          </>
        )
      ) : view === "evasions" ? (
        logs.error ? <ErrorNote message={logs.error} onRetry={logs.reload} /> :
        !logs.data ? <Spinner /> :
        logs.data.logs.length === 0 ? <Empty icon={<ShieldCheck size={32} />}>Yasak aşma denemesi kaydı yok.</Empty> : (
          <>
            <Table head={["Zaman", "IP", "E-posta", "Eşleşme", "Sonuç"]}>
              {logs.data.logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-sage-500">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 font-mono">{l.ipAddress}</td>
                  <td className="px-4 py-3">{l.attemptedEmail ?? "—"}</td>
                  <td className="px-4 py-3"><Pill tone="amber">{l.matchType}</Pill></td>
                  <td className="px-4 py-3">{l.blocked ? <Pill tone="red">Engellendi</Pill> : <Pill>Geçti</Pill>}</td>
                </tr>
              ))}
            </Table>
            <Pager page={logs.data.page} pageSize={50} total={logs.data.total} onPage={setPage} />
          </>
        )
      ) : view === "visitors" ? (
        visitors.error ? <ErrorNote message={visitors.error} onRetry={visitors.reload} /> :
        !visitors.data ? <Spinner /> :
        visitors.data.visitors.length === 0 ? <Empty icon={<Radio size={32} />}>Henüz ziyaretçi kaydı yok.</Empty> : (
          <>
            <p className="text-sm text-sage-500">Son 24 saatte aktif: <strong>{visitors.data.activeToday}</strong> benzersiz IP</p>
            <Table head={["IP", "Son sayfa", "İlk görülme", "Son görülme", "İstek sayısı", "Durum", ""]}>
              {visitors.data.visitors.map((v) => (
                <tr key={v.id} data-testid="visitor-row">
                  <td className="px-4 py-3 font-mono">{v.ipAddress}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-xs text-sage-600" title={v.userAgent ?? undefined}>{v.lastPath ?? "—"}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-sage-500">{fmtDateTime(v.firstSeenAt)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-sage-500">{fmtDateTime(v.lastSeenAt)}</td>
                  <td className="px-4 py-3">{v.hitCount}</td>
                  <td className="px-4 py-3">{v.banned ? <Pill tone="red">Engelli</Pill> : <Pill tone="green">Serbest</Pill>}</td>
                  <td className="px-4 py-3 text-right">
                    {!v.banned && <Button tone="danger" onClick={() => quickBan(v.ipAddress)}>Engelle</Button>}
                  </td>
                </tr>
              ))}
            </Table>
            <Pager page={visitors.data.page} pageSize={50} total={visitors.data.total} onPage={setPage} />
          </>
        )
      ) : (
        attacks.error ? <ErrorNote message={attacks.error} onRetry={attacks.reload} /> :
        !attacks.data ? <Spinner /> :
        attacks.data.attacks.length === 0 ? <Empty icon={<ShieldAlert size={32} />}>Saldırı paterni tespit edilmedi.</Empty> : (
          <>
            <Table head={["Zaman", "IP", "Tür", "Yol", "Durum", ""]}>
              {attacks.data.attacks.map((a) => (
                <tr key={a.id} data-testid="attack-row">
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-sage-500">{fmtDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3 font-mono">{a.ipAddress}</td>
                  <td className="px-4 py-3"><Pill tone="amber">{a.kind === "PATH_SCAN" ? "Tarama" : "Enjeksiyon"}</Pill></td>
                  <td className="px-4 py-3 max-w-xs truncate text-xs text-sage-600" title={a.path ?? undefined}>{a.path ?? "—"}</td>
                  <td className="px-4 py-3">{a.autoBanned ? <Pill tone="red">Otomatik banlandı</Pill> : <Pill>İzleniyor</Pill>}</td>
                  <td className="px-4 py-3 text-right">
                    {!a.autoBanned && <Button tone="danger" onClick={() => quickBan(a.ipAddress)}>Engelle</Button>}
                  </td>
                </tr>
              ))}
            </Table>
            <Pager page={attacks.data.page} pageSize={50} total={attacks.data.total} onPage={setPage} />
          </>
        )
      )}
      {dialog}{toast}
    </div>
  )
}
