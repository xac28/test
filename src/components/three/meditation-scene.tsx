"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

/**
 * A procedurally modelled meditating figure on a lotus, with a glowing halo and drifting particles.
 * No external assets: everything is built from primitives so it loads instantly and never breaks offline.
 * It breathes, follows the pointer slightly, pauses when off-screen and renders a single still frame
 * when the visitor prefers reduced motion.
 */

type Variant = "figure" | "lotus"

const CLAY = 0xc9633a
const CLAY_DEEP = 0x9e4521
const SAND = 0xe9dcc6
const SKIN = 0xd9a07c

function makeGlowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, "rgba(255,236,210,1)")
  grad.addColorStop(0.35, "rgba(255,196,150,0.55)")
  grad.addColorStop(1, "rgba(255,180,130,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

function buildLotus(mat: { petal: THREE.Material; petalInner: THREE.Material; disc: THREE.Material }) {
  const lotus = new THREE.Group()
  const petalGeo = new THREE.SphereGeometry(1, 24, 16)
  const rings = [
    { count: 12, radius: 1.55, scale: [0.28, 0.06, 0.62] as const, tilt: 0.18, y: 0.0, m: mat.petal },
    { count: 9, radius: 1.2, scale: [0.26, 0.06, 0.55] as const, tilt: 0.42, y: 0.1, m: mat.petalInner },
    { count: 6, radius: 0.85, scale: [0.22, 0.06, 0.45] as const, tilt: 0.7, y: 0.2, m: mat.petal },
  ]
  for (const r of rings) {
    for (let i = 0; i < r.count; i++) {
      const a = (i / r.count) * Math.PI * 2 + (r.count % 2) * 0.2
      const petal = new THREE.Mesh(petalGeo, r.m)
      petal.scale.set(r.scale[0] * 1.5, r.scale[1] * 1.5, r.scale[2] * 1.9)
      petal.position.set(Math.cos(a) * r.radius * 0.62, r.y, Math.sin(a) * r.radius * 0.62)
      petal.rotation.set(0, -a + Math.PI / 2, 0)
      petal.rotateX(-r.tilt)
      lotus.add(petal)
    }
  }
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.14, 48), mat.disc)
  disc.position.y = 0.16
  lotus.add(disc)
  return lotus
}

function buildFigure(skin: THREE.Material, cloth: THREE.Material, clothDark: THREE.Material) {
  const fig = new THREE.Group()
  const sph = new THREE.SphereGeometry(1, 32, 24)

  // crossed legs: two flattened ellipsoids + knees
  const legL = new THREE.Mesh(sph, clothDark)
  legL.scale.set(0.95, 0.2, 0.42)
  legL.position.set(-0.05, 0.38, 0.38)
  legL.rotation.y = 0.35
  const legR = legL.clone()
  legR.position.set(0.05, 0.43, 0.3)
  legR.rotation.y = -0.35
  fig.add(legL, legR)
  const kneeL = new THREE.Mesh(sph, clothDark)
  kneeL.scale.setScalar(0.24)
  kneeL.position.set(-0.78, 0.45, 0.5)
  const kneeR = kneeL.clone()
  kneeR.position.set(0.78, 0.45, 0.5)
  fig.add(kneeL, kneeR)

  // torso (breathes): capsule, slightly tapered
  const torso = new THREE.Group()
  torso.position.set(0, 0.55, 0)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.7, 12, 24), cloth)
  body.scale.set(1, 1, 0.82)
  body.position.y = 0.62
  torso.add(body)
  const shoulders = new THREE.Mesh(sph, cloth)
  shoulders.scale.set(0.62, 0.22, 0.4)
  shoulders.position.y = 1.12
  torso.add(shoulders)

  // neck + head + bun
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 16), skin)
  neck.position.y = 1.32
  const head = new THREE.Mesh(sph, skin)
  head.scale.set(0.3, 0.36, 0.32)
  head.position.y = 1.68
  const hair = new THREE.Mesh(sph, new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 }))
  hair.scale.set(0.325, 0.3, 0.345)
  hair.position.set(0, 1.76, -0.03)
  const bun = new THREE.Mesh(sph, hair.material)
  bun.scale.setScalar(0.14)
  bun.position.set(0, 2.06, -0.06)
  torso.add(neck, head, hair, bun)

  // arms resting on the knees, hands in a mudra
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.78, 8, 16)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, cloth)
    arm.position.set(side * 0.58, 0.62, 0.3)
    arm.rotation.set(0.62, 0, side * 0.34)
    torso.add(arm)
    const hand = new THREE.Mesh(sph, skin)
    hand.scale.set(0.11, 0.08, 0.13)
    hand.position.set(side * 0.82, 0.24, 0.62)
    torso.add(hand)
  }
  fig.add(torso)
  return { fig, torso }
}

