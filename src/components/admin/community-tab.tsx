"use client"

import { useState } from "react"
import { Ban, CheckCircle2, ImageIcon, MessageCircle, ShieldCheck, Trash2, Undo2, VolumeX } from "lucide-react"
import { KIND_LABEL_TR } from "@/lib/profanity"
import {
  Button, Card, Empty, ErrorNote, Pager, Pill, SearchBox, SectionTitle, Segmented, Spinner, Stat, Table,
  ago, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast,
} from "./ui"

type Section = "photos" | "comments" | "filter"

interface AdminPost {
  id: string; content: string; title: string | null; image: string | null; status: "PENDING" | "VISIBLE" | "REMOVED"; removedReason: string | null
  likeCount: number; commentCount: number; createdAt: string; openReports: number
  author: { id: string; name: string | null; email: string | null; banned: boolean }
}
interface PostsResp { posts: AdminPost[]; total: number; page: number; pageSize: number; statusCounts: Record<string, number> }

interface AdminComment {
  id: string; content: string; status: "VISIBLE" | "REMOVED"; removedReason: string | null; createdAt: string
  author: { id: string; name: string | null; email: string | null }; post: { id: string; excerpt: string }
}
interface CommentsResp { comments: AdminComment[]; total: number; page: number; pageSize: number }

const STATUS_TONE = { PENDING: "amber", VISIBLE: "green", REMOVED: "red" } as const
const STATUS_TR = { PENDING: "Onay bekliyor", VISIBLE: "Yayında", REMOVED: "Kaldırıldı" } as const

