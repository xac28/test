"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Radio, Users, Video } from "lucide-react"
import { useSession } from "next-auth/react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

interface Broadcast {
  id: string
  title: string
  startedAt: string
  viewerCount: number
  teacher: { id: string; name: string | null; image: string | null }
  workshop: { slug: string; title: string } | null
}

function since(iso: string, now: number) {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (min < 1) return "az önce başladı"
  if (min < 60) return `${min} dk önce başladı`
  return `${Math.floor(min / 60)} sa ${min % 60} dk önce başladı`
}

export default function LiveDirectoryPage() {
  const { data: session } = useSession()
  const [list, setList] = useState<Broadcast[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch("/api/live")
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (alive) {
          setList(data.broadcasts)
          setFailed(false)
          setNow(Date.now())
        }
      } catch {
        if (alive) setFailed(true)
      }
    }
    load()
    const id = setInterval(load, 10_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const isTeacher = session?.user?.role === "TEACHER" || session?.user?.role === "ADMIN"

  return (
    <>
      <Navbar />
      <main className="min-h-[70vh]">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="eyebrow !text-accent mb-3">Şimdi yayında</p>
              <h1 className="font-display font-light text-5xl md:text-6xl text-ink">Canlı yayınlar</h1>
            </div>
            {isTeacher && (
              <Link href="/live/studio" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-5 py-2.5 rounded-md text-sm font-semibold">
                <Video size={16} /> Yayın stüdyosu
              </Link>
            )}
          </div>

          {failed && !list && <p className="text-ink/60">Yayınlar yüklenemedi. Biraz sonra tekrar deneyin.</p>}

          {!failed && !list && (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Yayınlar yükleniyor">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <div className="aspect-video rounded-xl shimmer" />
                  <div className="mt-3 h-5 w-3/4 rounded shimmer" />
                  <div className="mt-2 h-4 w-1/3 rounded shimmer" />
                </li>
              ))}
            </ul>
          )}

          {list && list.length === 0 && (
            <div data-testid="no-broadcasts" className="border border-dashed border-sage-300 rounded-2xl py-20 text-center">
              <Radio className="mx-auto text-sage-500 mb-4" size={36} />
              <p className="font-display text-2xl text-ink mb-1">Şu anda canlı yayın yok</p>
              <p className="text-ink/60 text-sm">Bir eğitmen yayına başladığında burada görünür.</p>
            </div>
          )}

          {list && list.length > 0 && (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((b) => (
                <li key={b.id}>
                  <Link href={`/live/${b.id}`} data-testid="broadcast-card" className="group block">
                    <div className="relative aspect-video overflow-hidden bg-stage flex items-center justify-center">
                      {b.teacher.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.teacher.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition duration-500" />
                      ) : (
                        <span className="font-display text-6xl text-white/20">{(b.teacher.name || "E")[0]}</span>
                      )}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-accent text-white text-[11px] font-bold tracking-wider uppercase px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Canlı
                      </span>
                      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        <Users size={12} /> {b.viewerCount} izleyici
                      </span>
                    </div>
                    <div className="mt-3">
                      {b.workshop && (
                        <p className="eyebrow !text-clay-600 mb-1">Atölye · yalnızca kayıtlı katılımcılar</p>
                      )}
                      <h2 className="font-display text-xl text-ink leading-snug group-hover:underline underline-offset-4 decoration-1">{b.title}</h2>
                      <p className="text-sm text-ink/70">{b.teacher.name}</p>
                      <p className="text-xs text-ink/50 mt-0.5">{since(b.startedAt, now)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
