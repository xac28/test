"use strict"
const { app, BrowserWindow, Menu, session, shell, ipcMain, safeStorage, desktopCapturer, dialog } = require("electron")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { normalizeCode, normalizeServerUrl, isSameOrigin, isSafeExternal, olderThan, ALLOWED_PERMISSIONS } = require("./lib")

/**
 * AYA Yayın Stüdyosu — a locked-down window around the website's live studio.
 *
 * Trust model: the app holds one long-lived *device token* (issued once, in exchange for a short pairing code the teacher
 * creates while signed in on the website). With it the app asks the server for a 12-hour web session for exactly that
 * teacher. The server re-checks on every use that the owner is still an eligible teacher and the device not revoked.
 * Nothing in here can open a broadcast for anybody else: the studio is the normal website, which enforces its own rules.
 */

const VERSION = app.getVersion()
const CONFIG = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "app-config.json"), "utf8")) } catch { return {} }
})()
const DEFAULT_SERVER = normalizeServerUrl(process.env.AYA_SERVER_URL || CONFIG.serverUrl || "") || ""
const DATA = () => path.join(app.getPath("userData"), "aya-device.json")

let win = null
let server = DEFAULT_SERVER
let state = { title: "", message: "", updateUrl: "" } // what the local screens show
let renew = null

// ── device token: encrypted with the operating system's store (DPAPI on Windows) ───────────
function saveDevice(data) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Bu bilgisayarda güvenli depolama kullanılamıyor.")
  fs.mkdirSync(path.dirname(DATA()), { recursive: true })
  fs.writeFileSync(DATA(), safeStorage.encryptString(JSON.stringify(data)), { mode: 0o600 })
}
function loadDevice() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const d = JSON.parse(safeStorage.decryptString(fs.readFileSync(DATA())))
    return d && typeof d.token === "string" && normalizeServerUrl(d.server || "") ? d : null
  } catch { return null }
}
function clearDevice() { try { fs.unlinkSync(DATA()) } catch {} }

// ── talking to the server ──────────────────────────────────────────────────────────────
async function call(pathname, { method = "GET", body, token, base } = {}) {
  const res = await fetch(`${base || server}${pathname}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), "X-Streamer-Version": VERSION },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// ── windows ────────────────────────────────────────────────────────────────────────────
function show(file) { return win.loadFile(path.join(__dirname, "renderer", file)) }

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 900, minHeight: 600,
    title: "AYA Yayın Stüdyosu", backgroundColor: "#12272b", autoHideMenuBar: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false },
  })
  // the studio window may only ever be at the server's address; everything else opens in the normal browser (https only)
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file://")) return
    if (!server || !isSameOrigin(url, server)) { e.preventDefault(); if (isSafeExternal(url)) shell.openExternal(url) }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url) && (!server || !isSameOrigin(url, server))) shell.openExternal(url)
    else if (server && isSameOrigin(url, server)) win.loadURL(url)
    return { action: "deny" }
  })
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} AYAStreamer/${VERSION}`)
  win.on("closed", () => { win = null })
}

function securePermissions() {
  const ses = session.defaultSession
  const ok = (wc, permission) => {
    if (!ALLOWED_PERMISSIONS.has(permission)) return false
    const url = wc && wc.getURL ? wc.getURL() : ""
    return !!server && isSameOrigin(url, server)
  }
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(ok(wc, permission)))
  ses.setPermissionCheckHandler((wc, permission) => ok(wc, permission))
  // screen sharing: the person picks a screen or window from a short list; system audio is captured on Windows
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 0, height: 0 } })
      if (!sources.length) return callback({})
      let pick = sources[0]
      if (sources.length > 1) {
        const list = sources.slice(0, 6)
        const r = await dialog.showMessageBox(win, { type: "question", title: "Paylaşılacak ekran", message: "Hangi ekranı ya da pencereyi paylaşmak istiyorsun?", buttons: [...list.map((s) => s.name.slice(0, 60)), "Vazgeç"], cancelId: list.length, defaultId: 0, noLink: true })
        if (r.response >= list.length) return callback({})
        pick = list[r.response]
      }
      callback({ video: pick, audio: process.platform === "win32" ? "loopback" : undefined })
    } catch { callback({}) }
  }, { useSystemPicker: false })
  // certificates are never ignored
  app.on("certificate-error", (e, wc, url, error, cert, cb) => { e.preventDefault(); cb(false) })
}

// ── flow ───────────────────────────────────────────────────────────────────────────────
async function enter(device) {
  state = { title: "", message: "", updateUrl: "" }
  server = device.server
  const me = await call("/api/streamer/me", { token: device.token, base: device.server }).catch(() => null)
  if (!me) { state = { title: "Sunucuya ulaşılamıyor", message: "İnternet bağlantını kontrol edip tekrar dene.", updateUrl: "" }; return show("message.html") }
  if (me.status === 401) { clearDevice(); state = { title: "", message: "Bu bilgisayarın oturumu sona erdi. Web sitesinden yeni bir kod al.", updateUrl: "" }; return show("pair.html") }
  if (me.status === 403) { state = { title: "Erişim yok", message: me.data.error || "Bu hesap yayın uygulamasını kullanamaz.", updateUrl: "" }; return show("message.html") }
  if (!me.ok) { state = { title: "Bir sorun var", message: me.data.error || "Beklenmeyen bir hata oluştu.", updateUrl: "" }; return show("message.html") }
  const min = me.data.release && me.data.release.minVersion
  if (min && olderThan(VERSION, min)) {
    state = { title: "Güncelleme gerekli", message: `Bu sürüm (${VERSION}) artık desteklenmiyor. ${min} veya daha yenisini web sitesinden indir.`, updateUrl: `${device.server}/teach/uygulama` }
    return show("message.html")
  }
  const ok = await refreshSession(device)
  if (!ok) return
  await win.loadURL(`${device.server}/live/studio`)
  clearInterval(renew)
  renew = setInterval(() => refreshSession(device).catch(() => {}), 6 * 3600 * 1000) // the 12-hour cookie is renewed while the app stays open
}

