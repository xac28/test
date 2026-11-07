import { Award, Crown, Dumbbell, Flame, Flower2, MessageCircle, Moon, Sprout, Star, Sunrise, Trophy, Zap } from "lucide-react"

const GLYPHS: Record<string, typeof Award> = {
  first_session: Sprout,
  dedicated_5: Flower2,
  committed_25: Dumbbell,
  master_100: Trophy,
  streak_3: Flame,
  streak_7: Zap,
  streak_30: Crown,
  reviewer_1: MessageCircle,
  reviewer_10: Star,
  early_bird: Sunrise,
  night_owl: Moon,
}

/** Line icon for a badge (the data file still carries emoji for the mobile app). */
export function BadgeGlyph({ id, size = 18, className = "" }: { id: string; size?: number; className?: string }) {
  const Icon = GLYPHS[id] ?? Award
  return <Icon size={size} className={className} aria-hidden />
}
