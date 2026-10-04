"use client"

import { useState } from "react"
import { Ban, BadgeCheck, MessageSquareWarning, Undo2, Users } from "lucide-react"
import { CATEGORY_LABEL_TR, PRIORITY_LABEL_TR, STATUS_LABEL_TR, TARGET_LABEL_TR } from "@/lib/reports"
import {
  Button, Card, Drawer, DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, Segmented, SectionTitle, Spinner, Table,
  api, fmtDate, fmtDateTime, useConfirm, useDebounced, useLoader, useToast,
} from "./ui"

const ROLE_TONE: Record<string, string> = { ADMIN: "purple", TEACHER: "indigo", STUDENT: "gray" }
const ROLE_LABEL: Record<string, string> = { ADMIN: "Yönetici", TEACHER: "Eğitmen", STUDENT: "Öğrenci" }

interface UserRow {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string
  banned: boolean
  banReason: string | null
  createdAt: string
  openReports: number
  teacher: { id: string; isTrialMode: boolean } | null
}
interface ListResp {
  users: UserRow[]
  total: number
  page: number
  pageSize: number
  counts: { STUDENT: number; TEACHER: number; ADMIN: number; banned: number }
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (image) return <img src={image} alt="" className="w-9 h-9 rounded-full object-cover" />
  return <div className="w-9 h-9 rounded-full bg-sage-200 text-sage-700 flex items-center justify-center font-semibold">{(name || "?")[0]}</div>
}

