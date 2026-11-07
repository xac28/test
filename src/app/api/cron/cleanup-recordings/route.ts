import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { purgeRecordingFiles } from "@/lib/recordings"

// POST /api/cron/cleanup-recordings — deletes recordings older than 30 days (and abandoned uploads)
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }
  if (req.headers.get("authorization")?.replace("Bearer ", "") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized — invalid cron secret" }, { status: 401 })
  }

  const now = new Date()
  const abandonedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const stale = await db.lessonRecording.findMany({
    where: {
      deletedAt: null,
      OR: [
        { expiresAt: { lte: now } },
        // never finalized (browser closed mid-lesson) and older than a day
        { status: "RECORDING", startedAt: { lte: abandonedBefore } },
      ],
    },
    select: { id: true, status: true },
  })

  let purged = 0
  for (const rec of stale) {
    await purgeRecordingFiles(rec.id).catch((e) => console.error("[CLEANUP] purge failed", rec.id, e))
    await db.lessonRecording.update({
      where: { id: rec.id },
      data: {
        status: rec.status === "RECORDING" ? "FAILED" : "EXPIRED",
        deletedAt: now,
        filePath: null,
      },
    })
    purged++
  }

  return NextResponse.json({ success: true, purged })
}
