import * as THREE from "three"
import { applyPose, Figure, placeOnFloor } from "@/lib/pose-rig"
import { POSE_CAMERA, RIGS } from "@/lib/pose-rigs"

/**
 * The route the character takes to reach a pose: the first entry is where the movement starts, the last one is the
 * pose itself. Everything not listed walks from the standing mountain pose straight into the pose.
 */
export const MOTION_PATH: Record<string, string[]> = {
  "dag-durusu": ["ayakta-yukari-uzanis", "dag-durusu"],
  "asagi-bakan-kopek": ["dag-durusu", "one-egilme", "asagi-bakan-kopek"],
  "kolay-oturus": ["dag-durusu", "malasana", "kolay-oturus"],
  "cocuk": ["dag-durusu", "malasana", "cocuk"],
  "sfenks": ["dag-durusu", "one-egilme", "asagi-bakan-kopek", "sfenks"],
  "savasana": ["dag-durusu", "malasana", "kolay-oturus", "savasana"],
  "kopru": ["dag-durusu", "kolay-oturus", "savasana", "kopru"],
  "kayik": ["dag-durusu", "kolay-oturus", "kayik"],
  "deve": ["dag-durusu", "malasana", "deve"],
}

export const motionPath = (slug: string): string[] => (MOTION_PATH[slug] ?? ["dag-durusu", slug]).filter((s) => RIGS[s])

interface Keyframe {
  quats: Record<string, THREE.Quaternion>
  hipsPos: THREE.Vector3
  x: number
  z: number
  yaw: number
  /** height of the lowest bone above the floor once the pose is grounded */
  clearance: number
  box: THREE.Box3
}

const tmp = new THREE.Vector3()

function lowestBone(fig: Figure): number {
  let low = Infinity
  for (const k in fig.bones) {
    fig.bones[k].getWorldPosition(tmp)
    if (tmp.y < low) low = tmp.y
  }
  return low
}

function snapshot(fig: Figure, slug: string, keepYaw: boolean): Keyframe {
  const pose = { ...RIGS[slug], ...(keepYaw ? {} : { yaw: 0 }) }
  applyPose(fig, pose)
  fig.root.updateMatrixWorld(true)
  const low0 = lowestBone(fig) // root is at the origin right after applyPose
  placeOnFloor(fig, pose)
  const quats: Record<string, THREE.Quaternion> = {}
  for (const k in fig.bones) quats[k] = fig.bones[k].quaternion.clone()
  const box = new THREE.Box3().setFromObject(fig.root, true)
  return {
    quats,
    hipsPos: fig.bones.Hips.position.clone(),
    x: fig.root.position.x,
    z: fig.root.position.z,
    yaw: fig.root.rotation.y,
    clearance: fig.root.position.y + low0,
    box,
  }
}

const smooth = (s: number) => s * s * (3 - 2 * s)

/** Timing of one loop, in seconds. */
const LEG = 1.15 // one step along the path
const LEG_BACK = 0.8 // the way back
const HOLD_END = 1.5 // staying in the finished pose
const HOLD_START = 0.35

export interface Motion {
  slugs: string[]
  /** time of one full loop (there and back) */
  duration: number
  /** when the finished pose has been held long enough and the way back would start */
  finishAt: number
  /** put the figure where it is `t` seconds into the loop */
  at(t: number): void
  /** the finished pose */
  end(): void
  /** the first pose of the path */
  start(): void
  /** union of the grounded boxes of all poses on the path, in world space */
  bounds: THREE.Box3
  /** camera direction used for the stills of the final pose */
  camera: { az: number; el: number; zoom?: number }
}

/**
 * Builds the movement from the start of the path to the pose and back. Joints are blended per bone; the body is
 * re-grounded every frame from its lowest bone, so a sitting-down or lying-down movement never sinks into the floor
 * or floats above it.
 */
export function buildMotion(fig: Figure, slug: string, opts: { keepYaw?: boolean } = {}): Motion {
  const slugs = motionPath(slug)
  const frames = slugs.map((s) => snapshot(fig, s, !!opts.keepYaw))
  const bounds = new THREE.Box3()
  frames.forEach((f) => bounds.union(f.box))

  const place = (a: Keyframe, b: Keyframe, e: number) => {
    for (const k in fig.bones) fig.bones[k].quaternion.copy(a.quats[k]).slerp(b.quats[k], e)
    fig.bones.Hips.position.copy(a.hipsPos).lerp(b.hipsPos, e)
    fig.root.position.set(a.x + (b.x - a.x) * e, 0, a.z + (b.z - a.z) * e)
    fig.root.rotation.y = a.yaw + (b.yaw - a.yaw) * e
    fig.root.updateMatrixWorld(true)
    fig.root.position.y = a.clearance + (b.clearance - a.clearance) * e - lowestBone(fig)
    fig.root.updateMatrixWorld(true)
  }

  const n = frames.length
  const forward = (n - 1) * LEG
  const back = (n - 1) * LEG_BACK
  const duration = HOLD_START + forward + HOLD_END + back
  const last = frames[n - 1]

  const at = (t0: number) => {
    if (n < 2) { place(last, last, 0); return }
    let t = ((t0 % duration) + duration) % duration
    if (t < HOLD_START) { place(frames[0], frames[0], 0); return }
    t -= HOLD_START
    if (t < forward) {
      const i = Math.min(n - 2, Math.floor(t / LEG))
      place(frames[i], frames[i + 1], smooth((t - i * LEG) / LEG))
      return
    }
    t -= forward
    if (t < HOLD_END) { place(last, last, 0); return }
    t -= HOLD_END
    const j = Math.min(n - 2, Math.floor(t / LEG_BACK)) // j-th step counted from the end
    const from = frames[n - 1 - j], to = frames[n - 2 - j]
    place(from, to, smooth((t - j * LEG_BACK) / LEG_BACK))
  }

  return {
    slugs,
    duration,
    finishAt: HOLD_START + forward + HOLD_END,
    at,
    end: () => place(last, last, 0),
    start: () => place(frames[0], frames[0], 0),
    bounds,
    camera: POSE_CAMERA[slug] ?? { az: 30, el: 8 },
  }
}

/** Camera position that fits the whole movement into a view of the given aspect ratio (same framing rule as the stills). */
export function fitCamera(motion: Motion, aspect: number, fov = 24) {
  const size = motion.bounds.getSize(new THREE.Vector3())
  const c = motion.bounds.getCenter(new THREE.Vector3())
  const az = (motion.camera.az * Math.PI) / 180
  const el = (motion.camera.el * Math.PI) / 180
  const radius = Math.max(size.x, size.z) * 0.55 + size.y * 0.25
  const fitH = Math.max(size.y, 0.4) / 2 + 0.12
  const fitW = Math.max(Math.hypot(size.x, size.z) * 0.5, 0.3) / aspect + 0.1
  const dist = (Math.max(fitH, fitW, radius * 0.8) / Math.tan((fov * Math.PI) / 360)) * 1.04 * (motion.camera.zoom ?? 1)
  return {
    position: new THREE.Vector3(c.x + Math.sin(az) * Math.cos(el) * dist, c.y + Math.sin(el) * dist, c.z + Math.cos(az) * Math.cos(el) * dist),
    target: new THREE.Vector3(c.x, c.y - size.y * 0.02, c.z),
    center: c,
    dist,
  }
}

/** Software GL (no GPU) cannot keep up with a continuously rendered, shadowed figure. */
export function isSoftwareGL(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext()
  const info = gl.getExtension("WEBGL_debug_renderer_info")
  return /swiftshader|llvmpipe|software|softpipe/i.test(String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : ""))
}
