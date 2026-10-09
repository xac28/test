import { db } from "@/lib/db"
import type { AuthUser } from "@/lib/auth-utils"
import { rankTeachers, detectStyles, StyleId } from "@/lib/ai-guide"
import { getGuideTeachers } from "@/lib/ai-data"
import { fold, matchTaught } from "@/lib/ai-knowledge"
import { taughtToEntries } from "@/lib/ai-learning"
import { listActiveBroadcasts } from "@/lib/live-rooms"
import { POSES } from "@/lib/yoga-poses"
import { seatsLeft, workshopState, formatPriceTR } from "@/lib/workshops"
import { SHOP_SLUGS, formatKurus, parseImages, ORDER_STATUS_LABEL, OrderStatusId, PAY_METHOD_LABEL } from "@/lib/shop"
import { NEWS_CATEGORIES, PODCAST_CATEGORY } from "@/lib/articles"

/** A result the chat shows as a card under the answer. */
export interface AiCard {
  kind: "teacher" | "workshop" | "product" | "article" | "podcast" | "pose" | "live" | "order"
  title: string
  subtitle?: string
  meta?: string
  href: string
  image?: string | null
}

export interface ToolCtx { user: AuthUser | null }
export interface ToolOutput { result: unknown; cards?: AiCard[]; action?: "support" }

export const TOOL_STATUS: Record<string, string> = {
  search_teachers: "Eğitmenler aranıyor…",
  search_workshops: "Atölyeler aranıyor…",
  search_content: "İçerikler aranıyor…",
  find_pose: "Poz bilgisi hazırlanıyor…",
  search_products: "Mağazaya bakılıyor…",
  live_now: "Canlı yayınlara bakılıyor…",
  search_help: "Yardım bilgisi aranıyor…",
  order_status: "Sipariş sorgulanıyor…",
  my_schedule: "Takvimine bakılıyor…",
  contact_support: "Canlı destek hazırlanıyor…",
}

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
const lim = (v: unknown, def: number, max: number) => Math.min(max, Math.max(1, Math.round(typeof v === "number" && Number.isFinite(v) ? v : def)))
/** "contains any of the words" over several columns (a whole sentence never appears inside a title). */
const anyWord = (fields: string[], q: string) => {
  const words = [...new Set(q.split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 3))].slice(0, 4)
  return words.length ? { OR: words.flatMap((w) => fields.map((f) => ({ [f]: { contains: w } }))) } : {}
}
const clip = (s: string | null | undefined, n = 220) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : "")

async function searchTeachers(i: Record<string, unknown>): Promise<ToolOutput> {
  const query = [str(i.style), str(i.query)].filter(Boolean).join(" ")
  const max = num(i.max_price_usd)
  const offset = Math.max(0, Math.round(num(i.offset) ?? 0))
  const styles = Array.isArray(i.styles) ? (i.styles.filter((x) => typeof x === "string") as StyleId[]) : []
  let all = await getGuideTeachers()
  if (max !== undefined) all = all.filter((t) => t.hourlyRate <= max)
  const want = lim(i.limit, 3, 6)
  // the ranking reads "ucuz" from the text; a sort request is the same thing
  const text = `${query || "yoga"}${i.sort === "price" ? " ucuz" : ""}`
  const { teachers: ranked, matched } = rankTeachers(all, text, offset + want, styles.length ? styles : query ? detectStyles(query) : undefined)
  const teachers = ranked.slice(offset, offset + want)
  const rows = teachers.map((t) => ({ name: t.name, specialties: t.specialties, rating: t.rating, reviews: t.reviewCount, price_usd_per_hour: t.hourlyRate, students: t.studentsCount, link: t.href }))
  return {
    result: { matched_styles: matched, teachers: rows, total_pool: all.length, offset, note: rows.length ? undefined : "Bu ölçütlere uyan eğitmen bulunamadı." },
    cards: teachers.map((t) => ({ kind: "teacher" as const, title: t.name, subtitle: t.specialties || "Yoga eğitmeni", meta: `★ ${t.rating} · $${t.hourlyRate}/saat`, href: t.href })),
  }
}

