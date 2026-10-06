"use client"

import Link from "next/link"
import { Heart, MessageCircle } from "lucide-react"
import { CommunityPost, SafePhoto, Avatar } from "./parts"

function PhotoTile({ post }: { post: CommunityPost }) {
  return (
    <Link
      href={`/community/${post.id}`}
      className="group relative block aspect-square bg-sage-100 overflow-hidden rounded-sm"
      aria-label={`${post.author.name ?? "Üye"}: ${post.content.slice(0, 60)}`}
    >
      {post.image ? (
        <SafePhoto
          src={post.image}
          alt={post.title || post.content.slice(0, 60)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-sage-200 text-sage-500 text-xs px-3 text-center">
          {post.content.slice(0, 80)}
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex flex-col justify-between p-3">
        {/* Stats (bottom) */}
        <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-5 text-white text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <Heart size={18} fill="white" />
            {post.likeCount}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={18} fill="white" />
            {post.commentCount}
          </span>
        </div>
      </div>

      {/* Teacher badge */}
      {post.author.isTeacher && (
        <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-ink/70 text-cream px-1.5 py-0.5 rounded">
          Eğitmen
        </span>
      )}
    </Link>
  )
}

export function PhotoGrid({ posts }: { posts: CommunityPost[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5">
      {posts.map((p) => (
        <PhotoTile key={p.id} post={p} />
      ))}
    </div>
  )
}

/** Compact horizontal avatar strip showing the most recent posters */
export function RecentPosters({ posts }: { posts: CommunityPost[] }) {
  const seen = new Set<string>()
  const unique = posts.filter((p) => {
    if (seen.has(p.author.id)) return false
    seen.add(p.author.id)
    return true
  }).slice(0, 8)

  if (unique.length === 0) return null

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {unique.map((p) => (
        <Link
          key={p.author.id}
          href={`/community?author=${p.author.id}`}
          className="flex-shrink-0 flex flex-col items-center gap-1 group"
          title={p.author.name ?? "Üye"}
        >
          <span className="block p-0.5 rounded-full bg-gradient-to-tr from-clay-400 to-saffron-400 group-hover:from-clay-500 group-hover:to-saffron-500 transition-colors">
            <span className="block rounded-full overflow-hidden bg-cream p-0.5">
              <Avatar author={p.author} size={44} />
            </span>
          </span>
          <span className="text-[11px] text-sage-600 max-w-[52px] truncate text-center">
            {(p.author.name ?? "Üye").split(" ")[0]}
          </span>
        </Link>
      ))}
    </div>
  )
}
