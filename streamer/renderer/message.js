"use strict"
const $ = (id) => document.getElementById(id)
window.ayaStreamer.info().then((i) => {
  $("title").textContent = i.title || "Bir sorun var"
  $("text").textContent = i.message || ""
  if (i.updateUrl) { $("update").hidden = false; $("update").onclick = () => window.ayaStreamer.openExternal(i.updateUrl) }
})
$("retry").onclick = () => window.ayaStreamer.retry()
$("out").onclick = () => window.ayaStreamer.signOut()