/** Moderation workspace for the community: photo approval queue, comment review and the automatic filter. */
export function CommunityTab({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [section, setSection] = useState<Section>("photos")
  return (
    <div className="space-y-5" data-testid="tab-community">
      <SectionTitle
        title="Topluluk"
        hint="Paylaşılan fotoğraflar, yorumlar ve otomatik küfür/spam filtresi. Yeni üyelerin ilk fotoğrafları siz onaylayana kadar yayınlanmaz."
      />
      <Segmented
        testid="community-section"
        value={section}
        onChange={setSection}
        options={[{ id: "photos", label: "Fotoğraflar" }, { id: "comments", label: "Yorumlar" }, { id: "filter", label: "Otomatik filtre" }]}
      />
      {section === "photos" && <PhotosSection onChanged={onChanged} onOpenUser={onOpenUser} />}
      {section === "comments" && <CommentsSection onChanged={onChanged} onOpenUser={onOpenUser} />}
      {section === "filter" && <FilterSection onOpenUser={onOpenUser} />}
    </div>
  )
}

function PhotosSection({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [status, setStatus] = useState("PENDING")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const { data, error, loading, reload } = useLoader<PostsResp>(
    () => api(`/api/admin/community?${new URLSearchParams({ status, ...(dq && { q: dq }), page: String(page) })}`),
    [status, dq, page],
  )
  const c = data?.statusCounts

  const done = (msg: string) => { show(msg); reload(); onChanged() }
  const approve = async (p: AdminPost) => {
    try { await api(`/api/admin/community/${p.id}`, { method: "POST", json: { action: "approve" } }); done("Fotoğraf yayınlandı") } catch (e: any) { show(e.message) }
  }
  const take = (p: AdminPost, action: "reject" | "remove") =>
    ask({
      title: action === "reject" ? "Fotoğrafı reddet" : "Fotoğrafı kaldır",
      description: "Sahibine nedeniyle birlikte bildirim gider.",
      confirmLabel: action === "reject" ? "Reddet" : "Kaldır",
      tone: "danger",
      input: { label: "Neden (üyeye gösterilir)", min: 3, multiline: true, placeholder: "Örn. Konu dışı / uygunsuz görsel" },
      onConfirm: async (reason) => { await api(`/api/admin/community/${p.id}`, { method: "POST", json: { action, reason } }); done(action === "reject" ? "Fotoğraf reddedildi" : "Fotoğraf kaldırıldı") },
    })
  const restore = async (p: AdminPost) => {
    try { await api(`/api/admin/community/${p.id}`, { method: "POST", json: { action: "restore" } }); done("Fotoğraf geri yüklendi") } catch (e: any) { show(e.message) }
  }

  return (
    <div className="space-y-4" data-testid="community-photos">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          testid="photo-status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1) }}
          options={[
            { id: "PENDING", label: "Onay bekleyen", count: c?.PENDING },
            { id: "VISIBLE", label: "Yayında", count: c?.VISIBLE },
            { id: "REMOVED", label: "Kaldırılan", count: c?.REMOVED },
            { id: "all", label: "Tümü" },
          ]}
        />
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Açıklama, üye adı veya e-posta…" testid="photo-search" />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.posts.length === 0 ? (
        <Empty icon={<ImageIcon size={32} />}>{status === "PENDING" ? "Onay bekleyen fotoğraf yok." : "Bu filtreyle eşleşen fotoğraf yok."}</Empty>
      ) : data ? (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.posts.map((p) => (
              <li key={p.id} data-testid="admin-photo" className="bg-paper border border-rule rounded-xl overflow-hidden flex flex-col">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={p.image} target="_blank" rel="noreferrer" className="block bg-sage-100"><img src={p.image} alt={p.content.slice(0, 60)} loading="lazy" className="w-full h-52 object-cover" /></a>
                )}
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={STATUS_TONE[p.status]}>{STATUS_TR[p.status]}</Pill>
                    {p.openReports > 0 && <Pill tone="red">{p.openReports} açık rapor</Pill>}
                    {p.author.banned && <Pill tone="red">Yasaklı üye</Pill>}
                    <span className="ml-auto text-xs text-sage-500" title={fmtDateTime(p.createdAt)}>{ago(p.createdAt)}</span>
                  </div>
                  {p.title && <p className="font-medium text-ink">{p.title}</p>}
                  <p className="text-sm text-sage-700 whitespace-pre-line break-words line-clamp-4">{p.content}</p>
                  <p className="text-xs text-sage-500">
                    <button className="underline" onClick={() => onOpenUser(p.author.id)}>{p.author.name ?? p.author.email}</button> · {p.likeCount} beğeni · {p.commentCount} yorum
                  </p>
                  {p.removedReason && <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">Neden: {p.removedReason}</p>}
                  <div className="flex flex-wrap gap-2 mt-auto pt-1">
                    {p.status === "PENDING" && (
                      <>
                        <Button tone="primary" onClick={() => approve(p)} data-testid="photo-approve"><CheckCircle2 size={14} /> Onayla</Button>
                        <Button onClick={() => take(p, "reject")} data-testid="photo-reject"><Ban size={14} /> Reddet</Button>
                      </>
                    )}
                    {p.status === "VISIBLE" && <Button onClick={() => take(p, "remove")} data-testid="photo-remove"><Trash2 size={14} /> Kaldır</Button>}
                    {p.status === "REMOVED" && <Button onClick={() => restore(p)} data-testid="photo-restore"><Undo2 size={14} /> Geri yükle</Button>}
                    {p.status !== "PENDING" && <a className="inline-flex items-center px-3 text-sm underline text-sage-600" href={`/community/${p.id}`} target="_blank" rel="noreferrer">Aç</a>}
                  </div>
                </div>
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

function CommentsSection({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [status, setStatus] = useState("VISIBLE")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const { data, error, loading, reload } = useLoader<CommentsResp>(
    () => api(`/api/admin/community/comments?${new URLSearchParams({ status, ...(dq && { q: dq }), page: String(page) })}`),
    [status, dq, page],
  )
  const done = (msg: string) => { show(msg); reload(); onChanged() }
  const remove = (c: AdminComment) =>
    ask({
      title: "Yorumu kaldır",
      description: "Yorum herkesin görünümünden kalkar; sahibine nedeniyle birlikte bildirim gider.",
      confirmLabel: "Kaldır",
      tone: "danger",
      input: { label: "Neden (üyeye gösterilir)", min: 3, multiline: true },
      onConfirm: async (reason) => { await api(`/api/admin/community/comments/${c.id}`, { method: "POST", json: { action: "remove", reason } }); done("Yorum kaldırıldı") },
    })
  const restore = async (c: AdminComment) => {
    try { await api(`/api/admin/community/comments/${c.id}`, { method: "POST", json: { action: "restore" } }); done("Yorum geri yüklendi") } catch (e: any) { show(e.message) }
  }

  return (
    <div className="space-y-4" data-testid="community-comments">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented testid="comment-status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ id: "VISIBLE", label: "Yayında" }, { id: "REMOVED", label: "Kaldırılan" }, { id: "all", label: "Tümü" }]} />
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Yorum metni veya üye…" testid="comment-search" />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.comments.length === 0 ? (
        <Empty icon={<MessageCircle size={32} />}>Bu filtreyle eşleşen yorum yok.</Empty>
      ) : data ? (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <Table head={["Yorum", "Üye", "Fotoğraf", "Zaman", ""]}>
            {data.comments.map((c) => (
              <tr key={c.id} data-testid="admin-comment" className="align-top">
                <td className="px-4 py-3 max-w-sm">
                  <p className="break-words whitespace-pre-line">{c.content}</p>
                  {c.status === "REMOVED" && <p className="text-xs text-red-700 mt-1">Kaldırıldı: {c.removedReason}</p>}
                </td>
                <td className="px-4 py-3"><button className="underline text-left" onClick={() => onOpenUser(c.author.id)}>{c.author.name ?? c.author.email}</button></td>
                <td className="px-4 py-3 max-w-[12rem]"><a className="underline line-clamp-2 text-sage-700" href={`/community/${c.post.id}`} target="_blank" rel="noreferrer">{c.post.excerpt || "Fotoğraf"}</a></td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500" title={fmtDateTime(c.createdAt)}>{ago(c.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {c.status === "VISIBLE" ? (
                    <Button onClick={() => remove(c)} data-testid="comment-remove"><Trash2 size={14} /> Kaldır</Button>
                  ) : (
                    <Button onClick={() => restore(c)} data-testid="comment-restore"><Undo2 size={14} /> Geri yükle</Button>
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

interface ModResp {
  stats: { last24h: number; last7d: number; byKind: Record<string, number> }
  recent: { id: string; kind: string; surface: string; excerpt: string; createdAt: string; user: { id: string; name: string | null } }[]
  offenders: { user: { id: string; name: string | null; email: string | null }; count: number }[]
  mutes: { id: string; until: string; reason: string | null; user: { id: string; name: string | null; email: string | null } }[]
  words: { id: string; word: string; createdAt: string }[]
}
const EVENT_KIND_TR: Record<string, string> = { PROFANITY: "Küfür / hakaret", SPAM: "Spam", CONTACT_INFO: "İletişim bilgisi", LINK: "Bağlantı" }
const SURFACE_TR: Record<string, string> = { POST: "Fotoğraf açıklaması", COMMENT: "Yorum", MESSAGE: "Mesaj", LIVE_CHAT: "Canlı sohbet" }

function FilterSection({ onOpenUser }: { onOpenUser: (id: string) => void }) {
  const { data, error, loading, reload } = useLoader<ModResp>(() => api("/api/admin/moderation"), [])
  const { show, toast } = useToast()
  const [word, setWord] = useState("")
  const [sample, setSample] = useState("")
  const [result, setResult] = useState<any>(null)

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); show(ok); reload() } catch (e: any) { show(e.message) }
  }
  const test = async () => {
    try { setResult(await api("/api/admin/moderation", { method: "POST", json: { action: "test", text: sample } })) } catch (e: any) { show(e.message) }
  }

  if (!data) return error ? <ErrorNote message={error} onRetry={reload} /> : <Spinner />
  return (
    <div className={`space-y-6 ${loading ? "opacity-60" : ""}`} data-testid="community-filter">
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Son 24 saatte engellenen" value={data.stats.last24h} />
        <Stat label="Son 7 günde engellenen" value={data.stats.last7d} />
        <Stat label="Susturulmuş üye" value={data.mutes.length} tone={data.mutes.length ? "amber" : undefined} />
      </div>
      {Object.keys(data.stats.byKind).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.stats.byKind).map(([k, n]) => <Pill key={k}>{EVENT_KIND_TR[k] ?? k}: {n}</Pill>)}
        </div>
      )}

      <Card className="p-5 space-y-3">
        <h3 className="font-display text-xl flex items-center gap-2"><ShieldCheck size={18} /> Filtreyi dene</h3>
        <p className="text-sm text-sage-500">Bir cümle yaz; filtrenin onu nasıl değerlendireceğini gör. Hiçbir şey kaydedilmez.</p>
        <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={2} maxLength={1000} data-testid="filter-sample" className="w-full px-3 py-2 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-sage-500" placeholder="Denenecek metin…" />
        <div className="flex items-center gap-3">
          <Button onClick={test} disabled={!sample.trim()} data-testid="filter-test">Denetle</Button>
          {result && (
            <p data-testid="filter-result" className={`text-sm font-semibold ${result.clean && !result.contact && !result.spam ? "text-green-700" : "text-red-700"}`}>
              {result.clean && !result.contact && !result.spam ? "Temiz — yayınlanır." : `Engellenir: ${[...result.kinds.map((k: string) => (KIND_LABEL_TR as Record<string, string>)[k] ?? k), result.contact ? "iletişim bilgisi" : "", result.spam ? "spam" : ""].filter(Boolean).join(", ")}`}
            </p>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-display text-xl">Ek yasaklı kelimeler</h3>
        <p className="text-sm text-sage-500">Yerleşik Türkçe/İngilizce listeye ek olarak sizin eklediğiniz kelimeler. Yazım oyunları (boşluk, rakam, tekrar) otomatik yakalanır.</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (word.trim()) run(async () => { await api("/api/admin/moderation", { method: "POST", json: { action: "add-word", word } }); setWord("") }, "Kelime eklendi") }}>
          <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={40} placeholder="Yeni kelime" data-testid="word-input" className="flex-1 px-3 py-2 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-sage-500" />
          <Button type="submit" tone="primary" disabled={!word.trim()} data-testid="word-add">Ekle</Button>
        </form>
        {data.words.length === 0 ? <p className="text-sm text-sage-500">Henüz ek kelime yok.</p> : (
          <ul className="flex flex-wrap gap-2" data-testid="word-list">
            {data.words.map((w) => (
              <li key={w.id} className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full border border-rule bg-paper text-sm">
                {w.word}
                <button aria-label={`${w.word} kelimesini sil`} className="w-6 h-6 rounded-full hover:bg-sage-100 text-sage-600" onClick={() => run(() => api("/api/admin/moderation", { method: "DELETE", json: { id: w.id } }), "Kelime silindi")}>×</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {data.mutes.length > 0 && (
        <section>
          <h3 className="font-display text-xl mb-2">Susturulan üyeler</h3>
          <Table head={["Üye", "Bitiş", "Neden", ""]}>
            {data.mutes.map((m) => (
              <tr key={m.id} data-testid="mute-row">
                <td className="px-4 py-3"><button className="underline" onClick={() => onOpenUser(m.user.id)}>{m.user.name ?? m.user.email}</button></td>
                <td className="px-4 py-3 text-xs text-sage-600">{fmtDateTime(m.until)}</td>
                <td className="px-4 py-3 text-sage-700">{m.reason}</td>
                <td className="px-4 py-3 text-right"><Button onClick={() => run(() => api("/api/admin/moderation", { method: "POST", json: { action: "unmute", muteId: m.id } }), "Susturma kaldırıldı")}><VolumeX size={14} /> Kaldır</Button></td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      {data.offenders.length > 0 && (
        <section>
          <h3 className="font-display text-xl mb-2">En çok engellenen üyeler (7 gün)</h3>
          <ul className="space-y-1.5">
            {data.offenders.map((o) => (
              <li key={o.user.id} className="flex items-center justify-between border border-rule bg-paper rounded-lg px-4 py-2 text-sm">
                <button className="underline" onClick={() => onOpenUser(o.user.id)}>{o.user.name ?? o.user.email ?? o.user.id}</button>
                <Pill tone={o.count >= 6 ? "red" : "amber"}>{o.count} engel</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-display text-xl mb-2">Son engellenenler</h3>
        {data.recent.length === 0 ? <Empty>Henüz engellenen bir içerik yok.</Empty> : (
          <Table head={["Üye", "Yer", "Tür", "İçerik (maskeli)", "Zaman"]}>
            {data.recent.map((e) => (
              <tr key={e.id} data-testid="mod-event">
                <td className="px-4 py-3"><button className="underline" onClick={() => onOpenUser(e.user.id)}>{e.user.name ?? "—"}</button></td>
                <td className="px-4 py-3 whitespace-nowrap">{SURFACE_TR[e.surface] ?? e.surface}</td>
                <td className="px-4 py-3"><Pill tone="red">{EVENT_KIND_TR[e.kind] ?? e.kind}</Pill></td>
                <td className="px-4 py-3 text-sage-700 max-w-xs break-words">{e.excerpt}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500" title={fmtDateTime(e.createdAt)}>{ago(e.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      {toast}
    </div>
  )
}
