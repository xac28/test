import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { clone } from "three/addons/utils/SkeletonUtils.js"

let cached: Promise<THREE.Group> | null = null

/** The rigged yoga character (public/models/yogi.glb). Loaded once; every caller gets its own skinned copy. */
export async function loadYogi(): Promise<THREE.Object3D> {
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      new GLTFLoader().load("/models/yogi.glb", (g) => resolve(g.scene), undefined, reject)
    })
    cached.catch(() => { cached = null })
  }
  const scene = await cached
  const copy = clone(scene)
  copy.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false }
  })
  return copy
}
