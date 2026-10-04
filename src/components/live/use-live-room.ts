"use client"

import { findContact, scanText } from "@/lib/profanity"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ConnectionState,
  DisconnectReason,
  LocalTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  RoomOptions,
  Track,
  VideoQuality,
} from "livekit-client"
import {
  ChatMessage,
  DEFAULT_ROOM_SETTINGS,
  RoomSettings,
  appendMessage,
  canSendNow,
  decodeChat,
  encodeChat,
  parseRoomSettings,
  sanitizeChatText,
} from "@/lib/live-chat"

export type LiveState = "idle" | "connecting" | "live" | "reconnecting" | "ended" | "error"

export interface ViewerInfo {
  identity: string
  name: string
  isHost: boolean
}

export interface HostTracks {
  camera: RemoteTrackPublication | null
  screen: RemoteTrackPublication | null
  audio: RemoteTrackPublication | null
}

/**
 * One hook for both sides of a broadcast: connection lifecycle, the host's tracks (viewer side),
 * participant list, chat and room settings (chat on/off, slow mode — stored in room metadata).
 */
export function useLiveRoom(opts: { hostIdentity?: string; isHost: boolean }) {
  const { isHost } = opts
  const hostIdentityRef = useRef(opts.hostIdentity)
  hostIdentityRef.current = opts.hostIdentity

  const [room, setRoom] = useState<Room | null>(null)
  const [state, setState] = useState<LiveState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [host, setHost] = useState<HostTracks>({ camera: null, screen: null, audio: null })
  const [viewers, setViewers] = useState<ViewerInfo[]>([])
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [audioBlocked, setAudioBlocked] = useState(false)
  const lastSent = useRef(0)
  const connectedAt = useRef<number | null>(null)
  const [, force] = useState(0)

  // One Room per hook instance, created on the client only
  useEffect(() => {
    const options: RoomOptions = {
      // adaptiveStream would override the viewer's manual quality choice whenever the player is resized
      adaptiveStream: false,
      dynacast: isHost,
    }
    const r = new Room(options)
    setRoom(r)
    return () => {
      r.disconnect().catch(() => {})
    }
  }, [isHost])

  const refreshHost = useCallback((r: Room) => {
    const hostId = hostIdentityRef.current
    const p: RemoteParticipant | undefined = hostId ? r.remoteParticipants.get(hostId) : undefined
    if (!p) {
      setHost({ camera: null, screen: null, audio: null })
      return
    }
    let camera: RemoteTrackPublication | null = null
    let screen: RemoteTrackPublication | null = null
    let audio: RemoteTrackPublication | null = null
    for (const pub of p.trackPublications.values()) {
      if (!pub.track) continue
      if (pub.source === Track.Source.Camera) camera = pub
      else if (pub.source === Track.Source.ScreenShare) screen = pub
      else if (pub.source === Track.Source.Microphone) audio = pub
    }
    setHost({ camera, screen, audio })
  }, [])

  const refreshViewers = useCallback((r: Room) => {
    const list: ViewerInfo[] = []
    r.remoteParticipants.forEach((p) => {
      let role = "viewer"
      try {
        role = JSON.parse(p.metadata || "{}").role || "viewer"
      } catch {}
      list.push({ identity: p.identity, name: p.name || p.identity, isHost: role === "host" })
    })
    setViewers(list)
  }, [])

  useEffect(() => {
    if (!room) return
    const onTracks = () => refreshHost(room)
    const onParticipants = () => {
      refreshViewers(room)
      refreshHost(room)
    }
    const onState = (s: ConnectionState) => {
      if (s === ConnectionState.Reconnecting) setState("reconnecting")
      else if (s === ConnectionState.Connected) setState("live")
    }
    const onDisconnected = (reason?: DisconnectReason) => {
      setHost({ camera: null, screen: null, audio: null })
      setViewers([])
      if (reason === DisconnectReason.CLIENT_INITIATED) setState("idle")
      else if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
        setError("Yayıncı tarafından yayından çıkarıldınız.")
        setState("error")
      } else setState("ended") // room deleted / server closed → the stream is over
    }
    const onData = (payload: Uint8Array, participant?: { identity: string; name?: string; metadata?: string }, _k?: unknown, topic?: string) => {
      if (topic !== "chat" || !participant) return
      let role = ""
      try {
        role = JSON.parse(participant.metadata || "{}").role
      } catch {}
      const msg = decodeChat(payload, {
        identity: participant.identity,
        name: participant.name,
        isHost: role === "host" || participant.identity === hostIdentityRef.current,
      })
      if (msg) setMessages((m) => appendMessage(m, msg))
    }
    const onMeta = (md: string) => setSettings(parseRoomSettings(md))
    const onAudio = () => setAudioBlocked(!room.canPlaybackAudio)

    room
      .on(RoomEvent.TrackSubscribed, onTracks)
      .on(RoomEvent.TrackUnsubscribed, onTracks)
      .on(RoomEvent.TrackMuted, onTracks)
      .on(RoomEvent.TrackUnmuted, onTracks)
      .on(RoomEvent.ParticipantConnected, onParticipants)
      .on(RoomEvent.ParticipantDisconnected, onParticipants)
      .on(RoomEvent.ParticipantMetadataChanged, onParticipants)
      .on(RoomEvent.ConnectionStateChanged, onState)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.DataReceived, onData as any)
      .on(RoomEvent.RoomMetadataChanged, onMeta)
      .on(RoomEvent.AudioPlaybackStatusChanged, onAudio)
    return () => {
      room
        .off(RoomEvent.TrackSubscribed, onTracks)
        .off(RoomEvent.TrackUnsubscribed, onTracks)
        .off(RoomEvent.TrackMuted, onTracks)
        .off(RoomEvent.TrackUnmuted, onTracks)
        .off(RoomEvent.ParticipantConnected, onParticipants)
        .off(RoomEvent.ParticipantDisconnected, onParticipants)
        .off(RoomEvent.ParticipantMetadataChanged, onParticipants)
        .off(RoomEvent.ConnectionStateChanged, onState)
        .off(RoomEvent.Disconnected, onDisconnected)
        .off(RoomEvent.DataReceived, onData as any)
        .off(RoomEvent.RoomMetadataChanged, onMeta)
        .off(RoomEvent.AudioPlaybackStatusChanged, onAudio)
    }
  }, [room, refreshHost, refreshViewers])

  const connect = useCallback(
    async (url: string, token: string) => {
      if (!room) throw new Error("Oda hazır değil")
      setState("connecting")
      setError(null)
      try {
        await room.connect(url, token, { autoSubscribe: true })
        connectedAt.current = Date.now()
        setSettings(parseRoomSettings(room.metadata))
        refreshViewers(room)
        refreshHost(room)
        setAudioBlocked(!room.canPlaybackAudio)
        setState("live")
        force((n) => n + 1)
      } catch (e: any) {
        setError(e?.message || "Yayına bağlanılamadı")
        setState("error")
        throw e
      }
    },
    [room, refreshHost, refreshViewers]
  )

  const disconnect = useCallback(async () => {
    await room?.disconnect()
  }, [room])

  /** Returns an error string for the UI, or null when the message was sent. */
  const sendChat = useCallback(
    async (raw: string): Promise<string | null> => {
      if (!room || room.state !== ConnectionState.Connected) return "Bağlantı yok"
      const text = sanitizeChatText(raw)
      if (!text) return null
      // the same filter the community uses: insults and contact details never reach the room
      if (!isHost && (!scanText(text).clean || findContact(text))) return "Mesajın topluluk kurallarına aykırı bir ifade ya da iletişim bilgisi içeriyor."
      if (!settings.chatEnabled && !isHost) return "Sohbet yayıncı tarafından kapatıldı"
      const gate = canSendNow(lastSent.current, Date.now(), settings.slowModeSec, isHost)
      if (!gate.ok) return `Yavaş mod: ${gate.waitSec} sn bekleyin`

      const id = `${room.localParticipant.identity}-${Date.now().toString(36)}`
      const ts = Date.now()
      lastSent.current = ts
      await room.localParticipant.publishData(encodeChat({ id, text, ts }), { reliable: true, topic: "chat" })
      // data messages are not echoed back to the sender
      setMessages((m) =>
        appendMessage(m, {
          id,
          identity: room.localParticipant.identity,
          name: room.localParticipant.name || "Ben",
          text,
          ts,
          isHost,
        })
      )
      return null
    },
    [room, settings, isHost]
  )

  return {
    room,
    state,
    error,
    host,
    viewers,
    viewerCount: viewers.length,
    settings,
    messages,
    audioBlocked,
    connectedAt: connectedAt.current,
    connect,
    disconnect,
    sendChat,
    clearMessages: () => setMessages([]),
  }
}

export type { LocalTrack, RemoteTrack }
export { VideoQuality }