async function searchWorkshops(i: Record<string, unknown>): Promise<ToolOutput> {
  const category = str(i.category, 60)
  const mode = i.mode === "LIVE" || i.mode === "RECORDED" ? i.mode : undefined
  const max = num(i.max_price_usd)
  const now = new Date()
  const iso = (v: unknown) => { const d = typeof v === "string" ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : undefined }
  const from = iso(i.from)
  const to = iso(i.to)
  const rows = await db.workshop.findMany({
    where: {
      status: "PUBLISHED",
      ...(mode ? { mode } : {}),
      ...(category ? { category: { contains: category } } : {}),
      ...(max !== undefined ? { priceUsd: { lte: max } } : {}),
      OR: [{ mode: "RECORDED" }, { startsAt: { gte: from ?? new Date(now.getTime() - 3_600_000), ...(to ? { lte: to } : {}) } }],
    },
    include: { teacher: { include: { user: { select: { name: true } } } }, enrollments: { select: { status: true } } },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    skip: Math.max(0, Math.round(num(i.offset) ?? 0)),
    take: lim(i.limit, 4, 8),
  })
  const items = rows.filter((w) => workshopState(w, now) !== "ended")
  return {
    result: {
      workshops: items.map((w) => ({
        title: w.title, category: w.category, level: w.level, mode: w.mode === "LIVE" ? "canlı" : "kayıtlı", teacher: w.teacher.user.name,
        starts_at: w.startsAt ? w.startsAt.toLocaleString("tr-TR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Istanbul" }) : null,
        starts_iso: w.startsAt ? w.startsAt.toISOString() : null, price_usd: w.priceUsd,
        duration_min: w.durationMin, price: formatPriceTR(w.priceUsd), seats_left: seatsLeft(w.capacity, w.enrollments), link: `/atolyeler/${w.slug}`,
      })),
      note: items.length ? undefined : "Şu an bu ölçütlere uyan atölye yok.",
    },
    cards: items.map((w) => ({
      kind: "workshop" as const, title: w.title, subtitle: `${w.teacher.user.name ?? "Eğitmen"} · ${w.mode === "LIVE" ? "Canlı" : "Kayıtlı"}`,
      meta: `${w.startsAt ? w.startsAt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" }) + " · " : ""}${formatPriceTR(w.priceUsd)}`, href: `/atolyeler/${w.slug}`, image: w.coverUrl,
    })),
  }
}

async function searchContent(i: Record<string, unknown>): Promise<ToolOutput> {
  const q = str(i.query, 80)
  const type = i.type === "news" || i.type === "podcast" ? i.type : "article"
  const category = str(i.category, 60)
  if (type === "podcast") {
    const eps = await db.podcastEpisode.findMany({
      where: { status: "PUBLISHED", ...anyWord(["title", "description", "guest"], q) },
      orderBy: { publishedAt: "desc" }, skip: Math.max(0, Math.round(num(i.offset) ?? 0)), take: 4,
    })
    return {
      result: { podcast_episodes: eps.map((e) => ({ title: e.title, guest: e.guest, summary: clip(e.description), link: `/podcast/${e.slug}` })), note: eps.length ? undefined : "Bu konuda podcast bölümü yok." },
      cards: eps.map((e) => ({ kind: "podcast" as const, title: e.title, subtitle: e.guest ? `Konuk: ${e.guest}` : "Podcast", href: `/podcast/${e.slug}`, image: e.coverUrl })),
    }
  }
  const arts = await db.article.findMany({
    where: {
      status: "PUBLISHED",
      category: type === "news" ? { in: [...NEWS_CATEGORIES] } : category ? { equals: category } : { notIn: [...NEWS_CATEGORIES, PODCAST_CATEGORY] },
      ...anyWord(["title", "excerpt"], q),
    },
    orderBy: { publishedAt: "desc" }, skip: Math.max(0, Math.round(num(i.offset) ?? 0)), take: 4,
    select: { title: true, excerpt: true, slug: true, category: true, coverUrl: true },
  })
  return {
    result: { articles: arts.map((a) => ({ title: a.title, category: a.category, summary: clip(a.excerpt), link: `/icerikler/${a.slug}` })), note: arts.length ? undefined : "Bu konuda yazı bulunamadı." },
    cards: arts.map((a) => ({ kind: "article" as const, title: a.title, subtitle: a.category, href: `/icerikler/${a.slug}`, image: a.coverUrl })),
  }
}

