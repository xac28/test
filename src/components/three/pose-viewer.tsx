"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { loadYogi } from "@/lib/yogi-model"
import { applyPose, placeOnFloor, prepareFigure } from "@/lib/pose-rig"
import { RIGS } from "@/lib/pose-rigs"

/** Interactive 3D view of one pose: drag to turn it around, scroll/pinch to zoom. */
export function PoseViewer({ slug, className = "" }: { slug: string; className?: string }) {
  const mount = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    const el = mount.current
    const pose = RIGS[slug]
    if (!el || !pose) return
    let disposed = false
    let raf = 0
    let renderer: THREE.WebGLRenderer | null = null
    let controls: OrbitControls | null = null
    ;(async () => {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      } catch {
        setState("error")
        return
      }
      const model = await loadYogi().catch(() => null)
      if (disposed || !model || !renderer) { if (!disposed) setState("error"); return }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      el.appendChild(renderer.domElement)
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y"
      renderer.domElement.setAttribute("aria-label", "Pozun 3B görünümü; sürükleyerek döndür")

      const scene = new THREE.Scene()
      scene.add(new THREE.HemisphereLight(0xfff4e8, 0xcfe6e2, 1.5))
      const key = new THREE.DirectionalLight(0xffffff, 2.3)
      key.position.set(2.4, 4.2, 3.2)
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5; key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xffc9a8, 1.0)
      rim.position.set(-3, 2.5, -2.5)
      scene.add(rim)
      const mat = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), new THREE.ShadowMaterial({ opacity: 0.2 }))
      mat.rotation.x = -Math.PI / 2
      mat.position.y = 0.002
      mat.receiveShadow = true
      scene.add(mat)

      const fig = prepareFigure(model)
      scene.add(model)
      applyPose(fig, { ...pose, yaw: 0 })
      placeOnFloor(fig, { ...pose, yaw: 0 })
      const box = new THREE.Box3().setFromObject(model, true)
      const c = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())

      const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40)
      const R = Math.max(size.x, size.y, size.z)
      const dist = R * 2.3 + 0.6
      camera.position.set(c.x + dist * 0.55, c.y + dist * 0.12, c.z + dist * 0.82)
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.copy(c)
      controls.enableDamping = true
      controls.enablePan = false
      controls.minDistance = dist * 0.55
      controls.maxDistance = dist * 1.6
      controls.maxPolarAngle = Math.PI / 2 - 0.05
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      controls.autoRotateSpeed = 1.1
      controls.addEventListener("start", () => { if (controls) controls.autoRotate = false })

      const resize = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1
        renderer!.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(el)
      let visible = true
      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
      io.observe(el)
      const frame = () => {
        raf = requestAnimationFrame(frame)
        if (!visible) return
        controls!.update()
        renderer!.render(scene, camera)
      }
      frame()
      setState("ready")
      ;(el as any).__cleanup = () => { ro.disconnect(); io.disconnect() }
    })()
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ;(el as any).__cleanup?.()
      controls?.dispose()
      if (renderer) { renderer.dispose(); renderer.domElement.remove() }
    }
  }, [slug])

  return (
    <div className={`relative ${className}`}>
      <div ref={mount} className="absolute inset-0" data-testid="pose-viewer" data-state={state} />
      {state === "loading" && <div className="absolute inset-0 flex items-center justify-center text-sm text-sage-500">3B model yükleniyor…</div>}
      {state === "error" && <div className="absolute inset-0 flex items-center justify-center text-sm text-sage-500 px-6 text-center">Bu cihazda 3B görünüm açılamadı; yukarıdaki görseli kullanabilirsin.</div>}
    </div>
  )
}
