"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Copy, Download, KeyRound, Laptop, ShieldCheck, Trash2 } from "lucide-react"

interface Release { version: string; file: string; size: number; sha256: string; builtAt: string }
interface Device { id: string; name: string; appVersion: string | null; createdAt: string; lastUsedAt: string | null; expiresAt: string }

const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`)
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "henüz kullanılmadı")

/** Teacher page: download the Windows streaming app, pair it with a short code, manage connected computers. */
export function StreamerPanel({ eligible, reason, release }: { eligible: boolean; reason: string | null; release: Release | null }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [left, setLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch("/api/streamer/devices")
    if (r.ok) setDevices((await r.json()).devices)
  }, [])
  useEffect(() => { if (eligible) load() }, [eligible, load])

  useEffect(() => {
    if (!code) return
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((new Date(code.expiresAt).getTime() - Date.now()) / 1000))
      setLeft(s)
      if (s === 0) setCode(null)
    }, 1000)
    return () => clearInterval(t)
  }, [code])

  async function newCode() {
    setBusy(true)
    setError("")
    const r = await fetch("/api/streamer/pairing", { method: "POST" })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) return setError(d.error || "Kod oluşturulamadı")
    setCode(d)
    setLeft(Math.round((new Date(d.expiresAt).getTime() - Date.now()) / 1000))
  }
  async function remove(id: string) {
    const r = await fetch(`/api/streamer/devices/${id}`, { method: "DELETE" })
    if (r.ok) setDevices((d) => d.filter((x) => x.id !== id))
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  if (!eligible) {
    return (
      <div className="max-w-2xl" data-testid="streamer-denied">
        <h1 className="font-display text-4xl mb-3">Yayın uygulaması</h1>
        <p className="flex items-start gap-3 rounded-2xl border border-clay-200 bg-clay-50 p-5 text-clay-800"><AlertTriangle className="shrink-0 mt-0.5" size={20} /> {reason || "Bu sayfaya erişimin yok."}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl" data-testid="streamer-panel">
      <div>
        <p className="eyebrow mb-2">Eğitmenler için</p>
        <h1 className="font-display text-4xl">AYA Yayın Stüdyosu</h1>
        <p className="text-sage-600 mt-2">Windows için masaüstü yayın uygulaması: tarayıcı izni istemeden kamera, mikrofon, ekran ve sistem sesiyle yayın yap. Uygulama yalnızca senin hesabına bağlanır; kurulum dosyası ve eşleştirme yalnızca eğitmenlere açıktır.</p>
      </div>

      <section className="rounded-3xl border border-rule bg-paper p-6 space-y-4" data-testid="streamer-download">
        <h2 className="font-display text-2xl flex items-center gap-2"><Download size={20} /> 1. Uygulamayı indir</h2>
        {release ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <a href="/api/streamer/download" data-testid="streamer-download-link" className="btn-cta"><Download size={18} /> Windows için indir</a>
              <span className="text-sm text-sage-600">Sürüm {release.version} · {fmtSize(release.size)} · Windows 10/11 (64 bit)</span>
            </div>
            {release.sha256 && (
              <div className="text-xs text-sage-600">
                <p className="mb-1">Dosyanın SHA-256 özeti (indirdiğin dosyanın değişmediğini doğrulamak için):</p>
                <div className="flex items-start gap-2">
                  <code className="break-all bg-sage-100 rounded-lg px-3 py-2 flex-1" data-testid="streamer-sha">{release.sha256}</code>
                  <button type="button" onClick={() => copy(release.sha256)} className="min-h-[44px] px-3 rounded-lg border border-rule hover:bg-sage-50" aria-label="Özeti kopyala"><Copy size={15} /></button>
                </div>
                <p className="mt-2">Windows’ta: <code className="bg-sage-100 rounded px-1.5 py-0.5">certutil -hashfile AYA-Yayin-Studyosu-Kurulum-{release.version}.exe SHA256</code></p>
                {copied && <p className="text-teal-700 mt-1">Kopyalandı.</p>}
              </div>
            )}
            <p className="text-sm text-sage-600 rounded-xl bg-saffron-100 border border-saffron-300 px-4 py-3">Uygulama henüz dijital olarak imzalanmamış olabilir; Windows “Bilinmeyen yayıncı” uyarısı gösterirse <em>Ek bilgi → Yine de çalıştır</em> de ve yukarıdaki özeti doğrula. Kurulum yönetici izni istemez.</p>
          </>
        ) : (
          <p className="text-sage-600" data-testid="streamer-unavailable">Kurulum dosyası henüz yüklenmemiş. Yöneticiyle iletişime geç.</p>
        )}
      </section>

      <section className="rounded-3xl border border-rule bg-paper p-6 space-y-4" data-testid="streamer-pair">
        <h2 className="font-display text-2xl flex items-center gap-2"><KeyRound size={20} /> 2. Bilgisayarını bağla</h2>
        <p className="text-sage-600 text-sm">Uygulamayı açınca senden bir <strong>bağlantı kodu</strong> ister. Kodu buradan al; 10 dakika geçerlidir ve yalnızca bir kez kullanılır. Şifreni uygulamaya yazman gerekmez.</p>
        {code ? (
          <div className="flex flex-wrap items-center gap-4" data-testid="pair-code-box">
            <span className="font-mono text-3xl tracking-[0.25em] bg-sage-100 rounded-2xl px-5 py-3" data-testid="pair-code">{code.code}</span>
            <div className="text-sm text-sage-600"><p>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} içinde kullan</p><button type="button" onClick={() => copy(code.code)} className="underline underline-offset-4 min-h-[44px]">{copied ? "Kopyalandı" : "Kodu kopyala"}</button></div>
          </div>
        ) : (
          <button type="button" onClick={newCode} disabled={busy} data-testid="pair-new" className="btn-deep disabled:opacity-60">{busy ? "Oluşturuluyor…" : "Bağlantı kodu oluştur"}</button>
        )}
        {error && <p role="alert" data-testid="pair-error" className="text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-lg px-3 py-2">{error}</p>}
      </section>

      <section className="rounded-3xl border border-rule bg-paper p-6 space-y-3" data-testid="streamer-devices">
        <h2 className="font-display text-2xl flex items-center gap-2"><Laptop size={20} /> Bağlı bilgisayarların</h2>
        {devices.length === 0 ? <p className="text-sm text-sage-600">Henüz bağlı bilgisayar yok.</p> : (
          <ul className="divide-y divide-rule">
            {devices.map((d) => (
              <li key={d.id} className="py-3 flex items-center gap-3" data-testid="device-row">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs text-sage-500">Bağlandı {fmt(d.createdAt)} · Son kullanım {fmt(d.lastUsedAt)}{d.appVersion ? ` · Sürüm ${d.appVersion}` : ""}</p>
                </div>
                <button type="button" onClick={() => remove(d.id)} data-testid="device-remove" className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-sm text-clay-700 hover:bg-clay-50"><Trash2 size={15} /> Kaldır</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-sage-500 flex items-start gap-2"><ShieldCheck size={14} className="shrink-0 mt-0.5" /> Bilgisayarını kaybettiysen ya da tanımadığın bir cihaz görürsen “Kaldır”a bas: uygulama anında erişimini kaybeder. Hesabın askıya alınırsa ya da yasaklanırsa bağlı tüm uygulamalar da çalışmayı bırakır.</p>
      </section>

      <section className="rounded-3xl border border-rule bg-teal-50 p-6" data-testid="streamer-steps">
        <h2 className="font-display text-2xl mb-3 flex items-center gap-2"><CheckCircle2 size={20} /> Nasıl çalışır?</h2>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-sage-700">
          <li>Kurulum dosyasını indirip çalıştır (yönetici izni gerekmez).</li>
          <li>Uygulamayı aç, burada oluşturduğun kodu yaz: bilgisayarın hesabına bağlanır.</li>
          <li>Yayın Stüdyosu açılır: kamera, mikrofon ve ekranını seçip “Yayına başla”ya bas.</li>
          <li>Deneme sürecindeysen yayının yetkililer tarafından izlenir; onaylandıktan sonra da aynı uygulamayı kullanırsın.</li>
        </ol>
      </section>
    </div>
  )
}
