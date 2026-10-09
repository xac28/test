// A tiny stand-in for the Anthropic Messages API (streaming), so the guide's real SDK calls and agent loop can be tested
// without a key, a network or money.
//   node tests/support/fake-anthropic.mjs [port]      (default 4010)
// Point the app at it with ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010.
// GET /__log returns the request bodies it has seen (newest last), POST /__reset clears them.
import { createServer } from "http"

const port = Number(process.argv[2] || process.env.FAKE_ANTHROPIC_PORT || 4010)
const log = []

const text = (m) => (typeof m.content === "string" ? m.content : m.content.filter((b) => b.type === "text").map((b) => b.text).join(" "))

/** What the "model" does for a request: a list of content blocks and a stop reason. */
function decide(body) {
  const msgs = body.messages
  const last = msgs[msgs.length - 1]
  const tool = (name, input, lead) => ({ blocks: [...(lead ? [{ type: "text", text: lead }] : []), { type: "tool_use", id: `toolu_${Math.random().toString(16).slice(2, 10)}`, name, input }], stop: "tool_use" })
  if (Array.isArray(last.content) && last.content.some((b) => b.type === "tool_result")) {
    // "__sonsuz": a model that never stops asking for more
    if (msgs.some((m) => m.role === "user" && typeof m.content === "string" && m.content.toLowerCase().includes("__sonsuz"))) return tool("live_now", {})
    const results = last.content.filter((b) => b.type === "tool_result")
    const data = results.map((r) => { try { return JSON.parse(typeof r.content === "string" ? r.content : r.content?.[0]?.text ?? "{}") } catch { return {} } })
    const first = data[0] || {}
    const bits = []
    if (first.teachers?.length) bits.push(`En uygun eğitmen **${first.teachers[0].name}** (${first.teachers[0].rating} puan).`)
    else if (first.teachers) bits.push("Uygun eğitmen bulamadım.")
    if (first.workshops) bits.push(first.workshops.length ? `Yaklaşan atölye: **${first.workshops[0].title}**.` : "Şu an atölye yok.")
    if (first.poses) bits.push(first.poses.length ? `**${first.poses[0].name}** için ${first.poses[0].steps?.[0] ?? "adımlar"}. Kaçınılacak: ${(first.poses[0].avoid ?? []).join(", ")}.` : "Bu pozu bulamadım.")
    if (first.products) bits.push(first.products.length ? `Mağazada **${first.products[0].name}** var (${first.products[0].price}).` : "Mağazada bulamadım.")
    if (first.live) bits.push(first.live.length ? `Şu an yayında: ${first.live[0].title}.` : "Şu an canlı yayın yok.")
    if (first.found === false && first.note) bits.push(first.note)
    if (first.code) bits.push(`Sipariş ${first.code}: **${first.status}**.`)
    if (first.signed_in === false) bits.push("Bunun için giriş yapmalısın.")
    if (first.signed_in === true) bits.push(`Takvim: ${first.lessons?.length ?? 0} ders, ${first.workshops?.length ?? 0} atölye.`)
    if (first.handoff) bits.push("Canlı destek açılıyor.")
    if (first.articles) bits.push(first.articles.length ? `Yazı: ${first.articles[0].title}.` : "Yazı bulamadım.")
    if (first.error) bits.push("Bilgiye şu an ulaşamadım.")
    if (!bits.length) bits.push("Tamamdır.")
    return { blocks: [{ type: "text", text: bits.join(" ") }], stop: "end_turn" }
  }
  const q = text(last).toLowerCase()
  if (q.includes("__bağlantı")) return { blocks: [{ type: "text", text: "Bak: [Atölyeler](/atolyeler), [dış site](https://evil.example/x), [mutlak](//evil.example) ve <img src=x onerror=alert(1)> **kalın** _eğik_\n\n- birinci madde\n- ikinci madde" }], stop: "end_turn" }
  if (q.includes("__ret")) return { blocks: [{ type: "text", text: "" }], stop: "refusal" }
  if (q.includes("__sonsuz")) return tool("live_now", {})
  if (q.includes("__bozuk")) return tool("search_teachers", "not-an-object")
  if (q.includes("__bilinmeyen")) return tool("no_such_tool", {})
  if (q.includes("sipariş")) {
    const code = /AYA-[A-Z0-9]{6}/i.exec(text(last))?.[0] ?? "AYA-XXXXXX"
    const email = /[\w.+-]+@[\w.-]+\.\w+/.exec(text(last))?.[0] ?? ""
    return tool("order_status", { code, email })
  }
  if (q.includes("eğitmen") || q.includes("yin")) return tool("search_teachers", { style: "yin", limit: 3 }, "Hemen bakıyorum.")
  if (q.includes("atölye")) return tool("search_workshops", {})
  if (q.includes("poz") || q.includes("ağaç")) return tool("find_pose", { query: "ağaç" })
  if (q.includes("mat") || q.includes("ürün")) return tool("search_products", { query: "mat" })
  if (q.includes("yayın")) return tool("live_now", {})
  if (q.includes("takvim") || q.includes("derslerim")) return tool("my_schedule", {})
  if (q.includes("yazı") || q.includes("makale")) return tool("search_content", { query: "nefes" })
  if (q.includes("insan") || q.includes("şikayet") || q.includes("iade")) return tool("contact_support", { reason: "kullanıcı yardım istedi" })
  if (q.includes("yardım sorusu")) return tool("search_help", { query: q })
  return { blocks: [{ type: "text", text: "Merhaba! Ben **AYA Rehber**. Eğitmen, atölye ya da pozlar hakkında yardımcı olabilirim." }], stop: "end_turn" }
}

