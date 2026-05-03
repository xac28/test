// Badge definitions for the Namaste gamification system
export interface Badge {
  id: string
  name: string
  nametr: string
  icon: string
  description: string
  descriptiontr: string
  requirement: number // Points or count needed
  type: "sessions" | "streak" | "reviews" | "special"
}

export const BADGES: Badge[] = [
  // Session milestones
  {
    id: "first_session",
    name: "First Step",
    nametr: "İlk Adım",
    icon: "🌱",
    description: "Complete your first yoga session",
    descriptiontr: "İlk yoga dersini tamamla",
    requirement: 1,
    type: "sessions",
  },
  {
    id: "dedicated_5",
    name: "Dedicated Yogi",
    nametr: "Adanmış Yogi",
    icon: "🧘",
    description: "Complete 5 sessions",
    descriptiontr: "5 ders tamamla",
    requirement: 5,
    type: "sessions",
  },
  {
    id: "committed_25",
    name: "Committed Practitioner",
    nametr: "Kararlı Pratisyen",
    icon: "💪",
    description: "Complete 25 sessions",
    descriptiontr: "25 ders tamamla",
    requirement: 25,
    type: "sessions",
  },
  {
    id: "master_100",
    name: "Zen Master",
    nametr: "Zen Ustası",
    icon: "🏆",
    description: "Complete 100 sessions",
    descriptiontr: "100 ders tamamla",
    requirement: 100,
    type: "sessions",
  },
  // Streak milestones
  {
    id: "streak_3",
    name: "On Fire",
    nametr: "Ateşte",
    icon: "🔥",
    description: "3-day practice streak",
    descriptiontr: "3 gün arka arkaya pratik",
    requirement: 3,
    type: "streak",
  },
  {
    id: "streak_7",
    name: "Weekly Warrior",
    nametr: "Haftalık Savaşçı",
    icon: "⚡",
    description: "7-day practice streak",
    descriptiontr: "7 gün arka arkaya pratik",
    requirement: 7,
    type: "streak",
  },
  {
    id: "streak_30",
    name: "Monthly Legend",
    nametr: "Aylık Efsane",
    icon: "👑",
    description: "30-day practice streak",
    descriptiontr: "30 gün arka arkaya pratik",
    requirement: 30,
    type: "streak",
  },
  // Review milestones
  {
    id: "reviewer_1",
    name: "Voice Heard",
    nametr: "Sesini Duyur",
    icon: "💬",
    description: "Leave your first review",
    descriptiontr: "İlk değerlendirmeni yap",
    requirement: 1,
    type: "reviews",
  },
  {
    id: "reviewer_10",
    name: "Community Guide",
    nametr: "Topluluk Rehberi",
    icon: "🌟",
    description: "Leave 10 reviews",
    descriptiontr: "10 değerlendirme yap",
    requirement: 10,
    type: "reviews",
  },
  // Special
  {
    id: "early_bird",
    name: "Early Bird",
    nametr: "Erken Kalkan Yogi",
    icon: "🌅",
    description: "Join a session before 8:00 AM",
    descriptiontr: "Sabah 8'den önce derse katıl",
    requirement: 1,
    type: "special",
  },
  {
    id: "night_owl",
    name: "Night Owl",
    nametr: "Gece Kuşu",
    icon: "🌙",
    description: "Join a session after 10:00 PM",
    descriptiontr: "Gece 10'dan sonra derse katıl",
    requirement: 1,
    type: "special",
  },
]

export function checkNewBadges(
  currentBadges: string[],
  stats: {
    totalSessions: number
    currentStreak: number
    totalReviews: number
    sessionHour?: number
  }
): string[] {
  const newBadges: string[] = []

  for (const badge of BADGES) {
    if (currentBadges.includes(badge.id)) continue

    let earned = false
    switch (badge.type) {
      case "sessions":
        earned = stats.totalSessions >= badge.requirement
        break
      case "streak":
        earned = stats.currentStreak >= badge.requirement
        break
      case "reviews":
        earned = stats.totalReviews >= badge.requirement
        break
      case "special":
        if (badge.id === "early_bird" && stats.sessionHour !== undefined) {
          earned = stats.sessionHour < 8
        }
        if (badge.id === "night_owl" && stats.sessionHour !== undefined) {
          earned = stats.sessionHour >= 22
        }
        break
    }

    if (earned) newBadges.push(badge.id)
  }

  return newBadges
}