function findPose(i: Record<string, unknown>): ToolOutput {
  const q = fold(str(i.query, 80))
  const words = q.split(/\s+/).filter((w) => w.length > 2)
  const scored = POSES.map((p) => {
    const name = fold(`${p.name} ${p.english} ${p.sanskrit} ${p.slug.replace(/-/g, " ")}`)
    const body = fold(`${p.summary} ${p.category} ${p.benefits.join(" ")} ${p.focus.join(" ")}`)
    let score = 0
    if (q && name.includes(q)) score += 10
    for (const w of words) { if (name.includes(w)) score += 4; else if (body.includes(w)) score += 1 }
    return { p, score }
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2)
  return {
    result: scored.length
      ? { poses: scored.map(({ p }) => ({ name: p.name, english: p.english, sanskrit: p.sanskrit, level: p.level, category: p.category, hold: p.hold, summary: p.summary, steps: p.steps.slice(0, 6), benefits: p.benefits.slice(0, 4), breath: p.breath, avoid: p.avoid, easier: p.easier, link: `/pozlar/${p.slug}` })) }
      : { poses: [], note: "Poz kütüphanesinde eşleşme bulunamadı." },
    cards: scored.map(({ p }) => ({ kind: "pose" as const, title: p.name, subtitle: `${p.sanskrit} · ${p.level}`, meta: p.category, href: `/pozlar/${p.slug}`, image: `/poses/${p.slug}.webp` })),
  }
}

async function searchProducts(i: Record<string, unknown>): Promise<ToolOutput> {
  const q = str(i.query, 80)
  const cat = typeof i.category === "string" && SHOP_SLUGS.includes(i.category) ? i.category : undefined
  const rows = await db.product.findMany({
    where: {
      status: "PUBLISHED", ...(cat ? { category: cat } : {}), ...anyWord(["name", "summary"], q),
      ...(num(i.max_tl) !== undefined ? { priceKurus: { lte: Math.round(num(i.max_tl)! * 100) } } : {}),
    },
    orderBy: i.sort === "price" ? [{ priceKurus: "asc" }] : [{ featured: "desc" }, { createdAt: "desc" }], skip: Math.max(0, Math.round(num(i.offset) ?? 0)), take: lim(i.limit, 4, 6),
  })
  return {
    result: { products: rows.map((p) => ({ name: p.name, category: p.category, summary: p.summary, price: formatKurus(p.priceKurus), price_kurus: p.priceKurus, in_stock: p.stock > 0, stock: p.stock <= 3 ? p.stock : undefined, link: `/shop/urun/${p.slug}` })), note: rows.length ? undefined : "Mağazada bu aramaya uyan ürün yok." },
    cards: rows.map((p) => ({ kind: "product" as const, title: p.name, subtitle: p.stock > 0 ? p.summary : "Tükendi", meta: formatKurus(p.priceKurus), href: `/shop/urun/${p.slug}`, image: parseImages(p.images)[0] ?? null })),
  }
}

async function liveNow(): Promise<ToolOutput> {
  const rooms = await listActiveBroadcasts().catch(() => [])
  return {
    result: { live: rooms.map((r) => ({ title: r.title, teacher: r.teacher.name, viewers: r.viewerCount, link: `/live/${r.id}` })), note: rooms.length ? undefined : "Şu anda canlı yayın yok." },
    cards: rooms.slice(0, 4).map((r) => ({ kind: "live" as const, title: r.title, subtitle: r.teacher.name ?? "Eğitmen", meta: `${r.viewerCount} izleyici`, href: `/live/${r.id}` })),
  }
}

async function searchHelp(i: Record<string, unknown>): Promise<ToolOutput> {
  const q = str(i.query, 200)
  const rows = await db.aiTaughtAnswer.findMany({ where: { active: true }, select: { id: true, keys: true, answer: true, linkLabel: true, linkHref: true }, take: 500 })
  const hit = matchTaught(q, taughtToEntries(rows))
  if (!hit) return { result: { found: false, note: "Yönetimin öğrettiği bir yanıt yok." } }
  db.aiTaughtAnswer.update({ where: { id: hit.entry.id }, data: { hits: { increment: 1 } } }).catch(() => {})
  return { result: { found: true, authoritative: true, id: hit.entry.id, answer: hit.entry.answer, links: hit.entry.links ?? [] } }
}

async function orderStatus(i: Record<string, unknown>): Promise<ToolOutput> {
  const code = str(i.code, 20).toUpperCase()
  const email = str(i.email, 190).toLowerCase()
  const notFound: ToolOutput = { result: { found: false, note: "Bu kod ve e-posta ile eşleşen sipariş bulunamadı. Kodu ve siparişte kullandığın e-postayı kontrol et." } }
  if (!/^AYA-[A-Z0-9]{6}$/.test(code) || !email) return notFound
  const o = await db.order.findUnique({ where: { code }, include: { items: true } })
  if (!o || o.email.toLowerCase() !== email) return notFound
  return {
    result: {
      found: true, code: o.code, status: ORDER_STATUS_LABEL[o.status as OrderStatusId], payment: PAY_METHOD_LABEL[o.payMethod] ?? o.payMethod, total: formatKurus(o.totalKurus),
      tracking_no: o.trackingNo, items: o.items.map((x) => `${x.name} × ${x.quantity}`), link: `/shop/siparis/${o.code}`,
    },
    cards: [{ kind: "order", title: `Sipariş ${o.code}`, subtitle: ORDER_STATUS_LABEL[o.status as OrderStatusId], meta: formatKurus(o.totalKurus), href: `/shop/siparis/${o.code}` }],
  }
}

async function mySchedule(ctx: ToolCtx): Promise<ToolOutput> {
  const user = ctx.user
  if (!user) return { result: { signed_in: false, note: "Bu bilgi için giriş yapmak gerekiyor: [Giriş yap](/login)." } }
  const now = new Date()
  const [lessons, taught, workshops] = await Promise.all([
    db.booking.findMany({ where: { studentId: user.id, status: "CONFIRMED", startTime: { gte: now } }, include: { teacher: { include: { user: { select: { name: true } } } } }, orderBy: { startTime: "asc" }, take: 5 }),
    user.role === "TEACHER" ? db.booking.findMany({ where: { teacher: { userId: user.id }, status: "CONFIRMED", startTime: { gte: now } }, include: { student: { select: { name: true } } }, orderBy: { startTime: "asc" }, take: 5 }) : Promise.resolve([]),
    db.workshopEnrollment.findMany({ where: { userId: user.id, status: { in: ["CONFIRMED", "RESERVED"] }, workshop: { startsAt: { gte: now } } }, include: { workshop: true }, orderBy: { workshop: { startsAt: "asc" } }, take: 5 }),
  ])
  const fmt = (d: Date) => d.toLocaleString("tr-TR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Istanbul" })
  return {
    result: {
      signed_in: true,
      lessons: lessons.map((b) => ({ with: b.teacher.user.name, at: fmt(b.startTime) })),
      lessons_i_teach: taught.map((b) => ({ student: b.student.name, at: fmt(b.startTime) })),
      workshops: workshops.map((e) => ({ title: e.workshop.title, at: e.workshop.startsAt ? fmt(e.workshop.startsAt) : null, status: e.status === "RESERVED" ? "ödeme bekliyor" : "onaylı", link: `/atolyeler/${e.workshop.slug}` })),
      note: lessons.length + taught.length + workshops.length === 0 ? "Yaklaşan ders ya da atölye yok." : undefined,
    },
    cards: workshops.map((e) => ({ kind: "workshop" as const, title: e.workshop.title, subtitle: "Kayıtlı olduğun atölye", meta: e.workshop.startsAt ? e.workshop.startsAt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" }) : undefined, href: `/atolyeler/${e.workshop.slug}` })),
  }
}

/** Runs one tool. Never throws: a failing tool is reported to the model, which then tells the user honestly. */
export async function runTool(name: string, input: unknown, ctx: ToolCtx): Promise<ToolOutput & { isError?: boolean }> {
  const i = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  try {
    switch (name) {
      case "search_teachers": return await searchTeachers(i)
      case "search_workshops": return await searchWorkshops(i)
      case "search_content": return await searchContent(i)
      case "find_pose": return findPose(i)
      case "search_products": return await searchProducts(i)
      case "live_now": return await liveNow()
      case "search_help": return await searchHelp(i)
      case "order_status": return await orderStatus(i)
      case "my_schedule": return await mySchedule(ctx)
      case "contact_support": return { result: { handoff: true, note: "Canlı destek sohbeti kullanıcı için açılıyor. Kullanıcıya bunu bir cümleyle söyle." }, action: "support" }
      default: return { result: { error: `Bilinmeyen araç: ${name}` }, isError: true }
    }
  } catch (e) {
    console.error("[AI_TOOL]", name, e)
    return { result: { error: "Bu bilgiye şu an ulaşılamıyor." }, isError: true }
  }
}
