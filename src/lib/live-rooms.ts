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
    })
  }
  return result
}
