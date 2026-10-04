import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AI } from "@/lib/rate-limit"

// Free AI: Uses Gemini API (free tier) or fallback to rule-based matching
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AI)
  if (blocked) return blocked

  try {
    const { message } = await req.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // 1. Fetch all teachers with their real ratings from DB
    const dbTeachers = await db.teacher.findMany({
      include: {
        user: { select: { name: true, image: true, country: true } },
        bookings: {
          where: { status: "COMPLETED" },
          include: { review: true },
        },
      },
    })

    // Build teacher context with real ratings
    const teacherProfiles = dbTeachers.map(t => {
      const reviews = t.bookings.filter(b => b.review).map(b => b.review!)
      const avgRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : "5.0"
      const specialties = t.specialties ? JSON.parse(t.specialties) : []
      
      return {
        name: t.user.name || "Teacher",
        country: t.user.country || "Unknown",
        bio: t.bio || "",
        specialties: specialties.join(", "),
        rating: avgRating,
        reviewCount: reviews.length,
        hourlyRate: t.hourlyRate,
        studentsCount: t.bookings.length,
        id: t.id,
      }
    })

    // Also include demo teachers for completeness
    const { TEACHERS } = await import("@/lib/teachers")
    const demoProfiles = TEACHERS.map(t => ({
      name: t.name,
      country: t.country,
      bio: t.bio.en,
      specialties: t.styles.join(", "),
      rating: t.rating.toString(),
      reviewCount: t.reviewCount,
      hourlyRate: t.pricePerClassUSD,
      studentsCount: t.studentsCount,
      id: t.slug,
    }))

    const allTeachers = [...teacherProfiles, ...demoProfiles]

    const teacherContext = allTeachers.map(t =>
      `• ${t.name} (${t.country}) — ⭐ ${t.rating}/5 (${t.reviewCount} reviews) — $${t.hourlyRate}/hr — Specialties: ${t.specialties} — ${t.studentsCount} students — Bio: ${t.bio}`
    ).join("\n")

    // 2. Try Gemini free API
    const geminiKey = process.env.GEMINI_API_KEY
    
    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are "AYA AI", a friendly yoga wellness assistant for the AYA platform. You recommend teachers based on user needs. Always respond in the user's language (Turkish or English). Be warm, knowledgeable, and concise. Use yoga-related emojis.

Here are the available teachers on the platform:
${teacherContext}

User question: ${message}

Rules:
- Recommend 1-3 teachers that best match the user's needs
- Always mention their star rating and specialties
- If the user mentions a health issue, suggest appropriate yoga styles
- Keep your response under 200 words
- Format teacher names in bold
- End with an encouraging yoga quote or affirmation`
                }]
              }],
              generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7,
              }
            })
          }
        )

        if (geminiRes.ok) {
          const data = await geminiRes.json()
          const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text
          
          if (aiText) {
            return NextResponse.json({
              reply: aiText,
              teachers: allTeachers.slice(0, 3),
            })
          }
        }
      } catch (e) {
        console.error("[GEMINI_ERROR]", e)
      }
    }

    // 3. Fallback: Rule-based smart matching
    const lowerMsg = message.toLowerCase()
    let matchedTeachers = allTeachers

    // Keyword matching
    const styleKeywords: Record<string, string[]> = {
      "hatha": ["hatha", "basic", "temel", "başlangıç", "beginner", "gentle"],
      "vinyasa": ["vinyasa", "flow", "dynamic", "dinamik", "akış", "cardio"],
      "yin": ["yin", "stretch", "esneme", "yavaş", "slow", "deep"],
      "meditation": ["meditation", "meditasyon", "mindfulness", "farkındalık", "stress", "stres", "anxiety", "calm", "huzur"],
      "ashtanga": ["ashtanga", "power", "güç", "strong", "intense", "zorlu"],
      "restorative": ["restorative", "onarıcı", "rest", "dinlenme", "burnout", "tükenmişlik", "bel", "back", "ağrı", "pain"],
    }

    for (const [style, keywords] of Object.entries(styleKeywords)) {
      if (keywords.some(k => lowerMsg.includes(k))) {
        matchedTeachers = allTeachers.filter(t =>
          t.specialties.toLowerCase().includes(style)
        )
        break
      }
    }

    // Sort by rating
    matchedTeachers.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
    const top3 = matchedTeachers.slice(0, 3)

    let reply = `🧘 Merhaba! İhtiyacınıza göre size en uygun öğretmenleri buldum:\n\n`
    top3.forEach((t, i) => {
      reply += `${i + 1}. **${t.name}** (${t.country}) — ⭐ ${t.rating}/5 — $${t.hourlyRate}/saat\n   📋 Uzmanlık: ${t.specialties}\n   👥 ${t.studentsCount} öğrenci\n\n`
    })
    reply += `\n💫 *"Yoga yolculuğunuzda doğru rehber, her şeyi değiştirir."* Hemen bir deneme dersi alın!`

    return NextResponse.json({ reply, teachers: top3 })
  } catch (error) {
    console.error("[AI_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
