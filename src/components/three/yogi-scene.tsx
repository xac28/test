"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { loadYogi } from "@/lib/yogi-model"
import { applyPose, Figure, placeOnFloor, prepareFigure } from "@/lib/pose-rig"
import { RIGS } from "@/lib/pose-rigs"
import { poseImage } from "@/lib/yoga-poses"

interface Keyframe { quats: Record<string, THREE.Quaternion>; hipsPos: THREE.Vector3; rootPos: THREE.Vector3; yaw: number }

function snapshot(fig: Figure, slug: string): Keyframe {
  const pose = RIGS[slug]
  applyPose(fig, pose)
  placeOnFloor(fig, pose)
  const quats: Record<string, THREE.Quaternion> = {}
  for (const k in fig.bones) quats[k] = fig.bones[k].quaternion.clone()
  return { quats, hipsPos: fig.bones.Hips.position.clone(), rootPos: fig.root.position.clone(), yaw: fig.root.rotation.y }
}

function glowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, "rgba(255,226,190,0.95)")
  grad.addColorStop(0.4, "rgba(246,170,130,0.45)")
  grad.addColorStop(1, "rgba(246,170,130,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/**
 * The AYA character moving through a few yoga poses, with a warm halo and drifting sparks.
 * A still image of the first pose is shown until the model has loaded (and when WebGL / reduced motion rules it out).
 */
export function YogiScene({ poses = ["kolay-oturus", "dag-durusu", "savasci-2", "agac", "ayakta-yukari-uzanis"], className = "", hold = 3.8, label }: { poses?: string[]; className?: string; hold?: number; label?: (slug: string) => void }) {
  const mount = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const labelRef = useRef(label)
  labelRef.current = label

  useEffect(() => {
    const el = mount.current
    if (!el) return
    let disposed = false
    let raf = 0
    let renderer: THREE.WebGLRenderer | null = null
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const cleanups: (() => void)[] = []

    ;(async () => {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
      } catch {
        return // no WebGL: the still image stays
      }
      const model = await loadYogi().catch(() => null)
      if (disposed || !model || !renderer) return

      // without a GPU (software GL) full-rate rendering would starve the page: draw small, unshadowed and at a low frame rate
      const gl = renderer.getContext()
      const dbg = gl.getExtension("WEBGL_debug_renderer_info")
      const soft = /swiftshader|llvmpipe|software|softpipe/i.test(String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ""))
      renderer.setPixelRatio(soft ? 0.7 : Math.min(window.devicePixelRatio, 1.75))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      renderer.shadowMap.enabled = !soft
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      el.appendChild(renderer.domElement)
      renderer.domElement.style.width = "100%"
      renderer.domElement.style.height = "100%"
      renderer.domElement.style.display = "block"
      renderer.domElement.setAttribute("aria-hidden", "true")

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 40)
      scene.add(new THREE.HemisphereLight(0xfff4e8, 0xcfe6e2, 1.5))
      const key = new THREE.DirectionalLight(0xffffff, 2.3)
      key.position.set(2.4, 4.2, 3.2)
      key.castShadow = !soft
      key.shadow.mapSize.set(1024, 1024)
      key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -1
      key.shadow.bias = -0.0005
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xffc9a8, 1.1)
      rim.position.set(-3, 2.5, -2.5)
      scene.add(rim)

      const stage = new THREE.Group()
      scene.add(stage)
      const shadowMat = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.ShadowMaterial({ opacity: 0.2 }))
      shadowMat.rotation.x = -Math.PI / 2
      shadowMat.position.y = 0.002
      shadowMat.receiveShadow = true
      stage.add(shadowMat)

      // halo behind the figure
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.9 }))
      glow.scale.set(3.6, 3.6, 1)
      glow.position.set(0, 0.95, -0.9)
      scene.add(glow)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.012, 12, 128), new THREE.MeshBasicMaterial({ color: 0xf2bb3a, transparent: true, opacity: 0.55 }))
      ring.position.set(0, 0.88, -0.8)
      scene.add(ring)
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.006, 12, 128), new THREE.MeshBasicMaterial({ color: 0xe2684a, transparent: true, opacity: 0.35 }))
      ring2.position.copy(ring.position)
      scene.add(ring2)

      // sparks
      const N = 70
      const pos = new Float32Array(N * 3)
      const seed = new Float32Array(N)
      for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 3.4; pos[i * 3 + 1] = Math.random() * 2.4; pos[i * 3 + 2] = (Math.random() - 0.5) * 1.6 - 0.2; seed[i] = Math.random() }
      const sparkGeo = new THREE.BufferGeometry()
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
      const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.035, transparent: true, opacity: 0.85, depthWrite: false }))
      scene.add(sparks)

      const fig = prepareFigure(model)
      stage.add(model)
      const frames = poses.filter((s) => RIGS[s]).map((s) => snapshot(fig, s))
      let idx = 0
      const apply = (a: Keyframe, b: Keyframe, s: number) => {
        for (const k in fig.bones) fig.bones[k].quaternion.copy(a.quats[k]).slerp(b.quats[k], s)
        fig.bones.Hips.position.copy(a.hipsPos).lerp(b.hipsPos, s)
        fig.root.position.copy(a.rootPos).lerp(b.rootPos, s)
        fig.root.rotation.y = a.yaw + (b.yaw - a.yaw) * s
      }
      apply(frames[0], frames[0], 0)
      labelRef.current?.(poses[0])

      const resize = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1
        renderer!.setSize(w, h, false)
        camera.aspect = w / h
        // keep the whole figure in view on narrow containers too
        const dist = 4.55 * Math.max(1, 0.78 / Math.max(camera.aspect, 0.01))
        camera.position.set(0, 1.0, dist)
        camera.lookAt(0, 0.8, 0)
        camera.updateProjectionMatrix()
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(el)
      cleanups.push(() => ro.disconnect())

      let px = 0, py = 0, tx = 0, ty = 0
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect()
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      }
      window.addEventListener("pointermove", onMove)
      cleanups.push(() => window.removeEventListener("pointermove", onMove))

      let visible = true
      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
      io.observe(el)
      cleanups.push(() => io.disconnect())

      const clock = new THREE.Clock()
      let t = 0
      const TR = 1.7
      let lastDraw = 0
      const frame = (now = 0) => {
        raf = requestAnimationFrame(frame)
        if (!visible || document.hidden) { clock.getDelta(); return }
        if (soft && now - lastDraw < 120) return
        lastDraw = now
        const dt = Math.min(clock.getDelta(), soft ? 0.2 : 0.05)
        t += dt
        if (frames.length > 1) {
          const cycle = hold + TR
          const n = Math.floor(t / cycle) % frames.length
          const local = t % cycle
          const next = (n + 1) % frames.length
          if (n !== idx && local < 0.2) { idx = n }
          const s = local < hold ? 0 : local - hold < TR ? (local - hold) / TR : 1
          const e = s * s * (3 - 2 * s)
          apply(frames[n], frames[next], e)
          if (local >= hold && local - dt < hold) labelRef.current?.(poses[next])
        }
        // breathing: the whole figure rises and settles a little
        const breath = Math.sin(t * 1.4)
        stage.position.y = breath * 0.008
        glow.material.opacity = 0.8 + breath * 0.1
        ring.rotation.z += dt * 0.08
        ring2.rotation.z -= dt * 0.05
        px += (tx - px) * 0.04; py += (ty - py) * 0.04
        stage.rotation.y = px * 0.35
        camera.position.y = 1.0 - py * 0.12
        camera.lookAt(0, 0.8, 0)
        const p = sparkGeo.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < N; i++) {
          p.array[i * 3 + 1] += dt * (0.05 + seed[i] * 0.1)
          if (p.array[i * 3 + 1] > 2.6) p.array[i * 3 + 1] = 0
          p.array[i * 3] += Math.sin(t * 0.5 + seed[i] * 6) * dt * 0.02
        }
        p.needsUpdate = true
        renderer!.render(scene, camera)
      }
      setReady(true)
      if (reduce) renderer.render(scene, camera)
      else frame()
    })()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      cleanups.forEach((c) => c())
      if (renderer) {
        renderer.dispose()
        renderer.domElement.remove()
      }
    }
  }, [poses.join(","), hold]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="scene-3d" className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`}>
      {/* still image: instant first paint, and the fallback without WebGL */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poseImage(poses[0])} alt="" aria-hidden className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`} />
      <div ref={mount} className="absolute inset-0" data-testid="yogi-scene" data-ready={ready ? "1" : "0"} />
    </div>
  )
}
