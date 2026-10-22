import type { PoseRig, V3 } from "@/lib/pose-rig"

const v = (x: number, y: number, z: number): V3 => [x, y, z]
const mirrorX = (d: V3): V3 => [-d[0], d[1], d[2]]
/** flat foot turned `yaw` degrees from +z (positive toward +x) */
const foot = (yaw: number) => {
  const r = (yaw * Math.PI) / 180
  return { f: v(Math.sin(r) * 0.77, -0.63, Math.cos(r) * 0.77), t: v(Math.sin(r), 0, Math.cos(r)) }
}
const UP = v(0, 1, 0)
const DOWN = v(0, -1, 0)
const spineUp = { Spine: UP, Spine1: UP, Spine2: UP, Neck: UP, Head: UP }

/** both arms, mirrored: pass the left arm's three directions */
const arms = (a: V3, f: V3, h: V3) => ({
  LeftArm: a, LeftForeArm: f, LeftHand: h,
  RightArm: mirrorX(a), RightForeArm: mirrorX(f), RightHand: mirrorX(h),
})
/** both legs, mirrored */
const legs = (t: V3, s: V3, fo: V3, to: V3) => ({
  LeftUpLeg: t, LeftLeg: s, LeftFoot: fo, LeftToeBase: to,
  RightUpLeg: mirrorX(t), RightLeg: mirrorX(s), RightFoot: mirrorX(fo), RightToeBase: mirrorX(to),
})

const f0 = foot(8)

