"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Flag, Loader2, Trash2 } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { ReportDialog } from "@/components/report-dialog"
import { timeAgo } from "@/components/notification-bell"
import { Avatar, CommunityComment, CommunityPost, LikeButton, ModeratedField, liveWarning, useAuthGate } from "@/components/community/parts"

export default function PostPage() {
  const { id } = useParams<{ id: string }>()
  const gate = useAuthGate()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading")
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportPost, setReportPost] = useState(false)
  const [reportComment, setReportComment] = useState<CommunityComment | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/${id}`, { cache: "no-store" })
      if (res.status === 404) return setState("missing")
      if (!res.ok) return setState("error")
      const d = await res.json()
      setPost(d.post)
      setComments(d.comments)
      setState("ok")
    } catch {
      setState("error")
    }
  }, [id])
  useEffect(() => { load() }, [load, gate.signedIn])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !text.trim() || liveWarning(text) || gate.needLogin()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/community/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) })
      const d = await gate.handle(res)
      if (!res.ok) return setError([d.error, d.hint].filter(Boolean).join(" ") || "Yorum gönderilemedi.")
      setComments((l) => [...l, d.comment])
      setPost((p) => p && { ...p, commentCount: p.commentCount + 1 })
      setText("")
    } catch {
      setError("Bağlantı hatası, tekrar dene.")
    } finally {
      setBusy(false)
    }
  }

  const removeComment = async (c: CommunityComment) => {
    const res = await fetch(`/api/community/comments/${c.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null)
    if (res?.ok) {
      setComments((l) => l.filter((x) => x.id !== c.id))
      setPost((p) => p && { ...p, commentCount: Math.max(0, p.commentCount - 1) })
    }
  }

  const visible = post && (!post.status || post.status === "VISIBLE")

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/community" className="inline-flex items-center gap-1.5 text-sm text-sage-600 hover:text-ink mb-6 min-h-[44px]"><ArrowLeft size={16} /> Topluluğa dön</Link>

        {state === "loading" && <div className="flex justify-center py-24"><Loader2 className="animate-spin text-sage-500" /></div>}
        {state === "missing" && (
          <div className="border border-dashed border-rule rounded-xl py-20 text-center" data-testid="post-missing">
            <p className="font-display text-3xl mb-2">Bu paylaşım bulunamadı</p>
            <p className="text-sage-600">Silinmiş ya da henüz yayınlanmamış olabilir.</p>
          </div>
        )}
        {state === "error" && <p role="alert" className="text-center text-clay-600 py-16">Yüklenemedi. <button className="underline" onClick={load}>Tekrar dene</button></p>}

        {state === "ok" && post && (
          <article data-testid="post-detail">
            <header className="flex items-center gap-3 mb-4">
              <Avatar author={post.author} size={44} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink truncate">{post.author.name ?? "Üye"}</p>
                <p className="text-xs text-sage-500">{timeAgo(post.createdAt)}</p>
              </div>
              {!post.mine && visible && (
                <button onClick={() => !gate.needLogin() && setReportPost(true)} className="inline-flex items-center gap-1.5 px-3 min-h-[44px] text-sm text-sage-600 hover:text-ink" data-testid="report-post"><Flag size={16} /> Bildir</button>
              )}
            </header>
            {post.status === "PENDING" && <p className="mb-4 text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-4 py-3">Bu fotoğraf yönetici onayı bekliyor; yalnızca sen görebilirsin.</p>}
            {post.status === "REMOVED" && <p className="mb-4 text-sm bg-red-50 text-red-800 border border-red-200 rounded-md px-4 py-3">Yayından kaldırıldı{post.removedReason ? `: ${post.removedReason}` : "."} <Link href="/community/rules" className="underline">Kurallar</Link></p>}
            {post.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.image} alt={post.title || post.content.slice(0, 80)} className="w-full rounded-xl border border-rule bg-sage-100 max-h-[40rem] object-contain" />
            )}
            {post.title && <h1 className="font-display text-3xl mt-5">{post.title}</h1>}
            <p className="mt-3 text-sage-800 whitespace-pre-line break-words">{post.content}</p>
            {visible && (
              <div className="mt-3"><LikeButton size="lg" post={post} onChange={(liked, likeCount) => setPost((p) => p && { ...p, liked, likeCount })} /></div>
            )}

            {visible && (
              <section className="mt-10" aria-labelledby="comments-title">
                <h2 id="comments-title" className="font-display text-2xl mb-4">Yorumlar <span className="text-sage-500 text-lg" data-testid="comments-total">({post.commentCount})</span></h2>
                <form onSubmit={send} className="mb-6" data-testid="comment-form">
                  <ModeratedField value={text} onChange={setText} max={500} rows={2} placeholder={gate.signedIn ? "Nazik bir yorum yaz…" : "Yorum yapmak için giriş yap"} label="Yorumun" testid="comment-input" />
                  {error && <p role="alert" data-testid="comment-error" className="text-sm text-clay-600 bg-clay-50 border border-clay-200 rounded-md px-3 py-2 mb-2">{error}</p>}
                  <div className="flex justify-end">
                    <button type="submit" disabled={busy || !text.trim() || !!liveWarning(text)} data-testid="comment-submit" className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] bg-ink text-cream rounded-md text-sm font-medium disabled:opacity-40 hover:bg-sage-800 transition-colors">
                      {busy && <Loader2 size={14} className="animate-spin" />} Yorum yap
                    </button>
                  </div>
                </form>

                {comments.length === 0 ? (
                  <p className="text-sage-500 text-sm border border-dashed border-rule rounded-xl p-8 text-center" data-testid="no-comments">Henüz yorum yok. İlk yorumu sen yap.</p>
                ) : (
                  <ul className="space-y-4" data-testid="comments">
                    {comments.map((c) => (
                      <li key={c.id} data-testid="comment" className="flex gap-3">
                        <Avatar author={c.author} size={34} />
                        <div className="flex-1 min-w-0 bg-paper border border-rule rounded-xl px-4 py-3">
                          <p className="text-sm font-semibold text-ink">{c.author.name ?? "Üye"} <span className="font-normal text-xs text-sage-500 ml-1">{timeAgo(c.createdAt)}</span></p>
                          <p className="text-sm text-sage-800 whitespace-pre-line break-words mt-0.5">{c.content}</p>
                        </div>
                        <div className="flex flex-col">
                          {c.canDelete && <button onClick={() => removeComment(c)} aria-label="Yorumu sil" data-testid="delete-comment" className="w-10 h-10 flex items-center justify-center text-sage-500 hover:text-clay-600"><Trash2 size={16} /></button>}
                          {!c.mine && <button onClick={() => !gate.needLogin() && setReportComment(c)} aria-label="Yorumu bildir" data-testid="report-comment" className="w-10 h-10 flex items-center justify-center text-sage-500 hover:text-ink"><Flag size={15} /></button>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </article>
        )}
      </main>
      <Footer />
      {reportPost && post && <ReportDialog targetType="POST" targetId={post.id} subject={`Fotoğraf · ${post.author.name ?? "Üye"}`} onClose={() => setReportPost(false)} />}
      {reportComment && <ReportDialog targetType="COMMENT" targetId={reportComment.id} subject={`Yorum · ${reportComment.author.name ?? "Üye"}`} onClose={() => setReportComment(null)} />}
    </>
  )
}
