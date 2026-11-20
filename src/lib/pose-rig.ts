import * as THREE from "three"

/**
 * Poses a Mixamo-rigged character by *aiming* limbs: for every bone the pose says in which world direction its
 * child bone should point (character faces +z, its left is +x, up is +y). That is far easier to author than
 * per-bone Euler angles, whose local axes differ between the left and the right side of the rig.
 */
export type V3 = [number, number, number]
export type AimName =
  | "Spine" | "Spine1" | "Spine2" | "Neck" | "Head"
  | "LeftShoulder" | "RightShoulder"
  | "LeftArm" | "LeftForeArm" | "LeftHand" | "RightArm" | "RightForeArm" | "RightHand"
  | "LeftUpLeg" | "LeftLeg" | "LeftFoot" | "LeftToeBase" | "RightUpLeg" | "RightLeg" | "RightFoot" | "RightToeBase"

export interface PoseRig {
  /** pelvis rotation in world axes, degrees XYZ: x tilts forward/back (positive = forward), z rolls sideways, y turns */
  hips?: V3
  /** direction each bone's child should point to */
  aim: Partial<Record<AimName, V3>>
  /** turn the whole figure about the vertical axis for display (degrees) */
  yaw?: number
  /** shift the figure (metres) after grounding, e.g. to centre a wide pose */
  offset?: V3
  /** thickness of the support under the figure's lowest point (metres) */
  floorGap?: number
}

/** bone → the child bone it points at */
const CHILD: Record<AimName, string> = {
  Spine: "Spine1", Spine1: "Spine2", Spine2: "Neck", Neck: "Head", Head: "HeadTop_End",
  LeftShoulder: "LeftArm", RightShoulder: "RightArm",
  LeftArm: "LeftForeArm", LeftForeArm: "LeftHand", LeftHand: "LeftHandMiddle1",
  RightArm: "RightForeArm", RightForeArm: "RightHand", RightHand: "RightHandMiddle1",
  LeftUpLeg: "LeftLeg", LeftLeg: "LeftFoot", LeftFoot: "LeftToeBase", LeftToeBase: "LeftToe_End",
  RightUpLeg: "RightLeg", RightLeg: "RightFoot", RightFoot: "RightToeBase", RightToeBase: "RightToe_End",
}
/** parents before children, so each aim sees its parent's final orientation */
const ORDER: AimName[] = [
  "Spine", "Spine1", "Spine2", "Neck", "Head",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase",
]

export interface Figure {
  root: THREE.Object3D
  bones: Record<string, THREE.Bone>
  rest: Record<string, THREE.Quaternion>
  restPos: THREE.Vector3
  mesh: THREE.SkinnedMesh | null
}

export function prepareFigure(scene: THREE.Object3D): Figure {
  const bones: Record<string, THREE.Bone> = {}
  let mesh: THREE.SkinnedMesh | null = null
  scene.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones[o.name.replace("mixamorig", "")] = o as THREE.Bone
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh
  })
  const rest: Record<string, THREE.Quaternion> = {}
  for (const k in bones) rest[k] = bones[k].quaternion.clone()
  return { root: scene, bones, rest, restPos: bones.Hips.position.clone(), mesh }
}

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const qa = new THREE.Quaternion()
const qb = new THREE.Quaternion()

export function applyPose(fig: Figure, pose: PoseRig) {
  const { bones, rest, root } = fig
  // back to the rest pose
  for (const k in bones) bones[k].quaternion.copy(rest[k])
  bones.Hips.position.copy(fig.restPos)
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  root.updateMatrixWorld(true)

  if (pose.hips) {
    const d = Math.PI / 180
    const hips = bones.Hips
    const parentQ = (hips.parent as THREE.Object3D).getWorldQuaternion(new THREE.Quaternion())
    const worldQ = hips.getWorldQuaternion(new THREE.Quaternion()).premultiply(qa.setFromEuler(new THREE.Euler(pose.hips[0] * d, pose.hips[1] * d, pose.hips[2] * d, "XYZ")))
    hips.quaternion.copy(parentQ.invert().multiply(worldQ))
    root.updateMatrixWorld(true)
  }
  for (const name of ORDER) {
    const dir = pose.aim[name]
    if (!dir) continue
    const bone = bones[name]
    const child = bones[CHILD[name]]
    if (!bone || !child) continue
    bone.updateWorldMatrix(true, false)
    child.updateWorldMatrix(true, false)
    const from = tmpA.setFromMatrixPosition(bone.matrixWorld)
    const cur = tmpB.setFromMatrixPosition(child.matrixWorld).sub(from).normalize()
    const want = new THREE.Vector3(...dir).normalize()
    const delta = qa.setFromUnitVectors(cur, want)
    const worldQ = bone.getWorldQuaternion(qb).premultiply(delta)
    const parentQ = (bone.parent as THREE.Object3D).getWorldQuaternion(new THREE.Quaternion())
    bone.quaternion.copy(parentQ.invert().multiply(worldQ))
    root.updateMatrixWorld(true)
  }
}

/** Put the figure on the floor (lowest point at y = floorGap), centred on x/z, then turn it by `yaw`. */
export function placeOnFloor(fig: Figure, pose: PoseRig) {
  const { root, mesh } = fig
  root.updateMatrixWorld(true)
  if (mesh) {
    mesh.skeleton.update()
    mesh.computeBoundingBox()
  }
  const box = new THREE.Box3().setFromObject(root, true)
  const c = box.getCenter(new THREE.Vector3())
  root.position.set(-c.x + (pose.offset?.[0] ?? 0), -box.min.y + (pose.floorGap ?? 0) + (pose.offset?.[1] ?? 0), -c.z + (pose.offset?.[2] ?? 0))
  root.rotation.y = ((pose.yaw ?? 0) * Math.PI) / 180
  root.updateMatrixWorld(true)
}
