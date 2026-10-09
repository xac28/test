// Renders original, copyright-free "photographs" of the AYA world (dawn, studio, pond, sunrise, breath) with three.js.
// Used by scripts/render-photos/render.js; no external assets.
import * as THREE from "/node_modules/three/build/three.module.js"

const W = 2000, H = 1250
const rnd = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

function skyDome(top, mid, horizon) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, hor: { value: new THREE.Color(horizon) } },
    vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 p; void main(){ float h = clamp(p.y*1.6+0.12,0.,1.); vec3 c = mix(hor, mid, smoothstep(0.,0.45,h)); c = mix(c, top, smoothstep(0.35,1.,h)); gl_FragColor = vec4(c,1.); }",
  })
  return new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), mat)
}

function glow(color, size, opacity = 1) {
  const c = document.createElement("canvas"); c.width = c.height = 256
  const g = c.getContext("2d"), grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  const col = new THREE.Color(color), rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`
  grad.addColorStop(0, `rgba(${rgb},1)`); grad.addColorStop(0.25, `rgba(${rgb},0.55)`); grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256)
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity }))
  s.scale.set(size, size, 1)
  return s
}

function ridge(seed, width, height, baseY, z, color, rough = 1) {
  const r = rnd(seed), pts = [new THREE.Vector2(-width / 2, -20)]
  const n = 90; let a = r() * 6, b = r() * 6, c = r() * 6
  for (let i = 0; i <= n; i++) {
    const x = -width / 2 + (i / n) * width
    const y = baseY + height * (0.5 * Math.sin(x * 0.045 + a) + 0.28 * Math.sin(x * 0.11 + b) + 0.14 * Math.sin(x * 0.27 + c) * rough)
    pts.push(new THREE.Vector2(x, y))
  }
  pts.push(new THREE.Vector2(width / 2, -20))
  const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), new THREE.MeshBasicMaterial({ color, fog: true }))
  m.position.z = z
  return m
}

function lotus(scale = 1, petalCol = 0xd9663a, inner = 0xf0a07a) {
  const g = new THREE.Group(), geo = new THREE.SphereGeometry(1, 20, 14)
  const mp = new THREE.MeshStandardMaterial({ color: petalCol, roughness: 0.5 }), mi = new THREE.MeshStandardMaterial({ color: inner, roughness: 0.45 })
  ;[[12, 1.55, 0.18, 0, mp], [9, 1.2, 0.42, 0.1, mi], [6, 0.85, 0.7, 0.2, mp]].forEach(([count, rad, tilt, y, m]) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2, p = new THREE.Mesh(geo, m)
      p.scale.set(0.42, 0.09, 1.18); p.position.set(Math.cos(a) * rad * 0.62, y, Math.sin(a) * rad * 0.62)
      p.rotation.set(0, -a + Math.PI / 2, 0); p.rotateX(-tilt); g.add(p)
    }
  })
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.14, 40), new THREE.MeshStandardMaterial({ color: 0x9e4521 })); disc.position.y = 0.16; g.add(disc)
  g.scale.setScalar(scale)
  return g
}

function figure(cloth = 0xe9dcc6) {
  const f = new THREE.Group(), sph = new THREE.SphereGeometry(1, 32, 24)
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a07c, roughness: 0.65 }), c = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.85 }), cd = new THREE.MeshStandardMaterial({ color: 0xcdbb9c, roughness: 0.9 }), hairM = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 })
  const legL = new THREE.Mesh(sph, cd); legL.scale.set(0.95, 0.2, 0.42); legL.position.set(-0.05, 0.38, 0.38); legL.rotation.y = 0.35
  const legR = legL.clone(); legR.position.set(0.05, 0.43, 0.3); legR.rotation.y = -0.35
  const kL = new THREE.Mesh(sph, cd); kL.scale.setScalar(0.24); kL.position.set(-0.78, 0.45, 0.5); const kR = kL.clone(); kR.position.x = 0.78
  f.add(legL, legR, kL, kR)
  const t = new THREE.Group(); t.position.set(0, 0.55, 0)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.7, 12, 24), c); body.scale.set(1, 1, 0.82); body.position.y = 0.62
  const sh = new THREE.Mesh(sph, c); sh.scale.set(0.62, 0.22, 0.4); sh.position.y = 1.12
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 16), skin); neck.position.y = 1.32
  const head = new THREE.Mesh(sph, skin); head.scale.set(0.3, 0.36, 0.32); head.position.y = 1.68
  const hair = new THREE.Mesh(sph, hairM); hair.scale.set(0.325, 0.3, 0.345); hair.position.set(0, 1.76, -0.03)
  const bun = new THREE.Mesh(sph, hairM); bun.scale.setScalar(0.14); bun.position.set(0, 2.06, -0.06)
  t.add(body, sh, neck, head, hair, bun)
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.78, 8, 16), c); arm.position.set(s * 0.58, 0.62, 0.3); arm.rotation.set(0.62, 0, s * 0.34)
    const hand = new THREE.Mesh(sph, skin); hand.scale.set(0.11, 0.08, 0.13); hand.position.set(s * 0.82, 0.24, 0.62); t.add(arm, hand)
  }
  f.add(t)
  return f
}

function water(color, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.65 }))
  m.rotation.x = -Math.PI / 2; m.position.y = y
  return m
}

function particles(n, spread, color, size, seed = 5) {
  const r = rnd(seed), pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * spread[0]; pos[i * 3 + 1] = r() * spread[1]; pos[i * 3 + 2] = -r() * spread[2] + 2 }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  const gl = glow(color, 1).material.map
  return new THREE.Points(g, new THREE.PointsMaterial({ map: gl, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
}

const SCENES = {
  // warm dawn over layered mountains, figure on a lotus in the foreground
  hero(scene, camera) {
    scene.background = new THREE.Color(0xf6d9c0); scene.fog = new THREE.Fog(0xf3cdb0, 14, 60)
    scene.add(skyDome(0xf1c4a4, 0xf8dcc2, 0xffeed6))
    const sun = glow(0xffd9a0, 22, 0.95); sun.position.set(4, 6, -40); scene.add(sun)
    ;[0xe7b79c, 0xd9a086, 0xc98a73, 0xb27462].forEach((c, i) => scene.add(ridge(10 + i, 140, 6 + i, 2 + i * 0.5, -34 + i * 6, c)))
    const w = water(0xf0c9a8, 0); scene.add(w)
    scene.add(new THREE.HemisphereLight(0xfff0dc, 0xb88563, 1.0))
    const key = new THREE.DirectionalLight(0xffd9a8, 3); key.position.set(5, 6, -3); scene.add(key)
    const fig = figure(); fig.position.set(3.4, 0.15, 3); fig.scale.setScalar(1.0); const lt = lotus(1.7); lt.position.set(3.4, 0, 3); lt.rotation.y = 0.3; scene.add(lt, fig)
    for (let i = 0; i < 7; i++) { const l = lotus(0.5 + Math.random() * 0.4); l.position.set(-4 + i * 1.9 + Math.random(), 0, -2 - Math.random() * 10); scene.add(l) }
    scene.add(particles(260, [24, 7, 26], 0xfff0cf, 0.22))
    camera.position.set(0, 2.4, 14); camera.lookAt(0, 2.1, 0)
  },
  // a dim studio: spot on a mat and a teacher, warm floor
  studio(scene, camera) {
    scene.background = new THREE.Color(0x14110e); scene.fog = new THREE.Fog(0x14110e, 8, 30)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.35, metalness: 0.2 })); floor.rotation.x = -Math.PI / 2; scene.add(floor)
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: 0x241d17, roughness: 0.9 })); wall.position.set(0, 10, -9); scene.add(wall)
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 0.4), new THREE.MeshStandardMaterial({ color: 0x2f261d })); b.position.set(-12 + i * 6, 7, -8.6); scene.add(b) }
    const mat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 2.2), new THREE.MeshStandardMaterial({ color: 0xb9572b, roughness: 0.6 })); mat.position.set(1.2, 0.03, 1); scene.add(mat)
    const fig = figure(); fig.position.set(1.2, 0.1, 1); fig.scale.setScalar(1.0); scene.add(fig)
    scene.add(new THREE.AmbientLight(0xffe6c9, 0.35))
    const spot = new THREE.SpotLight(0xffd7a8, 220, 40, 0.5, 0.6, 1.6); spot.position.set(-2, 9, 5); spot.target.position.set(1.2, 1, 1); scene.add(spot, spot.target)
    const rim = new THREE.PointLight(0xff8a50, 60, 20); rim.position.set(5, 3, -4); scene.add(rim)
    const halo = glow(0xff9d6b, 9, 0.35); halo.position.set(1.2, 2.2, -2); scene.add(halo)
    scene.add(particles(160, [18, 8, 16], 0xffd9a8, 0.14, 9))
    camera.position.set(-3.5, 2.2, 9); camera.lookAt(1.4, 1.4, 0)
  },
  // dusk pond with many lotuses and a glowing moon
  meditation(scene, camera) {
    scene.background = new THREE.Color(0x2a2236); scene.fog = new THREE.Fog(0x3a2c44, 10, 55)
    scene.add(skyDome(0x1b1830, 0x6b4560, 0xf0a77e))
    const moon = glow(0xffe6c9, 14, 0.9); moon.position.set(-6, 9, -38); scene.add(moon)
    ;[0x4a3550, 0x3c2c46, 0x2f2339].forEach((c, i) => scene.add(ridge(30 + i, 140, 5 + i * 1.5, 2.5 + i, -36 + i * 7, c)))
    scene.add(water(0x4a3a62, 0))
    scene.add(new THREE.HemisphereLight(0xffcfb0, 0x3b2c4a, 0.9))
    const key = new THREE.DirectionalLight(0xffc8a0, 2.2); key.position.set(-4, 7, -5); scene.add(key)
    const r = rnd(77)
    for (let i = 0; i < 26; i++) { const l = lotus(0.5 + r() * 0.9, 0xe0714a, 0xf6b08e); l.position.set(-14 + r() * 28, 0, 1 - r() * 24); l.rotation.y = r() * 6; scene.add(l) }
    const fig = figure(0xefe4d0); fig.position.set(3.2, 0.2, 5); fig.scale.setScalar(0.95); const lt = lotus(1.6); lt.position.set(3.2, 0, 5); scene.add(lt, fig)
    scene.add(particles(320, [30, 9, 30], 0xffd2a8, 0.2, 21))
    camera.position.set(0, 2.6, 15); camera.lookAt(0, 2.2, 0)
  },
  // bright sunrise, long soft light
  join(scene, camera) {
    scene.background = new THREE.Color(0xffe3c4); scene.fog = new THREE.Fog(0xffd9b8, 12, 70)
    scene.add(skyDome(0xf3b48f, 0xffd2a8, 0xfff1d8))
    const sun = glow(0xfff0c8, 34, 1); sun.position.set(-8, 5, -45); scene.add(sun)
    ;[0xf3c7a4, 0xe8b18f, 0xd89a7e, 0xc3836c, 0xa86d5c].forEach((c, i) => scene.add(ridge(50 + i, 160, 7 + i * 1.2, 1.5 + i * 0.7, -48 + i * 8, c)))
    scene.add(water(0xffe0bf, 0))
    scene.add(new THREE.HemisphereLight(0xfff3df, 0xd9a888, 1.1))
    const key = new THREE.DirectionalLight(0xffe0b0, 3.4); key.position.set(-6, 5, -6); scene.add(key)
    const fig = figure(); fig.position.set(3.6, 0.1, 3); fig.scale.setScalar(1.0); const lt = lotus(1.7); lt.position.set(3.6, 0, 3); scene.add(lt, fig)
    scene.add(particles(220, [26, 6, 24], 0xfff4d6, 0.2, 31))
    camera.position.set(-1, 2.3, 14.5); camera.lookAt(0.5, 2.2, 0)
  },
  // abstract breath: concentric rings, mist and light
  breath(scene, camera) {
    scene.background = new THREE.Color(0x1d1712); scene.fog = new THREE.Fog(0x1d1712, 12, 40)
    scene.add(skyDome(0x120e0b, 0x3a2418, 0x9a5a38))
    for (let i = 0; i < 14; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 + i * 0.55, 0.012 + i * 0.002, 8, 220), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xe2825a : 0xffd0a8, transparent: true, opacity: 0.8 - i * 0.045 }))
      ring.rotation.x = Math.PI / 2 - 0.45; ring.position.set(0, 1.2, 0); scene.add(ring)
    }
    const core = glow(0xff9d6b, 7, 1); core.position.set(0, 1.4, 0); scene.add(core)
    scene.add(particles(500, [22, 9, 18], 0xffd0a8, 0.16, 41))
    camera.position.set(0, 2.2, 10); camera.lookAt(0, 1.2, 0)
  },
}

export function render(name) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(W, H); renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
  document.body.appendChild(renderer.domElement)
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 200)
  SCENES[name](scene, camera)
  renderer.render(scene, camera)
  return renderer.domElement.toDataURL("image/jpeg", 0.9)
}
export const NAMES = Object.keys(SCENES)
