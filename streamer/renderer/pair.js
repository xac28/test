"use strict"
const $ = (id) => document.getElementById(id)
const err = (m) => { $("error").textContent = m; $("error").hidden = !m }

window.ayaStreamer.info().then((i) => { $("server").value = i.serverUrl || ""; if (i.message) err(i.message) })

$("code").addEventListener("input", (e) => {
  const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
  e.target.value = v.length > 4 ? `${v.slice(0, 4)}-${v.slice(4)}` : v
})

$("form").addEventListener("submit", async (e) => {
  e.preventDefault()
  err("")
  $("go").disabled = true
  $("go").textContent = "Bağlanılıyor…"
  const r = await window.ayaStreamer.pair($("code").value, $("server").value)
  if (r && r.ok) return // the main process now opens the studio
  err((r && r.error) || "Bağlanılamadı.")
  $("go").disabled = false
  $("go").textContent = "Bağla"
})
