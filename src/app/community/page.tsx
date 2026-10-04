"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, ShieldCheck } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Composer } from "@/components/community/composer"
import { CommunityPost, PostCard, useAuthGate, useInfinite } from "@/components/community/parts"

export default function CommunityPage() {
  const gate = useAuthGate()
  const [tab, setTab] = useState<"all" | "mine">("all")
  const feed = useInfinite<CommunityPost>(tab === "mine" ? "/api/community?mine=1" : "/api/community", [tab, gate.signedIn])
  const [notice, setNotice] = useState<string | null>(null)

  const update = (p: CommunityPost) => feed.setItems((l) => l && l.map((x) => (x.id === p.id ? p : x)))
  const chip = (active: boolean) => `px-4 py-2 min-h-[40px] text-sm border rounded-md transition-colors ${active ? "bg-ink text-cream border-ink" : "border-rule text-sage-700 hover:border-ink"}`

  return (
    <>
      <Navbar />
      <main>
        <section className="border-b border-rule">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-14 pb-10">
            <p className="eyebrow mb-4">Topluluk</p>
            <h1 className="font-display font-light text-5xl md:text-6xl leading-[1.05] max-w-3xl">
              Pratiğini paylaş, <em className="italic text-clay-500">birbirimize ilham olalım.</em>
            </h1>
            <p className="mt-5 text-sage-600 max-w-xl flex items-start gap-2">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <span>Burası saygının konuştuğu bir alan. Küfür, hakaret ve reklam otomatik engellenir; <Link href="/community/rules" className="underline">kuralları oku</Link>.</span>
            </p>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-6 py-10 space-y-8">
          <Composer
            onPosted={(post, pending) => {
              setNotice(pending ? "Fotoğrafın alındı! Yönetici onayından sonra yayınlanacak; haber vereceğiz." : "Paylaşıldı! 🎉")
              if (!pending && tab === "all") feed.setItems((l) => [post, ...(l ?? [])])
              if (tab === "mine") feed.reload()
              if (pending && tab === "all") setTab("mine")
            }}
          />
          {notice && <p role="status" data-testid="post-notice" className="text-sm bg-sage-100 border border-sage-200 rounded-md px-4 py-3">{notice}</p>}

          <div className="flex gap-2" role="tablist" aria-label="Akış">
            <button role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className={chip(tab === "all")} data-testid="feed-all">Herkes</button>
            {gate.signedIn && <button role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")} className={chip(tab === "mine")} data-testid="feed-mine">Paylaşımlarım</button>}
          </div>

          {feed.items === null ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-sage-500" /></div>
          ) : feed.error && feed.items.length === 0 ? (
            <p role="alert" className="text-center text-clay-600 py-12">Akış yüklenemedi. <button className="underline" onClick={feed.reload}>Tekrar dene</button></p>
          ) : feed.items.length === 0 ? (
            <div data-testid="feed-empty" className="border border-dashed border-rule py-20 text-center rounded-xl">
              <p className="font-display text-3xl mb-2">{tab === "mine" ? "Henüz paylaşımın yok" : "İlk paylaşımı sen yap"}</p>
              <p className="text-sage-600">Bugünkü pratiğinden bir kare ekle.</p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="feed">
              {feed.items.map((p) => (
                <PostCard key={p.id} post={p} onChange={update} onRemoved={(id) => feed.setItems((l) => l && l.filter((x) => x.id !== id))} />
              ))}
              {feed.more && (
                <div className="flex justify-center">
                  <button onClick={feed.loadMore} disabled={feed.loading} data-testid="load-more" className="px-6 py-2.5 min-h-[44px] border border-ink rounded-md text-sm font-medium hover:bg-ink hover:text-cream transition-colors inline-flex items-center gap-2">
                    {feed.loading && <Loader2 size={14} className="animate-spin" />} Daha fazla göster
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
