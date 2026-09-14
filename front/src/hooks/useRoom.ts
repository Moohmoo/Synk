import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import {
  ChatMessage,
  Participant,
  PlayerState,
  RoomSettings,
} from "@/types/room";
import {
  ErrorPayload,
  PlayerUpdatedPayload,
  RoomSyncPayload,
  ParticipantJoinedPayload,
  ParticipantLeftPayload,
  HeartbeatAckPayload,
  PingUpdatedPayload,
  SettingsUpdatedPayload,
  HostPromotedPayload,
} from "@/types/events";
import { formatErrorMessage } from "@/lib/errorMapper";
import { sessionManager } from "@/lib/session";
import { END_THRESHOLD_SECONDS } from "@/lib/constants";
import { useRateLimiter } from "./useRateLimiter";

const DEFAULT_WS_URL = "ws://localhost:8000";
const HEARTBEAT_INTERVAL_MS = 5000;
const CLOCK_SKEW_THRESHOLD_MS = 50;

const SYNC_ACTION_TOAST_KEYS: Record<string, string> = {
  PLAY: "toast.play",
  PAUSE: "toast.pause",
  SEEK: "toast.seek",
  CHANGE_MEDIA: "toast.loadMedia",
};

export interface UseRoomOptions {
  roomId: string;
  username: string;
  token?: string | null;
  userId?: string | null;
  wsBaseUrl?: string;
}

export interface RoomController {
  isConnected: boolean;
  participants: Participant[];
  player: PlayerState;
  roomSettings: RoomSettings;
  messages: ChatMessage[];
  myPing: number;
  serverTimeOffset: number;
  error: string | null;
  currentUsername: string;
  currentUserId: string | null;
  isHost: boolean;
  isRateLimited: (action: string) => boolean;
  getRemainingCooldown: (action: string) => number;
  sendPlay: (currentTime?: number, duration?: number, isRestart?: boolean) => void;
  sendPause: (currentTime?: number, duration?: number) => void;
  sendSeek: (targetTime: number, duration?: number) => void;
  changeMedia: (url: string) => void;
  sendChat: (content: string) => void;
  updateSettings: (isLocked: boolean) => void;
  sendHeartbeat: (currentTime?: number) => void;
}

function sanitizePlaybackTimes(
  currentTime?: number,
  duration?: number
): { roundedPos: number; validDur?: number } {
  const pos = typeof currentTime === "number" && !isNaN(currentTime) ? currentTime : 0;
  const roundedPos = Math.round(pos * 100) / 100;
  const validDur = duration && duration > 0 ? Math.round(duration * 100) / 100 : undefined;
  return { roundedPos, validDur };
}

function isSelfUser(
  targetUsername: string,
  currentUsername: string,
  initialUsername: string
): boolean {
  return targetUsername === currentUsername || targetUsername === initialUsername;
}

function findSelfParticipant(
  participants: Participant[],
  userId: string | null | undefined,
  username: string
): Participant | undefined {
  return participants.find((p) => (userId && p.id === userId) || p.username === username);
}

/**
 * Hook central orchestrant la connexion WebSocket et la synchronisation multijoueur du salon.
 */