export function MeditationScene({ variant = "figure", className = "" }: { variant?: Variant; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" })
    } catch {
      setUnsupported(true)
      return
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y"
    renderer.domElement.setAttribute("aria-hidden", "true")

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(variant === "figure" ? 32 : 38, 1, 0.1, 50)
    camera.position.set(0, variant === "figure" ? 2.9 : 3.4, variant === "figure" ? 10.4 : 7)
    camera.lookAt(0, variant === "figure" ? 1.75 : 0.3, 0)

    // lights: warm key, cool fill, rim
    scene.add(new THREE.HemisphereLight(0xfff1de, 0x8a6a55, 0.9))
    const key = new THREE.DirectionalLight(0xffe2c0, 2.4)
    key.position.set(3, 5, 4)
    const rim = new THREE.DirectionalLight(0xff9d6b, 1.6)
    rim.position.set(-4, 3, -3)
    scene.add(key, rim)

    const mats = {
      petal: new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.55, metalness: 0.05 }),
      petalInner: new THREE.MeshStandardMaterial({ color: 0xe9936b, roughness: 0.5 }),
      disc: new THREE.MeshStandardMaterial({ color: CLAY_DEEP, roughness: 0.6 }),
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.65 }),
      cloth: new THREE.MeshStandardMaterial({ color: SAND, roughness: 0.85 }),
      clothDark: new THREE.MeshStandardMaterial({ color: 0xd2c2a6, roughness: 0.9 }),
      halo: new THREE.MeshBasicMaterial({ color: 0xff9d6b, transparent: true, opacity: 0.85 }),
      ring: new THREE.MeshBasicMaterial({ color: 0xc9633a, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    }

    const world = new THREE.Group()
    scene.add(world)
    const lotus = buildLotus(mats)
    world.add(lotus)

    let torso: THREE.Group | null = null
    let halo: THREE.Mesh | null = null
    if (variant === "figure") {
      const built = buildFigure(mats.skin, mats.cloth, mats.clothDark)
      built.fig.position.y = 0.2
      world.add(built.fig)
      torso = built.torso
      halo = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.025, 12, 96), mats.halo)
      halo.position.set(0, 2.85, -0.7)
      world.add(halo)
    }

    // slowly turning orbit rings
    const rings: THREE.Mesh[] = []
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(2.1 + i * 0.55, 2.13 + i * 0.55, 128), mats.ring)
      r.rotation.x = -Math.PI / 2 + 0.0
      r.position.y = 0.05 + i * 0.01
      world.add(r)
      rings.push(r)
    }

    // drifting light particles
    const N = variant === "figure" ? 160 : 110
    const pos = new Float32Array(N * 3)
    const seeds: { r: number; a: number; y: number; s: number }[] = []
    for (let i = 0; i < N; i++) {
      const r = 1.6 + Math.random() * 2.6
      const a = Math.random() * Math.PI * 2
      const y = Math.random() * 4.2
      seeds.push({ r, a, y, s: 0.1 + Math.random() * 0.25 })
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    const glow = makeGlowTexture()
    const pMat = new THREE.PointsMaterial({ map: glow, size: 0.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })
    const points = new THREE.Points(pGeo, pMat)
    world.add(points)

    // sizing
    const resize = () => {
      const w = el.clientWidth || 1
      const h = el.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // pointer parallax
    const target = { x: 0, y: 0 }
    const cur = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect()
      target.x = ((e.clientX - b.left) / b.width - 0.5) * 2
      target.y = ((e.clientY - b.top) / b.height - 0.5) * 2
    }
    window.addEventListener("pointermove", onMove, { passive: true })

    const clock = new THREE.Clock()
    let raf = 0
    let visible = true
    const frame = () => {
      const t = clock.getElapsedTime()
      cur.x += (target.x - cur.x) * 0.05
      cur.y += (target.y - cur.y) * 0.05
      world.rotation.y = Math.sin(t * 0.25) * 0.35 + cur.x * 0.35
      world.rotation.x = cur.y * 0.04
      if (torso) {
        const breath = Math.sin(t * 1.1)
        torso.scale.set(1 + breath * 0.012, 1 + breath * 0.022, 1 + breath * 0.012)
        torso.position.y = 0.55 + breath * 0.012
      }
      if (halo) {
        halo.rotation.z = t * 0.2
        const s = 1 + Math.sin(t * 1.1) * 0.03
        halo.scale.setScalar(s)
        ;(halo.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t * 1.1) * 0.2
      }
      rings.forEach((r, i) => {
        r.rotation.z = t * (0.08 + i * 0.04) * (i % 2 ? -1 : 1)
        r.scale.setScalar(1 + Math.sin(t * 0.8 + i) * 0.015)
      })
      const attr = pGeo.getAttribute("position") as THREE.BufferAttribute
      for (let i = 0; i < N; i++) {
        const sd = seeds[i]
        const a = sd.a + t * sd.s * 0.25
        const y = (sd.y + t * sd.s * 0.35) % 4.4
        attr.setXYZ(i, Math.cos(a) * sd.r, y, Math.sin(a) * sd.r)
      }
      attr.needsUpdate = true
      renderer.render(scene, camera)
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(frame)
      else raf = 0
    }
    const start = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    frame()

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !reduce) start()
    })
    io.observe(el)
    const onVis = () => {
      if (!document.hidden && visible && !reduce) start()
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("visibilitychange", onVis)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      Object.values(mats).forEach((m) => m.dispose())
      glow.dispose()
      pMat.dispose()
      pGeo.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [variant])

  return (
    <div ref={host} className={className || "relative w-full h-full"} data-testid="scene-3d" data-variant={variant} role="img" aria-label="Lotus üzerinde meditasyon yapan figür">
      {unsupported && <StaticLotus />}
    </div>
  )
}

/** Shown when WebGL is unavailable. */
function StaticLotus() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full text-clay-500" aria-hidden>
      {[28, 44, 60, 76].map((r) => <circle key={r} cx="100" cy="110" r={r} fill="none" stroke="currentColor" strokeWidth="0.6" opacity={0.5} />)}
      <ellipse cx="100" cy="140" rx="46" ry="9" fill="currentColor" opacity="0.55" />
      <rect x="82" y="78" width="36" height="58" rx="18" fill="#e9dcc6" />
      <circle cx="100" cy="64" r="15" fill="#d9a07c" />
    </svg>
  )
}
