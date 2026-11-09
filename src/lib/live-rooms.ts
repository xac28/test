import { db } from "@/lib/db"
import { livekitRoomService } from "@/lib/livekit"
import { serializeRoomSettings, DEFAULT_ROOM_SETTINGS } from "@/lib/live-chat"

/** A room nobody published into for this long is considered a ghost (teacher closed the tab). */
export const GHOST_AFTER_MS = 3 * 60 * 1000

/** Create the LiveKit room up-front so the chat settings live in its metadata. Best-effort. */
export async function createLiveKitRoom(roomName: string, title: string, metadata?: string): Promise<void> {
  try {
    await livekitRoomService().createRoom({
      name: roomName,
      emptyTimeout: 120,
      maxParticipants: 500,
      metadata: metadata ?? serializeRoomSettings({ ...DEFAULT_ROOM_SETTINGS, title }),
    })
  } catch (e) {
    console.warn("[LIVE] createRoom failed (the room will be auto-created on first join):", (e as Error).message)
  }
}

/** Mark ended in the DB and disconnect everybody still in the LiveKit room. */
export async function endLiveRoom(liveRoomId: string): Promise<void> {
  const room = await db.liveRoom.update({
    where: { id: liveRoomId },
    data: { isActive: false, endedAt: new Date() },
  })
  try {
    await livekitRoomService().deleteRoom(room.roomName)
  } catch {
    /* already gone */
  }
}

export interface LiveSummary {
  id: string
  roomName: string
  title: string
  startedAt: string
  viewerCount: number
  teacher: { id: string; name: string | null; image: string | null; trial: boolean }
  /** opened by a trial-phase teacher: watched by officials */
  supervised: boolean
  workshop: { slug: string; title: string } | null
  /** restricted to this teacher's own students (see isStudentOfTeacher) — ignored when workshop is set */
  studentsOnly: boolean
  /** the Teacher row's own id (teacher.id above is the *user* id) — what isStudentOfTeacher expects */
  teacherId: string
}

/**
 * True when the user has an actual paid relationship with this teacher: a booking that wasn't just
 * requested (confirmed or already completed), or a confirmed seat in one of their workshops. This is
 * what a "students only" broadcast checks — a signed-in account alone isn't enough, and it isn't
 * specific to the teacher who's live (a student of teacher A has no standing to watch teacher B's).
 */
export async function isStudentOfTeacher(userId: string, teacherId: string): Promise<boolean> {
  const [booking, enrollment] = await Promise.all([
    db.booking.findFirst({ where: { studentId: userId, teacherId, status: { in: ["CONFIRMED", "COMPLETED"] } }, select: { id: true } }),
    db.workshopEnrollment.findFirst({ where: { userId, status: "CONFIRMED", workshop: { teacherId } }, select: { id: true } }),
  ])
  return !!booking || !!enrollment
}

/**
 * Drops students-only broadcasts the viewer has no standing to see from a list — not that teacher,
 * not their student. Shared by the /live directory and the AI guide's "what's live now" tool, so
 * someone outside a teacher's own students never even hears a title/viewer count for their stream.
 */
export async function filterVisibleBroadcasts<T extends { teacher: { id: string }; teacherId: string; studentsOnly: boolean }>(
  all: T[],
  viewer: { id: string; role: string } | null
): Promise<T[]> {
  if (!viewer) return all.filter((b) => !b.studentsOnly)
  if (viewer.role === "ADMIN") return all
  const checks = await Promise.all(
    all.map((b) => (!b.studentsOnly || b.teacher.id === viewer.id ? true : isStudentOfTeacher(viewer.id, b.teacherId)))
  )
  return all.filter((_, i) => checks[i])
}

/**
 * Active broadcasts with live viewer counts. Rooms that LiveKit no longer knows about
 * (and are older than GHOST_AFTER_MS) are closed lazily so the directory never lists ghosts.
 */
export async function listActiveBroadcasts(): Promise<LiveSummary[]> {
  const rooms = await db.liveRoom.findMany({
    where: { isActive: true },
    include: {
      teacher: { include: { user: { select: { id: true, name: true, image: true } } } },
      workshop: { select: { slug: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  if (rooms.length === 0) return []

  let lkRooms: Map<string, number> | null = null
  try {
    const list = await livekitRoomService().listRooms(rooms.map((r) => r.roomName))
    lkRooms = new Map(list.map((r) => [r.name, r.numParticipants]))
  } catch {
    lkRooms = null // LiveKit unreachable: show DB state rather than hiding everything
  }

  const result: LiveSummary[] = []
  for (const r of rooms) {
    let viewerCount = 0
    if (lkRooms) {
      const n = lkRooms.get(r.roomName)
      if (n === undefined) {
        if (Date.now() - r.createdAt.getTime() > GHOST_AFTER_MS) {
          await db.liveRoom.update({ where: { id: r.id }, data: { isActive: false, endedAt: new Date() } }).catch(() => {})
          continue
        }
      } else {
        viewerCount = Math.max(0, n - 1) // the host is a participant too
      }
    }
    result.push({
      id: r.id,
      roomName: r.roomName,
      title: r.title,
      startedAt: r.createdAt.toISOString(),
      viewerCount,
      teacher: { id: r.teacher.user.id, name: r.teacher.user.name, image: r.teacher.user.image, trial: r.teacher.isTrialMode },
      supervised: r.supervised,
      workshop: r.workshop,
      studentsOnly: r.studentsOnly,
      teacherId: r.teacherId,
    })
  }
  return result
}
