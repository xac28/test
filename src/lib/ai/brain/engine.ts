/**
 * AYA's own guide engine. One question in, one answer out:
 * understand (language → slots → intent, read against the earlier conversation), look up (tools), write (handlers).
 * No external service is involved at any point.
 */
import { isCrisis, matchKnowledge } from "@/lib/ai-knowledge"
import { wantsHuman } from "@/lib/ai-guide"
import { TOOL_STATUS, ToolCtx, runTool } from "@/lib/ai/tools"
import { Answer, Env, answer } from "./answer"
import { advance, replay, resolve } from "./dialogue"
import * as H from "./handlers"
import { DATA_INTENTS } from "./intents"
import { hash } from "./nlp"
import { retrieve } from "./retrieval"

export interface ChatMsg { role: "user" | "assistant"; content: string }

export interface ThinkOptions {
  /** called once, right before the first lookup ("Eğitmenler aranıyor…") */
  onStatus?: (label: string) => void
  now?: Date
}

const SPECIFIC = 8

/** The first word of the member's name, for a friendly opening. */
const firstName = (n: string | null | undefined) => (n ? n.trim().split(/\s+/)[0].slice(0, 20) : undefined)

export async function think(history: ChatMsg[], ctx: ToolCtx, opts: ThinkOptions = {}): Promise<Answer> {
  const users = history.filter((m) => m.role === "user").map((m) => m.content)
  const last = users[users.length - 1] ?? ""
  const state = replay(users.slice(0, -1))
  const now = opts.now ?? new Date()
  const used: string[] = []
  let announced = false

  const tool: Env["tool"] = async (name, input) => {
    if (!used.includes(name)) used.push(name)
    if (!announced) { announced = true; opts.onStatus?.(TOOL_STATUS[name] ?? "Bilgi toplanıyor…") }
    return runTool(name, input, ctx)
  }
  const finish = (a: Answer): Answer => ({ ...a, tools: [...new Set([...used, ...a.tools])] })

  // sensitive moments keep their carefully written answers
  if (isCrisis(last)) return finish(H.crisis())

  const turn = resolve(last, state)
  const env: Env = {
    ctx, now, turn, state, tool, signedIn: !!ctx.user, role: ctx.user?.role ?? null,
    seed: hash(turn.doc.norm) + state.turns * 31,
    name: state.turns === 0 ? firstName(ctx.user?.name) : undefined,
  }
  if (wantsHuman(last)) return finish(H.support(env))

  // what the admins taught the guide beats everything built in
  const taught = (await runTool("search_help", { query: last }, ctx)).result as { found?: boolean; answer?: string; id?: string; links?: { label: string; href: string }[] }
  if (taught?.found) {
    used.push("search_help")
    return finish(answer({ intent: "taught", kind: "taught", text: String(taught.answer), matchedId: String(taught.id ?? ""), links: taught.links ?? [] }))
  }
  const kb = matchKnowledge(last)
  const { intent, cls } = turn
  const dataStrong = DATA_INTENTS.includes(intent) && (cls.topScore >= 4 || turn.followUp)

  // a personal need ("sırtım ağrıyor", "uyuyamıyorum") gets the full answer: advice, styles, poses and people — not just the canned text
  const sl = turn.slots
  const howTo = turn.doc.has("nasil", "nedir", "ne demek", "neden")
  const personalNeed = intent === "recommend" && !!(sl.areas.length || sl.conditions.length || (sl.goals.length && !howTo) || sl.level)
  // a whole phrase of the knowledge base matched: answer it unless a lookup is clearly what was asked for
  if (kb && kb.score >= SPECIFIC && !personalNeed && !(dataStrong && cls.topScore >= SPECIFIC) && !turn.followUp) {
    const a = await H.knowledge(env, kb.entry.id)
    if (a) return finish(a)
  }

  // "selam nasılsın": greet and answer the question that came with it
  if (intent === "greeting" && kb && kb.score >= 3) {
    const a = await H.knowledge(env, kb.entry.id)
    if (a) return finish(a)
  }

  switch (intent) {
    case "greeting": return finish(H.greeting(env))
    case "thanks": return finish(H.thanks(env))
    case "bye": return finish(H.bye(env))
    case "teachers": return finish(await H.teachers(env))
    case "workshops": return finish(await H.workshops(env))
    case "live": return finish(await H.live(env))
    case "articles": return finish(await H.articles(env))
    case "news": return finish(await H.news(env))
    case "podcast": return finish(await H.podcast(env))
    case "products": return finish(await H.products(env))
    case "order": return finish(await H.order(env))
    case "schedule": return finish(await H.schedule(env))
    case "pose": { const a = H.pose(env); if (a) return finish(a); break }
    case "plan": return finish(H.plan(env))
    case "recommend": return finish(await H.recommend(env))
    case "compare": return finish(H.compare(env))
    case "pricing": case "booking": case "become_teacher": case "recordings": case "payouts": case "report": case "account": case "terms": {
      const a = H.navigation(env, intent)
      if (a) return finish(a)
      break
    }
    default: break
  }

  // "bana bir şey öner": a wish without a subject
  const WISH = new Set(["oner", "onerir", "onerisi", "onerebilir", "tavsiye", "ver", "goster", "yardim", "yardimci", "bana", "sey", "birsey", "lutfen", "var", "bakar", "misin", "musun"])
  if (turn.doc.content.length && turn.doc.content.every((w) => WISH.has(w) || WISH.has(w.replace(/(ir|er|ebilir|ebilirsin|sin)$/, "")))) return finish(H.clarify(env))

  // knowledge / unknown: the best phrase match, then semantic retrieval, then a "did you mean"
  if (kb && kb.score >= 3) {
    const a = await H.knowledge(env, kb.entry.id)
    if (a) return finish(a)
  }
  const hits = retrieve(turn.doc, 4)
  const top = hits[0]
  // a hit counts when it is strong and covers most of what was asked; a partial cover is offered with a hedge
  if (top && top.score >= 6 && top.coverage >= 0.34) {
    const sure = top.coverage >= 0.6 && top.score >= 9
    if (top.kind === "pose") {
      const a = H.pose({ ...env, turn: { ...turn, slots: { ...turn.slots, poseSlug: top.id } } })
      if (a) return finish(a)
    }
    const a = await H.knowledge(env, top.id, sure ? undefined : "Sanırım şunu soruyorsun:")
    if (a) return finish(a)
  }
  // "bana bir şey öner": the wish is clear, the subject is not
  if (turn.doc.has("oner", "tavsiye", "ne yapayim", "yardim", "bir sey") && !hits.some((h) => h.score >= 9)) return finish(H.clarify(env))
  return finish(H.didYouMean(env, hits.filter((h) => h.score >= 2.5 && h.coverage >= 0.25)))
}

export { advance }
