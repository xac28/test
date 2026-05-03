import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

// GET  /api/room/chat?bookingId=xxx  — Fetch all messages
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const bookingId = searchParams.get("bookingId")

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId required" }, { status: 400 })
    }

    // Verify user belongs to booking
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { teacher: true },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const isStudent = booking.studentId === user.id
    const isTeacher = booking.teacher.userId === user.id

    if (!isStudent && !isTeacher) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const messages = await db.chatMessage.findMany({
      where: { bookingId },
      orderBy: { createdAt: "asc" },
      take: 200,
    })

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error("[CHAT_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// POST /api/room/chat — Send a message
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { bookingId, message } = await req.json()

    if (!bookingId || !message) {
      return NextResponse.json({ error: "bookingId and message required" }, { status: 400 })
    }

    // Verify user belongs to booking
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { teacher: true },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const isStudent = booking.studentId === user.id
    const isTeacher = booking.teacher.userId === user.id

    if (!isStudent && !isTeacher) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const chatMessage = await db.chatMessage.create({
      data: {
        bookingId,
        senderId: user.id,
        senderName: user.name || "User",
        message: message.trim(),
      },
    })

    return NextResponse.json({ message: chatMessage })
  } catch (error: any) {
    console.error("[CHAT_POST_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
