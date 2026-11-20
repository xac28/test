import { db } from "@/lib/db"
import { suspensionGate } from "@/lib/policy"
import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_API, RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { moderateText } from "@/lib/moderation"
import { notify } from "@/lib/notifications"

// GET conversations or messages
export async function GET(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_API)
  if (blocked) return blocked

  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get("conversationId")

    // If a conversation ID is provided, fetch its messages
    if (conversationId) {
      // only the two people in a conversation may read it
      const conv = await db.conversation.findUnique({ where: { id: conversationId }, select: { userOneId: true, userTwoId: true } })
      if (!conv || (conv.userOneId !== user.id && conv.userTwoId !== user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const messages = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" }
      })
      
      // Mark as read
      await db.message.updateMany({
        where: { 
          conversationId, 
          senderId: { not: user.id },
          read: false
        },
        data: { read: true }
      })

      return NextResponse.json(messages)
    }

    // Otherwise, fetch all conversations for the user
    const conversations = await db.conversation.findMany({
      where: {
        OR: [
          { userOneId: user.id },
          { userTwoId: user.id }
        ]
      },
      include: {
        userOne: { select: { id: true, name: true, image: true, role: true } },
        userTwo: { select: { id: true, name: true, image: true, role: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" }
    })

    return NextResponse.json(conversations)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

// POST send a message
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked

  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock
    const susp = await suspensionGate(user.id)
    if (susp) return susp

    const { targetUserId, teacherId, content } = await req.json()
    if ((!targetUserId && !teacherId) || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    const checked = await moderateText(user, content, "MESSAGE", { max: 2000 })
    if (!checked.ok) return NextResponse.json({ error: checked.error, code: checked.code, policy: checked.policy ? { strike: checked.policy.strike, action: checked.policy.action } : undefined }, { status: checked.status })

    let finalTargetUserId = targetUserId;
    if (teacherId) {
      const teacher = await db.teacher.findUnique({ where: { id: teacherId } })
      if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 })
      finalTargetUserId = teacher.userId;
    }

    // Find or create conversation
    let conversation = await db.conversation.findFirst({
      where: {
        OR: [
          { userOneId: user.id, userTwoId: finalTargetUserId },
          { userOneId: finalTargetUserId, userTwoId: user.id }
        ]
      }
    })

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          userOneId: user.id,
          userTwoId: finalTargetUserId
        }
      })
    }

    // Create the message
    const message = await db.message.create({
      data: {
        content: checked.text,
        senderId: user.id,
        conversationId: conversation.id
      }
    })

    // Update conversation timestamp
    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    })

    await notify({
      userId: finalTargetUserId, type: "SYSTEM", actorId: user.id, groupKey: `msg:${conversation.id}`, href: "/messages",
      title: `${user.name ?? "Biri"} sana mesaj gönderdi`, groupTitle: (n) => `${user.name ?? "Biri"} sana ${n} mesaj gönderdi`, body: checked.text.slice(0, 120),
    })
    return NextResponse.json(message)
  } catch (error) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
