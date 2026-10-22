import { access } from "fs/promises"
import path from "path"
import { db } from "@/lib/db"
import { AuthUser, resolveUser } from "@/lib/auth-utils"

export const POST_MAX = 1000
export const COMMENT_MAX = 500
export const MAX_POSTS_PER_HOUR = 5
export const PAGE_SIZE = 12

export async function optionalUser(req: Request): Promise<AuthUser | null> {
  try {
    return await resolveUser(req)
  } catch {
    return null
  }
}

/** Only files this very user uploaded through the "post" upload type are accepted as a photo. */
export async function isOwnUpload(url: unknown, userId: string): Promise<boolean> {
  if (typeof url !== "string") return false
  const m = /^\/uploads\/posts\/(post-([A-Za-z0-9]+)-\d+\.(?:jpg|jpeg|png|webp))$/.exec(url)
  if (!m || m[2] !== userId) return false
  try {
    await access(path.join(process.cwd(), "public", "uploads", "posts", m[1]))
    return true
  } catch {
    return false
  }
}

/** Newcomers' photos wait for an admin (a filter cannot judge pictures); proven members and staff go live at once. */
export async function statusForNewPost(user: { id: string; role?: string | null }): Promise<"VISIBLE" | "PENDING"> {
  if (user.role === "ADMIN" || user.role === "TEACHER") return "VISIBLE"
  const approved = await db.post.count({ where: { authorId: user.id, status: "VISIBLE" } })
  return approved >= 2 ? "VISIBLE" : "PENDING"
}

type PostRow = {
  id: string; title: string | null; content: string; image: string | null; mediaType: string | null; status: string; removedReason: string | null
  likeCount: number; commentCount: number; createdAt: Date; authorId: string
  author: { id: string; name: string | null; image: string | null; role: string }
}

export function serializePost(p: PostRow, viewer: { id: string; role: string } | null, likedIds: Set<string>) {
  const mine = viewer?.id === p.authorId
  const staff = viewer?.role === "ADMIN"
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    image: p.image,
    mediaType: p.mediaType ?? "image",
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    createdAt: p.createdAt,
    liked: likedIds.has(p.id),
    mine,
    // only the owner and the admins ever learn that a post is not (yet) public, and why
    status: mine || staff ? p.status : undefined,
    removedReason: mine || staff ? p.removedReason : undefined,
    author: { id: p.author.id, name: p.author.name, image: p.author.image, isTeacher: p.author.role === "TEACHER" },
  }
}

export const postInclude = { author: { select: { id: true, name: true, image: true, role: true } } } as const

export async function likedSet(viewerId: string | undefined, postIds: string[]): Promise<Set<string>> {
  if (!viewerId || !postIds.length) return new Set()
  const rows = await db.like.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true } })
  return new Set(rows.map((r) => r.postId))
}
