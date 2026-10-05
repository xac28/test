import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
const apiSecret = process.env.LIVEKIT_API_SECRET || "secret";

export interface TokenOptions {
  /** Unique, stable participant id. Defaults to the display name (legacy) — pass the user id to avoid collisions. */
  identity?: string;
  /** Viewers of a broadcast subscribe only. Defaults to true. */
  canPublish?: boolean;
  /** Chat and controls travel as data messages. Defaults to true. */
  canPublishData?: boolean;
  /** Free-form JSON string; the clients read `{ "role": "host" | "viewer" }` from it. */
  metadata?: string;
  /** Token lifetime, default 6 hours. */
  ttl?: string | number;
}

export async function createLiveKitToken(
  roomName: string,
  participantName: string,
  isTeacher: boolean = false,
  opts: TokenOptions = {}
) {
  // If this room doesn't exist, it will be automatically created when the first participant joins
  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity ?? participantName,
    name: participantName,
    metadata: opts.metadata,
    ttl: opts.ttl ?? "6h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: opts.canPublish ?? true,
    canSubscribe: true,
    canPublishData: opts.canPublishData ?? true,
    canUpdateOwnMetadata: isTeacher,
    roomAdmin: isTeacher,
  });

  return await at.toJwt();
}

/**
 * The browser connects over ws(s):// (LIVEKIT_URL, the public address); the server SDK talks to the same host over http(s)://
 * unless LIVEKIT_SERVER_URL names an internal address (docker network, same machine).
 */
export function livekitHttpUrl(): string {
  if (process.env.LIVEKIT_SERVER_URL) return process.env.LIVEKIT_SERVER_URL;
  return (process.env.LIVEKIT_URL || "ws://localhost:7880").replace(/^ws/, "http");
}

export function livekitRoomService(): RoomServiceClient {
  return new RoomServiceClient(livekitHttpUrl(), apiKey, apiSecret);
}
