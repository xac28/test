"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { Flag, Heart, Loader2, MessageCircle, Trash2 } from "lucide-react"
import { ReportDialog } from "@/components/report-dialog"
import { CONTACT_LABEL_TR, KIND_LABEL_TR, findContact, findSpamShape, scanText } from "@/lib/profanity"
import { timeAgo } from "@/components/notification-bell"

export interface CommunityAuthor { id: string; name: string | null; image: string | null; isTeacher: boolean }
export interface CommunityPost {
  id: string; title: string | null; content: string; image: string | null
  likeCount: number; commentCount: number; createdAt: string; liked: boolean; mine: boolean
  status?: "PENDING" | "VISIBLE" | "REMOVED"; removedReason?: string | null
  author: CommunityAuthor
}
export interface CommunityComment { id: string; content: string; createdAt: string; mine: boolean; canDelete: boolean; author: CommunityAuthor }

/** Live, advisory check while typing — the server always has the last word. */
export function liveWarning(text: string): string | null {
  if (!text.trim()) return null
  const scan = scanText(text)
  if (!scan.clean) {
    const k = scan.kinds.find((x) => x !== "SPAM") ?? scan.kinds[0]
    return k === "SPAM" ? "Reklam ve istenmeyen içerik paylaşılamaz." : `Bu ifade topluluk kurallarına aykırı (${KIND_LABEL_TR[k]}). Lütfen nazik bir dille yaz.`
  }
  const contact = findContact(text)
  if (contact) return `Güvenliğin için ${CONTACT_LABEL_TR[contact]} paylaşılamaz.`
  if (findSpamShape(text)) return "Mesajın spam gibi görünüyor; lütfen sadeleştir."
  return null
}

export function Avatar({ author, size = 36 }: { author: CommunityAuthor; size?: number }) {
  const initial = (author.name || "A").trim()[0]?.toUpperCase()
  return author.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={author.image} alt="" width={size} height={size} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
  ) : (
    <span style={{ width: size, height: size }} className="rounded-full bg-ink text-cream text-xs font-semibold flex items-center justify-center shrink-0" aria-hidden>{initial}</span>
  )
}

/** Sends the visitor to log in (and back) or to accept the terms; returns true when the user is not allowed to continue. */
export function useAuthGate() {
  const router = useRouter()
  const { data: session } = useSession()
  const back = () => (typeof window === "undefined" ? "/community" : window.location.pathname)
  return {
    signedIn: !!session?.user,
    meId: session?.user?.id as string | undefined,
    role: session?.user?.role as string | undefined,
    /** call before an action: returns true if the action must stop (redirecting) */
    needLogin: () => {
      if (session?.user) return false
      router.push(`/login?callbackUrl=${encodeURIComponent(back())}`)
      return true
    },
    handle: async (res: Response): Promise<any> => {
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) router.push(`/login?callbackUrl=${encodeURIComponent(back())}`)
      else if (res.status === 403 && data.code === "TERMS_REQUIRED") router.push(`/accept-terms?next=${encodeURIComponent(back())}`)
      return data
    },
  }
}

export function LikeButton({ post, onChange, size = "md" }: { post: { id: string; liked: boolean; likeCount: number }; onChange: (liked: boolean, count: number) => void; size?: "md" | "lg" }) {
  const gate = useAuthGate()
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    if (busy || gate.needLogin()) return
    setBusy(true)
    const before = { liked: post.liked, count: post.likeCount }
    onChange(!before.liked, Math.max(0, before.count + (before.liked ? -1 : 1))) // optimistic
    try {
      const res = await fetch(`/api/community/${post.id}/like`, { method: "POST" })
      const d = await gate.handle(res)
      if (res.ok) onChange(d.liked, d.likeCount)
      else onChange(before.liked, before.count)
    } catch {
      onChange(before.liked, before.count)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={toggle}
      aria-pressed={post.liked}
      aria-label={post.liked ? "Beğenmekten vazgeç" : "Beğen"}
      data-testid="like-btn"
      className={`inline-flex items-center gap-1.5 min-h-[44px] px-2 -ml-2 rounded-md transition-colors ${post.liked ? "text-clay-500" : "text-sage-600 hover:text-ink"} ${size === "lg" ? "text-base" : "text-sm"}`}
    >
      <Heart size={size === "lg" ? 22 : 19} className={`transition-transform ${post.liked ? "fill-current scale-110" : ""}`} />
      <span data-testid="like-count" className="tabular-nums">{post.likeCount}</span>
    </button>
  )
}

