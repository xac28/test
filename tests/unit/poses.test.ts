import { describe, expect, it } from "vitest"
import { existsSync } from "fs"
import path from "path"
import { POSES, POSE_BY_SLUG, POSE_CATEGORIES, POSE_LEVELS, poseImage } from "../../src/lib/yoga-poses"
import { STYLES, STYLE_BY_SLUG } from "../../src/lib/yoga-styles"
import { RIGS } from "../../src/lib/pose-rigs"
import { MOTION_PATH, motionPath } from "../../src/lib/pose-motion"

describe("yoga pose library", () => {
  it("has unique slugs, known categories and levels", () => {
    expect(new Set(POSES.map((p) => p.slug)).size).toBe(POSES.length)
    for (const p of POSES) {
      expect(POSE_CATEGORIES).toContain(p.category)
      expect(POSE_LEVELS).toContain(p.level)
    }
  })

  it("every pose is fully written and has a 3D rig and a rendered picture", () => {
    for (const p of POSES) {
      expect(p.intro.length, p.slug).toBeGreaterThan(40)
      expect(p.benefits.length, p.slug).toBeGreaterThanOrEqual(3)
      expect(p.steps.length, p.slug).toBeGreaterThanOrEqual(4)
      expect(RIGS[p.slug], `rig for ${p.slug}`).toBeTruthy()
      expect(existsSync(path.join(process.cwd(), "public", poseImage(p.slug))), `image for ${p.slug}`).toBe(true)
    }
  })

  it("cross references between poses and styles resolve", () => {
    for (const p of POSES) {
      for (const c of p.counter) expect(POSE_BY_SLUG[c], `${p.slug} → counter ${c}`).toBeTruthy()
      for (const s of p.styles) expect(STYLE_BY_SLUG[s], `${p.slug} → style ${s}`).toBeTruthy()
    }
    for (const s of STYLES) {
      expect(POSE_BY_SLUG[s.cover], `${s.slug} cover`).toBeTruthy()
      for (const slug of s.poses) expect(POSE_BY_SLUG[slug], `${s.slug} → pose ${slug}`).toBeTruthy()
    }
  })

  it("has no rig without a pose", () => {
    for (const slug of Object.keys(RIGS)) expect(POSE_BY_SLUG[slug], `rig ${slug}`).toBeTruthy()
  })

  it("every movement path ends in its pose and only walks through known poses", () => {
    for (const slug of Object.keys(RIGS)) {
      const path = motionPath(slug)
      expect(path.length, slug).toBeGreaterThanOrEqual(2)
      expect(path[path.length - 1], slug).toBe(slug)
      for (const step of path) expect(RIGS[step], `${slug} via ${step}`).toBeTruthy()
    }
    for (const slug of Object.keys(MOTION_PATH)) expect(RIGS[slug], `path for unknown pose ${slug}`).toBeTruthy()
  })
})