async function refreshSession(device) {
  const r = await call("/api/streamer/session", { method: "POST", token: device.token, base: device.server }).catch(() => null)
  if (!r) { state = { title: "Sunucuya ulaşılamıyor", message: "İnternet bağlantını kontrol edip tekrar dene.", updateUrl: "" }; await show("message.html"); return false }
  if (r.status === 426) { state = { title: "Güncelleme gerekli", message: r.data.error || "Uygulamayı güncelle.", updateUrl: `${device.server}/teach/uygulama` }; await show("message.html"); return false }
  if (r.status === 401) { clearDevice(); state = { title: "", message: "Bu bilgisayarın oturumu sona erdi. Web sitesinden yeni bir kod al.", updateUrl: "" }; await show("pair.html"); return false }
  if (!r.ok) { state = { title: r.status === 403 ? "Erişim yok" : "Bir sorun var", message: r.data.error || "Oturum açılamadı.", updateUrl: "" }; await show("message.html"); return false }
  const c = r.data.cookie
  await session.defaultSession.cookies.set({ url: device.server, name: c.name, value: c.value, secure: !!c.secure, httpOnly: true, sameSite: "lax", expirationDate: Math.floor(c.expiresAt / 1000) })
  return true
}

async function start() {
  const device = loadDevice()
  if (device) return enter(device)
  state = { title: "", message: "", updateUrl: "" }
  return show("pair.html")
}

ipcMain.handle("aya:info", () => ({ serverUrl: server, version: VERSION, ...state }))
ipcMain.handle("aya:retry", () => start())
ipcMain.handle("aya:open-external", (_e, url) => { if (isSafeExternal(url)) shell.openExternal(url) })
ipcMain.handle("aya:pair", async (e, { code, serverUrl }) => {
  if (!win || e.sender !== win.webContents || !e.senderFrame.url.startsWith("file://")) return { ok: false, error: "İzin yok." } // only our own local screen may pair
  const base = normalizeServerUrl(serverUrl || server)
  if (!base) return { ok: false, error: "Sunucu adresi geçersiz. Adres https:// ile başlamalı." }
  const c = normalizeCode(code)
  if (!c) return { ok: false, error: "Kod 8 karakter olmalı (ör. K7QM-4TXD)." }
  // check before the code is spent: if the token cannot be stored safely, pairing must not start
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: "Bu bilgisayarda güvenli depolama kullanılamıyor." }
  const r = await call("/api/streamer/pair", { method: "POST", body: { code: c, deviceName: os.hostname(), appVersion: VERSION }, base }).catch(() => null)
  if (!r) return { ok: false, error: "Sunucuya ulaşılamadı. Adresi ve internet bağlantını kontrol et." }
  if (!r.ok) return { ok: false, error: r.data.error || "Bağlanılamadı." }
  try { saveDevice({ token: r.data.token, server: base, user: r.data.user && r.data.user.name }) } catch (err) { return { ok: false, error: err.message } }
  setImmediate(() => start())
  return { ok: true }
})
async function signOut() {
  const d = loadDevice()
  if (d) await call("/api/streamer/logout", { method: "POST", token: d.token, base: d.server }).catch(() => {})
  clearDevice()
  await session.defaultSession.clearStorageData()
  clearInterval(renew)
  state = { title: "", message: "Bu bilgisayarın bağlantısı kaldırıldı.", updateUrl: "" }
  return show("pair.html")
}
ipcMain.handle("aya:signout", () => signOut())

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "Dosya", submenu: [
      { label: "Yenile", accelerator: "CmdOrCtrl+R", click: () => start() },
      { label: "Bu bilgisayarın bağlantısını kaldır", click: () => signOut() },
      { type: "separator" },
      { role: "quit", label: "Çık" },
    ] },
    { label: "Görünüm", submenu: [{ role: "togglefullscreen", label: "Tam ekran" }, { role: "zoomIn", label: "Yakınlaştır" }, { role: "zoomOut", label: "Uzaklaştır" }, { role: "resetZoom", label: "Sıfırla" }] },
    { label: "Yardım", submenu: [{ label: "AYA web sitesi", click: () => server && shell.openExternal(server) }, { label: `Sürüm ${VERSION}`, enabled: false }] },
  ]))
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.whenReady().then(() => {
    securePermissions()
    createWindow()
    buildMenu()
    start()
    app.on("activate", () => { if (!win) { createWindow(); start() } })
  })
  app.on("window-all-closed", () => app.quit())
  // no remote debugging, no extra windows with node
  app.on("web-contents-created", (_e, wc) => { wc.on("will-attach-webview", (e) => e.preventDefault()) })
}
