"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Camera, Grid3X3, LayoutList, Loader2, ShieldCheck } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Composer } from "@/components/community/composer"
import { CommunityPost, PostCard, useAuthGate, useInfinite } from "@/components/community/parts"
import { PhotoGrid, RecentPosters } from "@/components/community/grid"

type Tab = "all" | "teachers" | "mine"
type View = "grid" | "list"

function CommunityContent() {
  const gate = useAuthGate()
  const params = useSearchParams()
  const authorFilter = params.get("author")
  const [tab, setTab] = useState<Tab>("all")
  const [view, setView] = useState<View>("grid")
  const [composerOpen, setComposerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const url =
    tab === "mine" ? "/api/community?mine=1" :
    tab === "teachers" ? "/api/community?teachers=1" :
    authorFilter ? `/api/community?author=${authorFilter}` :
    "/api/community"

  const feed = useInfinite<CommunityPost>(url, [tab, gate.signedIn])

  const update = (p: CommunityPost) =>
    feed.setItems((l) => l && l.map((x) => (x.id === p.id ? p : x)))

  const chip = (active: boolean) =>
    `px-4 py-2 min-h-[38px] text-sm font-medium border rounded-full transition-colors ${
      active ? "bg-ink text-cream border-ink" : "border-rule text-sage-700 hover:border-ink"
    }`

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        {/* Header */}
        <section className="border-b border-rule bg-cream">
          <div className="max-w-5xl mx-auto px-6 pt-10 pb-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="font-display font-light text-4xl md:text-5xl text-ink leading-tight">
                  Topluluk
                </h1>
                <p className="mt-2 text-sage-600 text-sm flex items-center gap-1.5">
                  <ShieldCheck size={15} className="shrink-0" />
                  Saygının konuştuğu bir alan.{" "}
                  <Link href="/community/rules" className="underline hover:text-ink">Kuralları oku</Link>
                </p>
              </div>
              <button
                onClick={() => {
                  if (gate.needLogin()) return
                  setComposerOpen((x) => !x)
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] bg-ink text-cream text-sm font-semibold rounded-xl hover:bg-sage-900 transition-colors shrink-0"
              >
                <Camera size={17} />
                Paylaş
              </button>
            </div>

            {/* Composer drawer */}
            {composerOpen && (
              <div className="mt-6 bg-paper border border-rule rounded-2xl p-5">
                <Composer
                  onPosted={(post, pending) => {
                    setNotice(
                      pending
                        ? "Fotoğrafın alındı! Yönetici onayından sonra yayınlanacak."
                        : "Paylaşıldı!"
                    )
                    setComposerOpen(false)
                    if (!pending && tab === "all") feed.setItems((l) => [post, ...(l ?? [])])
                    if (tab === "mine") feed.reload()
                    if (pending && tab !== "mine") setTab("mine")
                  }}
                />
              </div>
            )}

            {notice && (
              <p role="status" data-testid="post-notice" className="mt-4 text-sm bg-sage-100 border border-sage-200 rounded-xl px-4 py-3">
                {notice}
              </p>
            )}
          </div>
        </section>

        {/* Stories / Recent posters */}
        {feed.items && feed.items.length > 0 && (
          <section className="border-b border-rule">
            <div className="max-w-5xl mx-auto px-6 py-4">
              <RecentPosters posts={feed.items} />
            </div>
          </section>
        )}

        {/* Tabs + View toggle */}
        <section className="border-b border-rule bg-cream sticky top-16 z-30">
          <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2" role="tablist" aria-label="Akış filtresi">
              <button role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className={chip(tab === "all")}>
                Herkes
              </button>
              <button role="tab" aria-selected={tab === "teachers"} onClick={() => setTab("teachers")} className={chip(tab === "teachers")}>
                Eğitmenler
              </button>
              {gate.signedIn && (
                <button role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")} className={chip(tab === "mine")} data-testid="feed-mine">
                  Paylaşımlarım
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setView("grid")}
                aria-label="Grid görünüm"
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${view === "grid" ? "bg-ink text-cream" : "text-sage-500 hover:text-ink"}`}
              >
                <Grid3X3 size={17} />
              </button>
              <button
                onClick={() => setView("list")}
                aria-label="Liste görünüm"
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${view === "list" ? "bg-ink text-cream" : "text-sage-500 hover:text-ink"}`}
              >
                <LayoutList size={17} />
              </button>
            </div>
          </div>
        </section>

        {/* Feed */}
        <section className="max-w-5xl mx-auto px-0 sm:px-6 py-6">
          {feed.items === null ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-sage-400" />
            </div>
          ) : feed.error && feed.items.length === 0 ? (
            <p role="alert" className="text-center text-clay-600 py-16 px-6">
              Akış yüklenemedi.{" "}
              <button className="underline" onClick={feed.reload}>Tekrar dene</button>
            </p>
          ) : feed.items.length === 0 ? (
            <div data-testid="feed-empty" className="border border-dashed border-rule py-24 text-center rounded-2xl mx-6">
              <p className="font-display text-3xl mb-2 text-ink">
                {tab === "mine" ? "Henüz paylaşımın yok" : tab === "teachers" ? "Henüz eğitmen paylaşımı yok" : "İlk paylaşımı sen yap"}
              </p>
              <p className="text-sage-500 text-sm">Bugünkü pratiğinden bir kare ekle.</p>
            </div>
          ) : view === "grid" ? (
            <>
              <PhotoGrid posts={feed.items} />
              {feed.more && (
                <div className="flex justify-center mt-8 px-6">
                  <button
                    onClick={feed.loadMore}
                    disabled={feed.loading}
                    data-testid="load-more"
                    className="px-6 py-2.5 min-h-[44px] border border-ink rounded-xl text-sm font-medium hover:bg-ink hover:text-cream transition-colors inline-flex items-center gap-2"
                  >
                    {feed.loading && <Loader2 size={14} className="animate-spin" />}
                    Daha fazla göster
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6 px-0 sm:px-0">
              {feed.items.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onChange={update}
                  onRemoved={(id) => feed.setItems((l) => l && l.filter((x) => x.id !== id))}
                />
              ))}
              {feed.more && (
                <div className="flex justify-center">
                  <button
                    onClick={feed.loadMore}
                    disabled={feed.loading}
                    data-testid="load-more"
                    className="px-6 py-2.5 min-h-[44px] border border-ink rounded-xl text-sm font-medium hover:bg-ink hover:text-cream transition-colors inline-flex items-center gap-2"
                  >
                    {feed.loading && <Loader2 size={14} className="animate-spin" />}
                    Daha fazla göster
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <CommunityContent />
    </Suspense>
  )
}