function sse(res, events) {
  for (const [name, data] of events) res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x")
  if (url.pathname === "/__log") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(log)) }
  if (url.pathname === "/__reset") { log.length = 0; return res.end("ok") }
  if (!url.pathname.startsWith("/v1/messages")) { res.statusCode = 404; return res.end("{}") }
  let raw = ""
  for await (const c of req) raw += c
  const body = JSON.parse(raw || "{}")
  log.push({ headers: { "anthropic-beta": req.headers["anthropic-beta"], "x-api-key": req.headers["x-api-key"] ? "set" : "missing" }, body })
  if (log.length > 50) log.shift()
  const last = body.messages?.[body.messages.length - 1]
  if (last && text(last).toLowerCase().includes("__hata")) {
    res.statusCode = 500
    res.setHeader("content-type", "application/json")
    return res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "boom" } }))
  }
  if (last && text(last).toLowerCase().includes("__yarim")) {
    // an answer that starts and then breaks off
    res.writeHead(200, { "content-type": "text/event-stream" })
    sse(res, [["message_start", { type: "message_start", message: { id: "msg_x", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }], ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }], ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Başladım ama" } }]])
    return setTimeout(() => res.destroy(), 50)
  }
  if (last && text(last).toLowerCase().includes("__yavas")) {
    // a long answer written slowly, so a visitor can press "stop" in the middle of it
    res.writeHead(200, { "content-type": "text/event-stream" })
    sse(res, [["message_start", { type: "message_start", message: { id: "msg_slow", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }], ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }]])
    let n = 0
    const timer = setInterval(() => {
      if (n++ >= 60) { clearInterval(timer); sse(res, [["content_block_stop", { type: "content_block_stop", index: 0 }], ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 60 } }], ["message_stop", { type: "message_stop" }]]); return res.end() }
      sse(res, [["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: `parça${n} ` } }]])
    }, 100)
    res.on("close", () => clearInterval(timer))
    return
  }
  const { blocks, stop } = decide(body)
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" })
  const inTok = 400 + JSON.stringify(body.messages).length / 4 | 0
  const ev = [["message_start", { type: "message_start", message: { id: `msg_${Math.random().toString(16).slice(2, 8)}`, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: inTok, output_tokens: 1, cache_read_input_tokens: log.length > 1 ? 300 : 0, cache_creation_input_tokens: 0 } } }]]
  blocks.forEach((b, index) => {
    if (b.type === "text") {
      ev.push(["content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } }])
      // the text arrives in small pieces, like a real stream
      for (let i = 0; i < b.text.length; i += 12) ev.push(["content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text: b.text.slice(i, i + 12) } }])
    } else {
      ev.push(["content_block_start", { type: "content_block_start", index, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } }])
      const json = JSON.stringify(b.input)
      ev.push(["content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(0, 5) } }])
      ev.push(["content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(5) } }])
    }
    ev.push(["content_block_stop", { type: "content_block_stop", index }])
  })
  ev.push(["message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null, ...(stop === "refusal" ? { stop_details: { type: "refusal", category: null, explanation: "test" } } : {}) }, usage: { output_tokens: 42 } }])
  ev.push(["message_stop", { type: "message_stop" }])
  sse(res, ev)
  res.end()
})
server.listen(port, "127.0.0.1", () => console.log(`fake anthropic on :${port}`))