export function useRoom({
  roomId,
  username,
  token,
  userId,
  wsBaseUrl = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL,
}: UseRoomOptions): RoomController {
  const { t } = useTranslation(["room", "global", "errors"]);
  const { isRateLimited, getRemainingCooldown, lockAction } = useRateLimiter();

  const [isConnected, setIsConnected] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentUserId, setCurrentUserId] = useState<string | null>(userId || null);
  const [participants, setParticipants] = useState<Participant[]>(() => {
    if (!username) return [];
    return [
      {
        id: userId || "self",
        username,
        is_host: Boolean(token),
        ping_ms: 0,
        joined_at: Date.now(),
      },
    ];
  });
  const [player, setPlayer] = useState<PlayerState>({
    media_url: null,
    media_id: null,
    provider: null,
    media_type: null,
    is_playing: false,
    current_time: 0,
    duration: 0,
    last_updated_at: Date.now(),
  });
  const [roomSettings, setRoomSettings] = useState<RoomSettings>({
    is_locked: false,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myPing, setMyPing] = useState(0);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const currentUsernameRef = useRef(username);
  const currentUserIdRef = useRef<string | null>(userId || null);
  const myPingRef = useRef(0);
  const tRef = useRef(t);
  const authoritativePlayerRef = useRef<PlayerState>(player);

  tRef.current = t;
  currentUsernameRef.current = currentUsername;
  currentUserIdRef.current = currentUserId;
  myPingRef.current = myPing;

  const emitHeartbeat = useCallback((socket: Socket | null, currentTime?: number) => {
    if (socket?.connected) {
      socket.emit("HEARTBEAT", {
        client_sent_at: Date.now(),
        ping_ms: myPingRef.current,
        current_time: currentTime,
      });
    }
  }, []);

  // Actions utilisateur vers le serveur Socket.IO (avec Optimistic UI)
  const sendPlay = useCallback(
    (currentTime?: number, duration?: number, isRestart: boolean = false) => {
      if (isRateLimited("PLAY")) return;
      const { roundedPos, validDur } = sanitizePlaybackTimes(currentTime, duration);

      socketRef.current?.emit("PLAY", {
        current_time: roundedPos,
        duration: validDur,
        is_restart: isRestart,
      });

      setPlayer((prev) => ({
        ...prev,
        is_playing: true,
        current_time: roundedPos,
        duration: validDur || prev.duration,
        last_updated_at: Date.now(),
      }));
    },
    [isRateLimited]
  );

  const sendPause = useCallback(
    (currentTime?: number, duration?: number) => {
      if (isRateLimited("PAUSE")) return;
      const { roundedPos, validDur } = sanitizePlaybackTimes(currentTime, duration);

      socketRef.current?.emit("PAUSE", {
        current_time: roundedPos,
        duration: validDur,
      });

      setPlayer((prev) => ({
        ...prev,
        is_playing: false,
        current_time: roundedPos,
        duration: validDur || prev.duration,
        last_updated_at: Date.now(),
      }));
    },
    [isRateLimited]
  );

  const sendSeek = useCallback(
    (targetTime: number, duration?: number) => {
      if (isRateLimited("SEEK")) return;
      const { roundedPos: safeTarget, validDur } = sanitizePlaybackTimes(targetTime, duration);

      socketRef.current?.emit("SEEK", {
        target_time: safeTarget,
        duration: validDur,
      });

      setPlayer((prev) => ({
        ...prev,
        current_time: safeTarget,
        duration: validDur || prev.duration,
        last_updated_at: Date.now(),
      }));
    },
    [isRateLimited]
  );

  const changeMedia = useCallback(
    (url: string) => {
      if (isRateLimited("CHANGE_MEDIA")) return;
      const trimmed = url.trim();
      if (!trimmed) return;

      socketRef.current?.emit("CHANGE_MEDIA", { url: trimmed });
      setPlayer((prev) => ({
        ...prev,
        is_playing: false,
        current_time: 0,
        duration: 0,
        last_updated_at: Date.now(),
      }));
    },
    [isRateLimited]
  );

  const sendChat = useCallback(
    (content: string) => {
      if (isRateLimited("CHAT_MESSAGE")) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      socketRef.current?.emit("CHAT_MESSAGE", { content: trimmed });
    },
    [isRateLimited]
  );

  const updateSettings = useCallback(
    (isLocked: boolean) => {
      if (isRateLimited("UPDATE_SETTINGS")) return;
      if (roomSettings.is_locked === isLocked) return;

      socketRef.current?.emit("UPDATE_SETTINGS", { is_locked: isLocked });
    },
    [isRateLimited, roomSettings.is_locked]
  );

  const sendHeartbeat = useCallback(
    (currentTime?: number) => {
      emitHeartbeat(socketRef.current, currentTime);
    },
    [emitHeartbeat]
  );

  // Initialisation et gestion du cycle de vie Socket.IO
  useEffect(() => {
    if (!roomId || !username) return;

    // Normaliser l'URL WebSocket en HTTP/HTTPS pour le handshake Socket.IO
    const serverUrl = wsBaseUrl.replace(/^ws(s?):/, "http$1:");

    const socket = io(serverUrl, {
      path: "/socket.io",
      auth: {
        room_id: roomId,
        username,
        token: token || undefined,
        user_id: userId || undefined,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setError(null);
      emitHeartbeat(socket);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[useRoom] Erreur de connexion Socket.IO :", err.message);
      setIsConnected(false);
      setError(err.message);
      toast.error(err.message, { id: "socket-connect-error" });
    });

    socket.on("ROOM_SYNC", (payload: RoomSyncPayload) => {
      const roomData = payload.room;
      setParticipants(roomData.participants);
      setPlayer(roomData.player);
      authoritativePlayerRef.current = roomData.player;
      setRoomSettings(roomData.settings);

      if (payload.your_username) {
        setCurrentUsername(payload.your_username);
        currentUsernameRef.current = payload.your_username;
      }
      if (payload.your_id) {
        setCurrentUserId(payload.your_id);
        currentUserIdRef.current = payload.your_id;
        sessionManager.setRoomSession(roomId, {
          username: payload.your_username || username,
          token,
          userId: payload.your_id,
        });
      }

      // Si le serveur indique qu'on n'est plus hôte, purger le token local
      const myId = payload.your_id || currentUserIdRef.current || userId;
      const myName = payload.your_username || currentUsernameRef.current || username;
      const me = findSelfParticipant(roomData.participants || [], myId, myName);
      if (me && !me.is_host) {
        sessionManager.clearHostToken(roomId);
      }
    });

    socket.on("PLAYER_UPDATED", (payload: PlayerUpdatedPayload) => {
      setPlayer(payload.player);
      authoritativePlayerRef.current = payload.player;

      const isSelf = isSelfUser(payload.triggered_by, currentUsernameRef.current, username);
      if (payload.triggered_by && !isSelf) {
        // Ignore la notification si la pause correspond à la fin naturelle de la vidéo
        const duration = payload.player.duration ?? 0;
        const isNaturalEnd =
          payload.action === "PAUSE" &&
          duration > 0 &&
          payload.player.current_time >= duration - END_THRESHOLD_SECONDS;

        if (!isNaturalEnd) {
          const translationKey = SYNC_ACTION_TOAST_KEYS[payload.action];
          if (translationKey) {
            toast.info(tRef.current(translationKey, { user: payload.triggered_by }), {
              id: "player-sync-action",
            });
          }
        }
      }
    });

    socket.on("SETTINGS_UPDATED", (payload: SettingsUpdatedPayload) => {
      setRoomSettings(payload.settings);
      const lockKey = payload.settings.is_locked ? "toast.roomLocked" : "toast.roomUnlocked";
      toast.info(tRef.current(lockKey), { id: "room-lock-status" });
    });

    socket.on("PARTICIPANT_JOINED", (payload: ParticipantJoinedPayload) => {
      const newParticipant = payload.user;
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.id !== newParticipant.id);
        return [...filtered, newParticipant];
      });

      if (!isSelfUser(newParticipant.username, currentUsernameRef.current, username)) {
        toast.info(tRef.current("toast.userJoined", { user: newParticipant.username }));
      }
    });

    socket.on("PARTICIPANT_LEFT", (payload: ParticipantLeftPayload) => {
      const { user_id, new_host_id } = payload;
      setParticipants((prev) => {
        const leaving = prev.find((p) => p.id === user_id);
        if (leaving && !isSelfUser(leaving.username, currentUsernameRef.current, username)) {
          toast.info(tRef.current("toast.userLeft", { user: leaving.username }));
        }
        return prev
          .filter((p) => p.id !== user_id)
          .map((p) => (p.id === new_host_id ? { ...p, is_host: true } : p));
      });
    });

    socket.on("HOST_PROMOTED", (payload: HostPromotedPayload) => {
      if (payload.host_token) {
        sessionManager.setHostToken(roomId, payload.host_token);
        toast.info(tRef.current("toast.hostTransferredToYou"), {
          id: "host-transferred",
        });
      }
    });

    socket.on("CHAT_BROADCAST", (payload: ChatMessage) => {
      setMessages((prev) => [...prev, payload]);
    });

    socket.on("HEARTBEAT_ACK", (payload: HeartbeatAckPayload) => {
      const now = Date.now();
      if (payload.client_sent_at) {
        const rtt = Math.max(0, now - payload.client_sent_at);
        const oneWayDelay = rtt / 2;
        setMyPing(Math.round(oneWayDelay));

        // Formule SNTP (RFC 4330) : calcul de la dérive d'horloge entre client et serveur
        // pour immuniser l'extrapolation temporelle contre tout décalage d'heure locale (Clock Skew).
        if (payload.server_received_at) {
          const estimatedServerNow = payload.server_received_at + oneWayDelay;
          const newOffset = Math.round(estimatedServerNow - now);
          setServerTimeOffset((prev) => (Math.abs(prev - newOffset) > CLOCK_SKEW_THRESHOLD_MS ? newOffset : prev));
        }
      } else {
        setMyPing(payload.ping_ms || 0);
      }
    });

    socket.on("PING_UPDATED", (payload: PingUpdatedPayload) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === payload.user_id ? { ...p, ping_ms: payload.ping_ms } : p))
      );
    });

    socket.on("ERROR", (payload: ErrorPayload) => {
      const localizedMsg = formatErrorMessage(payload, tRef.current);
      setError(localizedMsg);
      toast.error(localizedMsg, { id: `ws-err-${payload.code || "generic"}` });

      if (payload.code === "RATE_LIMITED") {
        const action = payload.action;
        const retryAfter = payload.retry_after || 2;
        if (action) {
          lockAction(action, retryAfter);
        } else {
          lockAction("SEEK", retryAfter);
          lockAction("PLAY", retryAfter);
          lockAction("PAUSE", retryAfter);
        }

        // Rollback sur l'état faisant autorité côté serveur lors d'un refus
        if (!action || action === "SEEK" || action === "PLAY" || action === "PAUSE") {
          setPlayer({
            ...authoritativePlayerRef.current,
            last_updated_at: Date.now(),
          });
        }
      }
    });

    const heartbeatTimer = setInterval(() => {
      emitHeartbeat(socket);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, username, token, userId, wsBaseUrl, emitHeartbeat, lockAction]);

  const effectiveUserId = currentUserId || userId;
  const isHost = useMemo(() => {
    return Boolean(findSelfParticipant(participants, effectiveUserId, currentUsername)?.is_host);
  }, [participants, effectiveUserId, currentUsername]);

  return {
    isConnected,
    participants,
    player,
    roomSettings,
    messages,
    myPing,
    serverTimeOffset,
    error,
    currentUsername,
    currentUserId,
    isHost,
    isRateLimited,
    getRemainingCooldown,
    sendPlay,
    sendPause,
    sendSeek,
    changeMedia,
    sendChat,
    updateSettings,
    sendHeartbeat,
  };
}

export default useRoom;
