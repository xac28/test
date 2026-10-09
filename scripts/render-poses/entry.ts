// Bundled by render.mjs and run in a browser: renders every yoga pose of the library to a PNG.
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { prepareFigure, applyPose, placeOnFloor } from "@/lib/pose-rig"
import { RIGS, POSE_CAMERA } from "@/lib/pose-rigs"

const W = 900, H = 1125
const params = new URLSearchParams(location.search)
const only = params.get("only")

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.add(new THREE.HemisphereLight(0xfff4e8, 0xcfe6e2, 1.5))
const key = new THREE.DirectionalLight(0xffffff, 2.4)
key.position.set(2.4, 4.2, 3.2)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5; key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5
key.shadow.bias = -0.0004
scene.add(key)
const rim = new THREE.DirectionalLight(0xffc9a8, 1.1)
rim.position.set(-3, 2.5, -2.5)
scene.add(rim)

// soft round mat that only receives the shadow
const mat = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64), new THREE.ShadowMaterial({ opacity: 0.22 }))
mat.rotation.x = -Math.PI / 2
mat.position.y = 0.002
mat.receiveShadow = true
scene.add(mat)

new GLTFLoader().load("/models/yogi.glb", (g) => {
  g.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false }
  })
  scene.add(g.scene)
  const fig = prepareFigure(g.scene)
  const results: Record<string, string> = {}
  for (const slug of Object.keys(RIGS)) {
    if (only && only !== slug) continue
    const pose = RIGS[slug]
    applyPose(fig, pose)
    placeOnFloor(fig, pose)
    const box = new THREE.Box3().setFromObject(g.scene, true)
    const c = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const cam = POSE_CAMERA[slug] ?? { az: 35, el: 8 }
    const az = (cam.az * Math.PI) / 180, el = (cam.el * Math.PI) / 180
    const camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 50)
    // fit: the pose's bounding sphere must fit the narrower side
    const radius = Math.max(size.x, size.z) * 0.55 + size.y * 0.25
    const fitH = Math.max(size.y, 0.4) / 2 + 0.12
    const fitW = Math.max(Math.hypot(size.x, size.z) * 0.5, 0.3) / (W / H) + 0.1
    const dist = Math.max(fitH, fitW, radius * 0.8) / Math.tan((24 * Math.PI) / 360) * 1.02 * (cam.zoom ?? 1)
    camera.position.set(c.x + Math.sin(az) * Math.cos(el) * dist, c.y + Math.sin(el) * dist, c.z + Math.cos(az) * Math.cos(el) * dist)
    camera.lookAt(c.x, c.y - size.y * 0.02, c.z)
    renderer.setClearColor(0x000000, 0)
    renderer.render(scene, camera)
    results[slug] = renderer.domElement.toDataURL("image/png")
  }
  ;(window as any).results = results
  ;(window as any).done = true
}, undefined, (e) => { ;(window as any).error = String(e); (window as any).done = true })