export const RIGS: Record<string, PoseRig> = {
  "dag-durusu": {
    aim: { ...spineUp, ...arms(v(0.45, -0.85, 0.15), v(-0.6, 0.6, 0.5), v(-0.55, 0.7, 0.45)), ...legs(v(0.03, -1, 0), DOWN, f0.f, f0.t) },
  },
  "ayakta-yukari-uzanis": {
    aim: { ...spineUp, Spine2: v(0, 1, -0.06), Neck: v(0, 1, -0.1), Head: v(0, 0.95, -0.2), ...arms(v(0.28, 1, 0), v(0.05, 1, 0), v(0.0, 1, 0)), ...legs(v(0.03, -1, 0), DOWN, f0.f, f0.t) },
  },
  "savasci-1": {
    aim: {
      ...spineUp, ...arms(v(0.1, 1, 0.05), v(-0.35, 1, 0), v(-0.35, 1, 0)),
      LeftUpLeg: v(0.03, -0.3, 0.95), LeftLeg: DOWN, RightUpLeg: v(-0.15, -0.69, -0.72), RightLeg: v(-0.15, -0.69, -0.72),
      LeftFoot: foot(0).f, LeftToeBase: foot(0).t, RightFoot: foot(-45).f, RightToeBase: foot(-45).t,
    },
  },
  "savasci-2": {
    aim: {
      ...spineUp, Neck: v(0.1, 1, 0.05), Head: v(0.35, 0.9, 0.25), ...arms(v(1, 0, 0), v(1, 0, 0), v(1, 0, 0)),
      LeftUpLeg: v(0.866, -0.5, 0), LeftLeg: DOWN, RightUpLeg: v(-0.625, -0.78, 0), RightLeg: v(-0.625, -0.78, 0),
      LeftFoot: foot(90).f, LeftToeBase: foot(90).t, RightFoot: foot(0).f, RightToeBase: foot(0).t,
    },
  },
  "agac": {
    aim: {
      ...spineUp, ...arms(v(0.28, 1, 0), v(-0.3, 1, 0), v(-0.3, 1, 0)),
      LeftUpLeg: v(0.7, -0.45, 0.15), LeftLeg: v(-0.9, -0.4, 0.1), LeftFoot: v(-0.2, -0.3, 0.9), LeftToeBase: v(-0.1, 0, 1),
      RightUpLeg: v(-0.01, -1, 0), RightLeg: DOWN, RightFoot: foot(0).f, RightToeBase: foot(0).t,
    },
  },
  "sandalye": {
    aim: {
      Spine: v(0, 0.95, 0.3), Spine1: v(0, 0.9, 0.43), Spine2: v(0, 0.9, 0.43), Neck: v(0, 0.95, 0.3), Head: v(0, 0.97, 0.2),
      ...arms(v(0.08, 0.9, 0.45), v(0.03, 0.9, 0.42), v(0.03, 0.9, 0.42)),
      ...legs(v(0.03, -0.6, 0.8), v(0, -0.92, -0.38), foot(0).f, foot(0).t),
    },
    hips: [18, 0, 0],
  },
  "one-egilme": {
    hips: [28, 0, 0],
    aim: {
      Spine: v(0, 0.35, 0.94), Spine1: v(0, -0.2, 0.98), Spine2: v(0, -0.7, 0.7), Neck: v(0, -0.95, 0.3), Head: v(0, -1, 0.1),
      ...arms(v(0.02, -1, 0.05), v(0, -1, 0.05), v(0, -1, 0.1)),
      ...legs(v(0.02, -1, 0), DOWN, foot(0).f, foot(0).t),
    },
  },
  "ucgen": {
    hips: [0, 0, 6],
    aim: {
      Spine: v(0.35, 0.94, 0), Spine1: v(0.75, 0.66, 0), Spine2: v(0.93, 0.36, 0), Neck: v(0.8, 0.55, 0.1), Head: v(0.3, 0.9, 0.3),
      LeftArm: v(0.05, -1, 0), LeftForeArm: v(0.05, -1, 0), LeftHand: v(0.05, -1, 0),
      RightArm: v(-0.05, 1, 0), RightForeArm: v(-0.05, 1, 0), RightHand: v(-0.05, 1, 0),
      LeftUpLeg: v(0.5, -0.87, 0), LeftLeg: v(0.5, -0.87, 0), RightUpLeg: v(-0.5, -0.87, 0), RightLeg: v(-0.5, -0.87, 0),
      LeftFoot: foot(90).f, LeftToeBase: foot(90).t, RightFoot: foot(10).f, RightToeBase: foot(10).t,
    },
  },
  "asagi-bakan-kopek": {
    hips: [125, 0, 0],
    aim: {
      Spine: v(0, -0.65, 0.76), Spine1: v(0, -0.7, 0.72), Spine2: v(0, -0.75, 0.66), Neck: v(0, -0.8, 0.6), Head: v(0, -1, 0.25),
      ...arms(v(0.05, -0.8, 0.6), v(0.02, -0.8, 0.6), v(0, -0.1, 1)),
      ...legs(v(0.04, -0.78, -0.63), v(0.04, -0.78, -0.63), foot(0).f, foot(0).t),
    },
  },
  "cocuk": {
    hips: [70, 0, 0],
    aim: {
      Spine: v(0, 0.3, 0.95), Spine1: v(0, 0.05, 1), Spine2: v(0, -0.25, 0.97), Neck: v(0, -0.55, 0.83), Head: v(0, -0.9, 0.45),
      ...arms(v(0.08, -0.35, 0.93), v(0.05, -0.15, 0.99), v(0.05, -0.05, 1)),
      LeftUpLeg: v(0.25, -0.45, 0.85), LeftLeg: v(0, 0.02, -1), LeftFoot: v(0, 0.1, -1), LeftToeBase: v(0, 0, -1),
      RightUpLeg: v(-0.25, -0.45, 0.85), RightLeg: v(0, 0.02, -1), RightFoot: v(0, 0.1, -1), RightToeBase: v(0, 0, -1),
    },
  },
  "sfenks": {
    hips: [88, 0, 0],
    aim: {
      Spine: v(0, 0.3, 0.95), Spine1: v(0, 0.6, 0.8), Spine2: v(0, 0.8, 0.6), Neck: v(0, 0.85, 0.5), Head: v(0, 0.3, 0.95),
      ...arms(v(0.06, -1, 0.04), v(0, -0.02, 1), v(0, -0.02, 1)),
      ...legs(v(0.05, 0, -1), v(0.05, 0, -1), v(0.02, 0.45, -0.9), v(0, 0.2, -1)),
    },
  },
  "kolay-oturus": {
    hips: [10, 0, 0],
    aim: {
      ...spineUp, Spine2: v(0, 1, 0.03),
      ...arms(v(0.3, -0.85, 0.45), v(0.35, -0.65, 0.7), v(0.3, -0.45, 0.85)),
      LeftUpLeg: v(0.55, -0.04, 0.83), LeftLeg: v(-0.93, -0.03, -0.2), LeftFoot: v(-0.85, -0.2, -0.4), LeftToeBase: v(-0.9, -0.05, -0.4),
      RightUpLeg: v(-0.55, -0.04, 0.83), RightLeg: v(0.92, 0.15, -0.12), RightFoot: v(0.85, -0.12, -0.4), RightToeBase: v(0.9, -0.05, -0.4),
    },
  },
  "savasana": {
    hips: [-90, 0, 0],
    aim: {
      Spine: v(0, 0, -1), Spine1: v(0, 0, -1), Spine2: v(0, 0, -1), Neck: v(0, 0, -1), Head: v(0, 0.05, -1),
      ...arms(v(0.22, -0.03, 1), v(0.22, -0.03, 1), v(0.22, 0.03, 1)),
      ...legs(v(0.14, 0, 1), v(0.14, 0, 1), v(0.4, 0.85, -0.3), v(0.3, 0.9, 0)),
    },
  },
  "kopru": {
    hips: [-72, 0, 0],
    aim: {
      Spine: v(0, -0.32, -0.95), Spine1: v(0, -0.25, -0.97), Spine2: v(0, -0.15, -0.99), Neck: v(0, 0, -1), Head: v(0, 0, -1),
      ...arms(v(0.06, -0.1, 0.99), v(0.04, -0.03, 1), v(0.04, 0, 1)),
      ...legs(v(0.1, 0.2, 0.98), v(0, -0.99, 0.12), foot(0).f, foot(0).t),
    },
  },
  "malasana": {
    hips: [10, 0, 0],
    aim: {
      Spine: v(0, 0.98, 0.15), Spine1: v(0, 0.98, 0.1), Spine2: v(0, 1, 0), Neck: UP, Head: UP,
      ...arms(v(0.3, -0.8, 0.3), v(-0.65, 0.45, 0.6), v(-0.6, 0.6, 0.5)),
      ...legs(v(0.62, -0.1, 0.78), v(-0.12, -0.8, -0.58), foot(40).f, foot(40).t),
    },
  },
  "kayik": {
    hips: [-38, 0, 0],
    aim: {
      Spine: v(0, 0.85, -0.5), Spine1: v(0, 0.88, -0.45), Spine2: v(0, 0.9, -0.4), Neck: v(0, 0.95, -0.2), Head: v(0, 1, 0),
      ...arms(v(0.12, 0, 1), v(0.05, 0, 1), v(0.05, 0, 1)),
      ...legs(v(0.05, 0.72, 0.69), v(0.03, 0.72, 0.69), v(0.03, 0.72, 0.69), v(0.03, 0.72, 0.69)),
    },
  },
  "deve": {
    hips: [8, 0, 0],
    aim: {
      Spine: v(0, 0.97, -0.1), Spine1: v(0, 0.8, -0.5), Spine2: v(0, 0.5, -0.85), Neck: v(0, 0.2, -1), Head: v(0, -0.3, -0.95),
      ...arms(v(0.08, -0.9, -0.4), v(0, -0.98, -0.2), v(0, -1, 0)),
      LeftUpLeg: v(0.03, -1, 0.1), LeftLeg: v(0, 0.02, -1), LeftFoot: v(0, 0.1, -1), LeftToeBase: v(0, 0, -1),
      RightUpLeg: v(-0.03, -1, 0.1), RightLeg: v(0, 0.02, -1), RightFoot: v(0, 0.1, -1), RightToeBase: v(0, 0, -1),
    },
  },
}
export { foot }

/** camera for the stills: azimuth/elevation in degrees (0° = seen from the front), optional zoom factor */
export const POSE_CAMERA: Record<string, { az: number; el: number; zoom?: number }> = {
  "savasci-2": { az: 22, el: 6 },
  "savasci-1": { az: 55, el: 6 },
  "ucgen": { az: 20, el: 6 },
  "asagi-bakan-kopek": { az: 70, el: 10 },
  "cocuk": { az: 55, el: 22 },
  "sfenks": { az: 50, el: 16 },
  "savasana": { az: 38, el: 30 },
  "kopru": { az: 62, el: 14 },
  "kayik": { az: 60, el: 8 },
  "deve": { az: 60, el: 8 },
  "sandalye": { az: 55, el: 6 },
  "one-egilme": { az: 52, el: 8 },
  "kolay-oturus": { az: 28, el: 10 },
  "malasana": { az: 25, el: 8 },
  "agac": { az: 20, el: 6 },
  "dag-durusu": { az: 22, el: 6 },
  "ayakta-yukari-uzanis": { az: 22, el: 6 },
}
