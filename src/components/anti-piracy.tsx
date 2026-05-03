"use client"

import { useEffect, useState } from "react"

export function AntiPiracy({ userName }: { userName: string }) {
  const [isBlurred, setIsBlurred] = useState(false)
  const [isRecordingDetected, setIsRecordingDetected] = useState(false)

  useEffect(() => {
    // 1. Prevent Right Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => e.preventDefault()
    document.addEventListener("contextmenu", handleContextMenu)

    // 2. Prevent Keyboard Shortcuts (PrintScreen, Save, Print)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault()
        alert("Ekran görüntüsü almak yasaktır! İşleminiz kayıt altına alındı.")
        navigator.clipboard.writeText("Ekran görüntüsü alınmasına izin verilmemektedir.")
      }
      
      // Ctrl/Cmd + P (Print) or S (Save) or Shift+S/4 (Mac screenshots)
      if ((e.ctrlKey || e.metaKey) && ["p", "s", "c"].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && ["s", "3", "4", "5"].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
    }
    document.addEventListener("keydown", handleKeyDown)

    // 3. Blur on Window Focus Lost (Netflix-like protection)
    const handleBlur = () => setIsBlurred(true)
    const handleFocus = () => setIsBlurred(false)
    
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)

    // 4. Overwrite getDisplayMedia to prevent browser screen sharing extensions
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      try {
        // @ts-ignore
        navigator.mediaDevices.getDisplayMedia = () => {
          setIsRecordingDetected(true)
          return Promise.reject(new Error("Platform güvenlik politikaları gereği ekran paylaşımı engellenmiştir."))
        }
      } catch (e) {}
    }

    // 5. Heuristic Screen Recording Detection (Performance & API polling)
    // Checking if MediaRecorder is instantiated globally (often used by extensions)
    const originalMediaRecorder = window.MediaRecorder;
    if (originalMediaRecorder) {
      // @ts-ignore
      window.MediaRecorder = function(...args) {
        setIsRecordingDetected(true)
        alert("Ekran kayıt yazılımı algılandı! Yayın durduruldu.")
        // @ts-ignore
        return new originalMediaRecorder(...args)
      }
    }

    // Check for weird display surfaces that indicate active screen sharing
    const checkScreenShare = setInterval(() => {
      // @ts-ignore
      if (window.navigator?.mediaDevices?.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          // Some virtual cameras or recorders expose themselves as specific videoinputs
          const hasVirtualCamera = devices.some(d => d.label.toLowerCase().includes("obs") || d.label.toLowerCase().includes("virtual"))
          if (hasVirtualCamera) {
            setIsRecordingDetected(true)
          }
        })
      }
    }, 5000)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      clearInterval(checkScreenShare)
      window.MediaRecorder = originalMediaRecorder
    }
  }, [])

  return (
    <>
      {/* Global CSS to prevent selection and printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        body {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        @media print {
          body { display: none !important; }
        }
      `}} />

      {/* Blur Overlay when window is not focused */}
      {isBlurred && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
          <span className="text-red-500 text-5xl mb-4">⚠️</span>
          <h2 className="text-white text-2xl font-display mb-2">Güvenlik Uyarısı</h2>
          <p className="text-gray-400 text-center max-w-md px-6">
            Telif haklarını korumak amacıyla, ekran odağı kaybedildiğinde veya arka plana alındığında yayın otomatik olarak karartılır.
          </p>
        </div>
      )}

      {/* Recording Detected Overlay (Hard Block) */}
      {isRecordingDetected && (
        <div className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center">
          <span className="text-red-500 text-6xl mb-6">🚨</span>
          <h2 className="text-white text-3xl font-display mb-3 text-center">İllegal Ekran Kaydı Algılandı</h2>
          <p className="text-red-400 text-center max-w-lg px-6 text-lg">
            Sistemimiz arka planda çalışan bir ekran kayıt yazılımı, eklentisi veya sanal kamera (Örn: OBS) tespit etti. 
            Yayın güvenliği gereği bağlantınız kesildi. Lütfen kayıt programlarını kapatıp sayfayı yenileyin.
          </p>
        </div>
      )}
    </>
  )
}
