"use strict"
const { contextBridge, ipcRenderer } = require("electron")

// The only bridge between the (local) pairing screens and the main process.
// Only our own local screens get it; the website inside the studio window does not see the bridge at all.
if (location.protocol === "file:") contextBridge.exposeInMainWorld("ayaStreamer", {
  info: () => ipcRenderer.invoke("aya:info"),
  pair: (code, serverUrl) => ipcRenderer.invoke("aya:pair", { code, serverUrl }),
  retry: () => ipcRenderer.invoke("aya:retry"),
  signOut: () => ipcRenderer.invoke("aya:signout"),
  openExternal: (url) => ipcRenderer.invoke("aya:open-external", url),
})
