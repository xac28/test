import { auth } from "@/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const room = await db.liveRoom.update({
      where: { id },
      data: { isActive: false, endedAt: new Date() }
    })

    return NextResponse.json({ success: true, room })
  } catch (error: any) {
    console.error("[ROOM_CLOSE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
