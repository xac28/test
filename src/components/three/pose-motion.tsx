"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { loadYogi } from "@/lib/yogi-model"
import { prepareFigure } from "@/lib/pose-rig"
import { buildMotion, fitCamera, isSoftwareGL } from "@/lib/pose-motion"
import { RIGS } from "@/lib/pose-rigs"

/**
 * The character performing a pose from start to finish, in a transparent canvas that fills its parent.
 * Used on the pose cards: mounted while the card is hovered / its play button is on, removed afterwards (one
 * WebGL context at a time). `once` stops after one run instead of looping.
 */
export default function PoseMotion({ slug, once = false, onReady, onEnd }: { slug: string; once?: boolean; onReady?: () => void; onEnd?: () => void }) {
  const mount = useRef<HTMLDivElement>(null)
  const cb = useRef({ onReady, onEnd })
  cb.current = { onReady, onEnd }

  useEffect(() => {
    const el = mount.current
    if (!el || !RIGS[slug]) return
    let disposed = false
    let raf = 0
    let renderer: THREE.WebGLRenderer | null = null
    const cleanups: (() => void)[] = []

    ;(async () => {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      } catch {
        return // no WebGL: the still picture stays
      }
      const model = await loadYogi().catch(() => null)
      if (disposed || !model || !renderer) return
      const soft = isSoftwareGL(renderer)
      renderer.setPixelRatio(soft ? 0.6 : Math.min(window.devicePixelRatio, 1.5))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      renderer.shadowMap.enabled = !soft
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      el.appendChild(renderer.domElement)
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block"
      renderer.domElement.setAttribute("aria-hidden", "true")

      const scene = new THREE.Scene()
      scene.add(new THREE.HemisphereLight(0xfff4e8, 0xcfe6e2, 1.5))
      const key = new THREE.DirectionalLight(0xffffff, 2.3)
      key.position.set(2.4, 4.2, 3.2)
      key.castShadow = !soft
      key.shadow.mapSize.set(1024, 1024)
      key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5; key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5
      key.shadow.bias = -0.0004
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xffc9a8, 1.1)
      rim.position.set(-3, 2.5, -2.5)
      scene.add(rim)
      const mat = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.ShadowMaterial({ opacity: 0.22 }))
      mat.rotation.x = -Math.PI / 2
      mat.position.y = 0.002
      mat.receiveShadow = true
      scene.add(mat)

      const fig = prepareFigure(model)
      scene.add(model)
      const motion = buildMotion(fig, slug, { keepYaw: true })
      motion.start()
      const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 60)
      const resize = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1
        renderer!.setSize(w, h, false)
        camera.aspect = w / h
        const f = fitCamera(motion, camera.aspect, 24)
        camera.position.copy(f.position)
        camera.lookAt(f.target)
        camera.updateProjectionMatrix()
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(el)
      cleanups.push(() => ro.disconnect())

      const clock = new THREE.Clock()
      let t = 0
      let last = 0
      let ended = false
      const frame = (now = 0) => {
        raf = requestAnimationFrame(frame)
        if (ended) return
        if (document.hidden) { clock.getDelta(); return }
        if (soft && now - last < 110) return
        last = now
        t += Math.min(clock.getDelta(), soft ? 0.25 : 0.05)
        if (once && t >= motion.finishAt) { // stop in the finished pose, before the way back starts
          ended = true
          motion.end()
          renderer!.render(scene, camera)
          cb.current.onEnd?.()
          return
        }
        motion.at(t)
        renderer!.render(scene, camera)
      }
      renderer.render(scene, camera)
      cb.current.onReady?.()
      frame()
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
  }, [slug, once])

  return <div ref={mount} className="absolute inset-0" data-testid="pose-motion" />
}
