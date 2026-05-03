import { AccessToken } from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
const apiSecret = process.env.LIVEKIT_API_SECRET || "secret";

export async function createLiveKitToken(roomName: string, participantName: string, isTeacher: boolean = false) {
  // If this room doesn't exist, it will be automatically created when the first participant joins
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    name: participantName,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    roomAdmin: isTeacher,
  });

  return await at.toJwt();
}