export function UsersTab({ onOpenUser, refreshKey }: { onOpenUser: (id: string) => void; refreshKey: number }) {
  const [q, setQ] = useState("")
  const [role, setRole] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)

  const qs = new URLSearchParams({ ...(dq && { q: dq }), ...(role !== "all" && { role }), status })
  const { data, error, loading, reload } = useLoader<ListResp>(() => api(`/api/admin/users?${qs}&page=${page}`), [dq, role, status, page, refreshKey])

  return (
    <div className="space-y-5" data-testid="tab-users">
      <SectionTitle title="Kullanıcılar" hint="Ad, e-posta veya kullanıcı numarasıyla arayın. Ayrıntı, uyarı ve yasaklama için satıra tıklayın." actions={<DownloadCsv href={`/api/admin/users?${qs}&format=csv`} />} />
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Kullanıcı ara…" testid="admin-user-search" />
        <Segmented
          testid="user-role"
          value={role}
          onChange={(v) => { setRole(v); setPage(1) }}
          options={[
            { id: "all", label: "Tümü" },
            { id: "STUDENT", label: "Öğrenci", count: data?.counts.STUDENT },
            { id: "TEACHER", label: "Eğitmen", count: data?.counts.TEACHER },
            { id: "ADMIN", label: "Yönetici", count: data?.counts.ADMIN },
          ]}
        />
        <Segmented
          testid="user-status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1) }}
          options={[
            { id: "all", label: "Tüm durumlar" },
            { id: "active", label: "Aktif" },
            { id: "banned", label: "Yasaklı", count: data?.counts.banned },
          ]}
        />
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? (
        <Spinner />
      ) : data && data.users.length === 0 ? (
        <Empty icon={<Users size={32} />}>Eşleşen kullanıcı yok.</Empty>
      ) : data ? (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <Table head={["Kullanıcı", "Rol", "Durum", "Açık rapor", "Katılım"]}>
            {data.users.map((u) => (
              <tr key={u.id} data-testid="user-row" onClick={() => onOpenUser(u.id)} className="hover:bg-sage-50 cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} image={u.image} />
                    <div className="min-w-0">
                      <p className={`font-medium ${u.banned ? "line-through text-sage-400" : "text-ink"}`}>{u.name ?? "—"}</p>
                      <p className="text-xs text-sage-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Pill tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Pill>
                  {u.teacher?.isTrialMode && <Pill tone="amber"> onaysız</Pill>}
                </td>
                <td className="px-4 py-3">{u.banned ? <Pill tone="red"><Ban size={11} /> Yasaklı</Pill> : <Pill tone="green"><BadgeCheck size={11} /> Aktif</Pill>}</td>
                <td className="px-4 py-3">{u.openReports > 0 ? <Pill tone="orange">{u.openReports}</Pill> : <span className="text-sage-300">—</span>}</td>
                <td className="px-4 py-3 text-xs text-sage-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
    </div>
  )
}

interface Detail {
  user: {
    id: string; name: string | null; email: string | null; image: string | null; role: string; phone: string | null; country: string | null
    createdAt: string; banned: boolean; banReason: string | null; bannedAt: string | null; termsAcceptedAt: string | null; termsVersion: string | null
    teacher: { id: string; isTrialMode: boolean; trialNote: string | null; trialReviewedAt: string | null; hourlyRate: number; commissionRate: number } | null
  }
  stats: { studentBookings: number; teacherBookings: number; enrollments: number; reportsMade: number; evasions: number }
  reportsAgainst: { id: string; category: string; targetType: string; status: string; priority: string; createdAt: string }[]
  warnings: { id: string; message: string; createdAt: string; acknowledgedAt: string | null }[]
  ips: { ip: string; lastSeenAt: string; hits: number; banned: boolean; bannable: boolean }[]
  audit: { id: string; action: string; reason: string | null; actor: string; createdAt: string }[]
}

export function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useLoader<Detail>(() => api(`/api/admin/users/${id}`), [id])
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()

  const done = (msg: string) => {
    show(msg)
    reload()
    onChanged()
  }

  if (!data) {
    return (
      <Drawer title="Kullanıcı" onClose={onClose} testid="user-drawer">
        {error ? <ErrorNote message={error} onRetry={reload} /> : <Spinner />}
      </Drawer>
    )
  }
  const { user: u, stats } = data

  return (
    <Drawer
      title={u.name ?? "İsimsiz kullanıcı"}
      subtitle={<span>{u.email} · <Pill tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Pill></span>}
      onClose={onClose}
      testid="user-drawer"
    >
      <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
        {u.banned && (
          <div role="alert" data-testid="banned-banner" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Hesap yasaklı · {fmtDateTime(u.bannedAt)}</p>
            <p className="mt-0.5">{u.banReason}</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[
            ["Aldığı ders", stats.studentBookings],
            ["Verdiği ders", stats.teacherBookings],
            ["Atölye kaydı", stats.enrollments],
            ["Yaptığı bildirim", stats.reportsMade],
          ].map(([l, v]) => (
            <Card key={l as string} className="py-3"><p className="font-display text-2xl">{v}</p><p className="text-[11px] text-sage-500 uppercase tracking-wide">{l}</p></Card>
          ))}
        </div>

        <Card className="p-4 text-sm grid grid-cols-2 gap-y-2 gap-x-4">
          <span className="text-sage-500">Katılım</span><span>{fmtDate(u.createdAt)}</span>
          <span className="text-sage-500">Telefon</span><span>{u.phone || "—"}</span>
          <span className="text-sage-500">Ülke</span><span>{u.country || "—"}</span>
          <span className="text-sage-500">Sözleşme</span><span>{u.termsAcceptedAt ? `${fmtDate(u.termsAcceptedAt)} (${u.termsVersion})` : "kabul etmedi"}</span>
          {u.teacher && (
            <>
              <span className="text-sage-500">Eğitmen durumu</span>
              <span>{u.teacher.isTrialMode ? <Pill tone="amber">Onaysız (deneme)</Pill> : <Pill tone="green">Onaylı</Pill>}</span>
              <span className="text-sage-500">Saatlik ücret</span><span>${u.teacher.hourlyRate} · komisyon %{Math.round(u.teacher.commissionRate * 100)}</span>
              {u.teacher.trialNote && <><span className="text-sage-500">Son not</span><span>{u.teacher.trialNote}</span></>}
            </>
          )}
          {stats.evasions > 0 && <><span className="text-sage-500">Yasak aşma denemesi</span><span className="text-red-600 font-semibold">{stats.evasions}</span></>}
        </Card>

        {u.role !== "ADMIN" && (
          <div className="flex flex-wrap gap-2">
            <Button
              data-testid="user-warn"
              onClick={() =>
                ask({
                  title: "Kullanıcıyı uyar",
                  description: "Uyarı kullanıcının panelinde görünür ve e-postayla gönderilir.",
                  confirmLabel: "Uyarıyı gönder",
                  tone: "primary",
                  input: { label: "Uyarı metni", min: 10, multiline: true },
                  onConfirm: async (message) => {
                    await api(`/api/admin/users/${id}/warn`, { method: "POST", json: { message } })
                    done("Uyarı gönderildi")
                  },
                })
              }
            >
              <MessageSquareWarning size={14} /> Uyar
            </Button>
            {u.banned ? (
              <Button
                data-testid="user-unban"
                onClick={() =>
                  ask({
                    title: "Yasağı kaldır",
                    description: "Hesap yeniden etkinleşir ve bu kullanıcı nedeniyle konan IP engelleri kalkar.",
                    confirmLabel: "Yasağı kaldır",
                    tone: "primary",
                    onConfirm: async () => {
                      await api(`/api/admin/users/${id}/ban`, { method: "DELETE" })
                      done("Yasak kaldırıldı")
                    },
                  })
                }
              >
                <Undo2 size={14} /> Yasağı kaldır
              </Button>
            ) : (
              <Button
                tone="danger"
                data-testid="user-ban"
                onClick={() =>
                  ask({
                    title: "Kullanıcıyı yasakla",
                    description: "Hesap kilitlenir, oturumlar kapanır, dersleri iptal edilir ve bilinen IP adresleri engellenir (yerel/özel ağlar hariç). Eğitmense yayınları kapatılır, atölyeleri taslağa alınır.",
                    confirmLabel: "Yasakla",
                    tone: "danger",
                    input: { label: "Gerekçe (denetim kaydına yazılır)", min: 3, multiline: true },
                    onConfirm: async (reason) => {
                      await api(`/api/admin/users/${id}/ban`, { method: "POST", json: { reason } })
                      done("Kullanıcı yasaklandı")
                    },
                  })
                }
              >
                <Ban size={14} /> Yasakla
              </Button>
            )}
          </div>
        )}

        {data.reportsAgainst.length > 0 && (
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Hakkındaki raporlar ({data.reportsAgainst.length})</h4>
            <ul className="space-y-1.5">
              {data.reportsAgainst.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-rule bg-paper">
                  <Pill tone={r.status === "PENDING" || r.status === "REVIEWED" ? "amber" : "gray"}>{STATUS_LABEL_TR[r.status]}</Pill>
                  <span className="flex-1 truncate">{CATEGORY_LABEL_TR(r.category)} · {TARGET_LABEL_TR[r.targetType] ?? r.targetType}</span>
                  <span className="text-xs text-sage-400">{PRIORITY_LABEL_TR[r.priority]} · {fmtDate(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.warnings.length > 0 && (
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Uyarılar</h4>
            <ul className="space-y-1.5">
              {data.warnings.map((w) => (
                <li key={w.id} className="text-sm px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                  {w.message}
                  <p className="text-[11px] text-amber-700">{fmtDateTime(w.createdAt)} · {w.acknowledgedAt ? "okundu" : "henüz okunmadı"}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.ips.length > 0 && (
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Bilinen IP adresleri</h4>
            <ul className="space-y-1.5">
              {data.ips.map((ip) => (
                <li key={ip.ip} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-rule bg-paper">
                  <span className="font-mono">{ip.ip}</span>
                  <span className="text-xs text-sage-400 flex-1">{ip.hits} istek · {fmtDateTime(ip.lastSeenAt)}</span>
                  {ip.banned ? (
                    <Pill tone="red">Engelli</Pill>
                  ) : ip.bannable && u.role !== "ADMIN" ? (
                    <button
                      className="text-xs underline text-red-600"
                      onClick={() =>
                        ask({
                          title: `${ip.ip} adresini engelle`,
                          description: "Bu adresten kimse kayıt olamaz veya giriş yapamaz. Ortak ağlarda (okul, ofis) başka kullanıcıları da etkileyebilir.",
                          confirmLabel: "Engelle",
                          tone: "danger",
                          input: { label: "Gerekçe", min: 3 },
                          onConfirm: async (reason) => {
                            await api("/api/admin/bans", { method: "POST", json: { ipAddress: ip.ip, reason } })
                            done("IP engellendi")
                          },
                        })
                      }
                    >
                      Engelle
                    </button>
                  ) : (
                    <span className="text-[11px] text-sage-400">yerel/özel</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.audit.length > 0 && (
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Bu kullanıcıyla ilgili yönetici işlemleri</h4>
            <ol className="space-y-2 border-l border-rule pl-4">
              {data.audit.map((a) => (
                <li key={a.id} className="text-sm">
                  <p><span className="font-medium">{a.actor}</span> <span className="text-sage-500">· {a.action.replace(/_/g, " ").toLowerCase()}</span></p>
                  {a.reason && <p className="text-xs text-sage-500">{a.reason}</p>}
                  <p className="text-[11px] text-sage-400">{fmtDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      {dialog}
      {toast}
    </Drawer>
  )
}