export function PostCard({ post, onChange, onRemoved }: { post: CommunityPost; onChange: (p: CommunityPost) => void; onRemoved?: (id: string) => void }) {
  const gate = useAuthGate()
  const [reporting, setReporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const pending = post.status === "PENDING"
  const removed = post.status === "REMOVED"

  const del = async () => {
    setDeleting(true)
    const res = await fetch(`/api/community/${post.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null)
    setDeleting(false)
    if (res?.ok) onRemoved?.(post.id)
    setConfirmDelete(false)
  }

  return (
    <article data-testid="post-card" className="bg-paper border border-rule rounded-xl overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar author={post.author} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">
            {post.author.name ?? "Üye"}
            {post.author.isTeacher && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-sage-600 border border-sage-300 rounded px-1.5 py-0.5 align-middle">Eğitmen</span>}
          </p>
          <p className="text-xs text-sage-500">{timeAgo(post.createdAt)}</p>
        </div>
        {post.mine ? (
          <button onClick={() => setConfirmDelete(true)} aria-label="Fotoğrafı sil" data-testid="delete-post" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-md text-sage-500 hover:text-clay-600 hover:bg-clay-50"><Trash2 size={17} /></button>
        ) : (
          <button onClick={() => !gate.needLogin() && setReporting(true)} aria-label="Fotoğrafı bildir" data-testid="report-post" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-md text-sage-500 hover:text-ink hover:bg-sage-100"><Flag size={17} /></button>
        )}
      </header>

      {pending && <p data-testid="post-pending" className="mx-4 mb-3 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-3 py-2">Yönetici onayı bekliyor — onaylandığında herkes görebilecek ve sana bildirim göndereceğiz.</p>}
      {removed && <p data-testid="post-removed" className="mx-4 mb-3 text-xs bg-red-50 text-red-800 border border-red-200 rounded-md px-3 py-2">Yayından kaldırıldı{post.removedReason ? `: ${post.removedReason}` : "."}</p>}

      {post.image && (
        <Link href={`/community/${post.id}`} className="block bg-sage-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.image} alt={post.title || post.content.slice(0, 80)} loading="lazy" className="w-full max-h-[34rem] object-cover" />
        </Link>
      )}

      <div className="px-4 pt-3 pb-4">
        {post.title && <h3 className="font-display text-xl text-ink mb-1">{post.title}</h3>}
        <p className="text-sm text-sage-800 whitespace-pre-line break-words">{post.content}</p>
        <div className="flex items-center gap-4 mt-2">
          {!pending && !removed ? (
            <LikeButton post={post} onChange={(liked, likeCount) => onChange({ ...post, liked, likeCount })} />
          ) : (
            <span className="text-sm text-sage-500 inline-flex items-center gap-1.5 min-h-[44px]"><Heart size={19} /> {post.likeCount}</span>
          )}
          <Link href={`/community/${post.id}`} data-testid="open-post" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-sage-600 hover:text-ink">
            <MessageCircle size={19} /> <span data-testid="comment-count" className="tabular-nums">{post.commentCount}</span>
            <span className="sr-only">yorum</span>
          </Link>
        </div>
      </div>

      {reporting && <ReportDialog targetType="POST" targetId={post.id} subject={`Fotoğraf · ${post.author.name ?? "Üye"}`} onClose={() => setReporting(false)} />}
      {confirmDelete && (
        <div role="alertdialog" aria-modal="true" aria-label="Silmeyi onayla" className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="bg-paper border border-rule rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl">Fotoğraf silinsin mi?</h3>
            <p className="text-sm text-sage-600">Fotoğraf ve altındaki yorumlar herkesin görünümünden kalkar.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="px-4 py-2 min-h-[44px] border border-rule rounded-lg text-sm">Vazgeç</button>
              <button onClick={del} disabled={deleting} data-testid="confirm-delete-post" className="px-4 py-2 min-h-[44px] bg-clay-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-2">{deleting && <Loader2 size={14} className="animate-spin" />} Sil</button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

/** Textarea with live feedback; used for captions and comments. */
export function ModeratedField({
  value, onChange, max, rows = 3, placeholder, label, testid, invalid,
}: { value: string; onChange: (v: string) => void; max: number; rows?: number; placeholder: string; label: string; testid: string; invalid?: boolean }) {
  const warn = liveWarning(value)
  return (
    <div>
      <label className="sr-only" htmlFor={testid}>{label}</label>
      <textarea
        id={testid}
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={!!warn || invalid}
        aria-describedby={`${testid}-hint`}
        className={`w-full px-3.5 py-3 bg-white border rounded-lg text-sm focus:outline-none focus:ring-1 resize-y ${warn ? "border-clay-500 focus:border-clay-500 focus:ring-clay-500" : "border-rule focus:border-ink focus:ring-ink"}`}
      />
      <div id={`${testid}-hint`} className="flex items-start justify-between gap-3 mt-1 min-h-[1.25rem]">
        <p role={warn ? "alert" : undefined} data-testid={`${testid}-warn`} className="text-xs text-clay-600">{warn}</p>
        <p className="text-[11px] text-sage-500 tabular-nums shrink-0">{value.length}/{max}</p>
      </div>
    </div>
  )
}

export function useInfinite<T extends { id: string }>(url: string, deps: unknown[]) {
  const [items, setItems] = useState<T[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const seq = useRef(0)
  const load = async (reset: boolean) => {
    const mine = ++seq.current
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}${!reset && cursor ? `cursor=${cursor}` : ""}`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const d = await res.json()
      if (mine !== seq.current) return
      const list: T[] = d.posts ?? d.notifications
      setItems((prev) => (reset || !prev ? list : [...prev, ...list.filter((n) => !prev.some((p) => p.id === n.id))]))
      setCursor(d.nextCursor)
      setMore(!!d.nextCursor)
    } catch {
      if (mine === seq.current) setError(true)
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setItems(null); load(true) }, deps)
  return { items, setItems, more, loading, error, loadMore: () => load(false), reload: () => load(true) }
}
