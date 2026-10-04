/**
 * Friendly illustrated avatar used wherever a person has no photo: the same name always gives the same face,
 * so teachers and members stay recognisable without an upload. Pure SVG, no network.
 */
const SKIN = ["#f5d3b8", "#eebd96", "#d9a273", "#b97c52", "#8d5a3b", "#6b412a"]
const HAIR = ["#1d1713", "#3a2618", "#5c3a21", "#8a5a2b", "#c28a43", "#6d6d70", "#9b3d2e"]
const CLOTH = ["#1f6b66", "#e2684a", "#7b63bd", "#f2bb3a", "#c24d77", "#2a857d", "#47a39a", "#ee8466"]
const BG: [string, string][] = [["#fce6dc", "#fdf0cf"], ["#d6ece9", "#eef7f6"], ["#ece7f7", "#f9e3ea"], ["#fdf0cf", "#fce6dc"], ["#aedbd5", "#eef7f6"], ["#f9e3ea", "#fce6dc"]]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const pick = <T,>(arr: T[], h: number, shift: number) => arr[((h >>> shift) & 0xffff) % arr.length]

export function PersonAvatar({ name, seed, size = 40, className = "", rounded = true }: { name?: string | null; seed?: string; size?: number | "full"; className?: string; rounded?: boolean }) {
  const key = seed || name || "aya"
  const h = hash(key)
  const skin = pick(SKIN, h, 0)
  const hair = pick(HAIR, h, 3)
  const cloth = pick(CLOTH, h, 6)
  const [bg1, bg2] = pick(BG, h, 9)
  const style = ((h >>> 12) & 0xff) % 5 // 0 bun, 1 long, 2 short, 3 curly, 4 wavy side
  const glasses = ((h >>> 20) & 0x7) === 0
  const gid = `av${h.toString(36)}`
  const eye = "#2a1d16"
  return (
    <svg
      width={size === "full" ? "100%" : size} height={size === "full" ? "100%" : size} viewBox="0 0 100 100" role="img" aria-label={name ? `${name} için avatar` : "Avatar"}
      preserveAspectRatio="xMidYMid slice" className={`shrink-0 ${rounded ? "rounded-full" : ""} ${className}`} data-testid="person-avatar"
    >
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={bg1} /><stop offset="1" stopColor={bg2} /></linearGradient></defs>
      <rect width="100" height="100" fill={`url(#${gid})`} />
      {/* back hair */}
      {style === 1 && <path d="M27 48c0-22 10-31 23-31s23 9 23 31v28c0 6-6 9-12 8H39c-6 1-12-2-12-8z" fill={hair} />}
      {style === 3 && <g fill={hair}><circle cx="30" cy="40" r="11" /><circle cx="38" cy="29" r="12" /><circle cx="50" cy="25" r="13" /><circle cx="62" cy="29" r="12" /><circle cx="70" cy="40" r="11" /></g>}
      {style === 0 && <circle cx="50" cy="17" r="10" fill={hair} />}
      {/* shoulders */}
      <path d="M12 100c2-20 16-30 38-30s36 10 38 30z" fill={cloth} />
      <path d="M40 70c3 7 17 7 20 0" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* neck */}
      <rect x="43" y="58" width="14" height="16" rx="5" fill={skin} />
      <path d="M43 66c4 4 10 4 14 0v-4H43z" fill="rgba(0,0,0,0.08)" />
      {/* face */}
      <ellipse cx="50" cy="44" rx="20" ry="23" fill={skin} />
      <ellipse cx="30.5" cy="46" rx="3.4" ry="5" fill={skin} /><ellipse cx="69.5" cy="46" rx="3.4" ry="5" fill={skin} />
      {/* front hair */}
      {style === 0 && <path d="M30 40c1-14 9-21 20-21s19 7 20 21c-5-8-12-11-20-11s-15 3-20 11z" fill={hair} />}
      {style === 1 && <path d="M29 42c1-15 9-23 21-23s20 8 21 23c-4-7-8-12-14-14-4 5-14 8-28 14z" fill={hair} />}
      {style === 2 && <path d="M29 42c-1-17 9-26 21-26s22 9 21 26c-4-5-6-9-8-13-8 4-22 4-30 0-1 4-2 8-4 13z" fill={hair} />}
      {style === 3 && <path d="M30 40c2-12 10-17 20-17s18 5 20 17c-6-5-12-7-20-7s-14 2-20 7z" fill={hair} />}
      {style === 4 && <path d="M29 44c-1-18 8-28 22-28 12 0 20 8 20 22-6-2-13-6-17-13-5 8-14 14-25 19z" fill={hair} />}
      {/* features */}
      {glasses ? (
        <g fill="none" stroke="#2a1d16" strokeWidth="1.8"><circle cx="41" cy="45" r="6.2" /><circle cx="59" cy="45" r="6.2" /><path d="M47.2 45h5.6" /></g>
      ) : null}
      <path d="M37.5 45q3.5 3.6 7 0M55.5 45q3.5 3.6 7 0" stroke={eye} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M44 56q6 5 12 0" stroke="#7a3b2a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="37" cy="53" rx="3.5" ry="2.2" fill="#e2684a" opacity="0.18" /><ellipse cx="63" cy="53" rx="3.5" ry="2.2" fill="#e2684a" opacity="0.18" />
    </svg>
  )
}

/** The person's photo when there is one that loads, otherwise the illustrated avatar. */
export function Portrait({ src, name, seed, size = 40, className = "" }: { src?: string | null; name?: string | null; seed?: string; size?: number; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className={`rounded-full object-cover shrink-0 ${className}`} />
  }
  return <PersonAvatar name={name} seed={seed} size={size} className={className} />
}
