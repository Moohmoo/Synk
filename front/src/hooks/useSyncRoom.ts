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
import { useRateLimiter } from "./useRateLimiter";

interface UseSyncRoomOptions {
  roomId: string;
  username: string;
  token?: string | null;
  userId?: string | null;
  wsBaseUrl?: string;
}

/**
 * Valide et arrondit les valeurs temporelles de lecture avant transmission au serveur.
 */
function sanitizePlaybackTimes(
  currentTime?: number,
  duration?: number
): { roundedPos: number; validDur?: number } {
  const pos = typeof currentTime === "number" && !isNaN(currentTime) ? currentTime : 0;
  const roundedPos = Math.round(pos * 100) / 100;
  const validDur = duration && duration > 0 ? Math.round(duration * 100) / 100 : undefined;
  return { roundedPos, validDur };
}

/**
 * Vérifie si le nom d'utilisateur correspond à la session locale.
 */
function isSelfUser(
  targetUsername: string,
  currentUsername: string,
  initialUsername: string
): boolean {
  return targetUsername === currentUsername || targetUsername === initialUsername;
}

/**
 * Hook central orchestrant la connexion WebSocket et la synchronisation multijoueur du salon.
 */
export function useSyncRoom({
  roomId,
  username,
  token,
  userId,
  wsBaseUrl = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:8000",
}: UseSyncRoomOptions) {
  const { t } = useTranslation(["room", "global", "errors"]);
  const { isRateLimited, getRemainingCooldown, lockAction } = useRateLimiter();

  // États du salon et de la session
  const [isConnected, setIsConnected] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentUserId, setCurrentUserId] = useState<string | null>(userId || null);
  const [participants, setParticipants] = useState<Participant[]>(() => {
    if (username) {
      return [
        {
          id: userId || "self",
          username,
          is_host: Boolean(token),
          ping_ms: 0,
          joined_at: Date.now(),
        },
      ];
    }
    return [];
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
  const [error, setError] = useState<string | null>(null);

  // Références stables pour les callbacks asynchrones du WebSocket
  const socketRef = useRef<Socket | null>(null);
  const currentUsernameRef = useRef(username);
  const currentUserIdRef = useRef<string | null>(userId || null);
  const myPingRef = useRef(0);
  const tRef = useRef(t);
  const lockActionRef = useRef(lockAction);
  const authoritativePlayerRef = useRef<PlayerState>(player);

  // Synchronisation synchrone des refs à chaque render
  tRef.current = t;
  currentUsernameRef.current = currentUsername;
  currentUserIdRef.current = currentUserId;
  myPingRef.current = myPing;
  lockActionRef.current = lockAction;

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

  // Initialisation et gestion du cycle de vie Socket.IO
  useEffect(() => {
    if (!roomId || !username) return;

    // Normaliser l'URL WebSocket en HTTP/HTTPS pour le client Socket.IO
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

    // --- 1. Cycle de connexion ---
    socket.on("connect", () => {
      setIsConnected(true);
      setError(null);
      socket.emit("HEARTBEAT", {
        client_sent_at: Date.now(),
        ping_ms: myPingRef.current,
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[useSyncRoom] Erreur de connexion Socket.IO :", err.message);
      setIsConnected(false);
      setError(err.message);
      toast.error(err.message, { id: "socket-connect-error" });
    });

    // --- 2. Synchronisation de la salle et du lecteur ---
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

      // Si le serveur indique qu'on n'est pas hôte, purger l'ancien token hôte local
      const myId = payload.your_id || currentUserIdRef.current || userId;
      const myName = payload.your_username || currentUsernameRef.current || username;
      const me = (roomData.participants || []).find(
        (p) => (myId && p.id === myId) || p.username === myName
      );
      if (me && !me.is_host) {
        sessionManager.clearHostToken(roomId);
      }
    });

    socket.on("PLAYER_UPDATED", (payload: PlayerUpdatedPayload) => {
      setPlayer(payload.player);
      authoritativePlayerRef.current = payload.player;

      const isSelf = isSelfUser(payload.triggered_by, currentUsernameRef.current, username);
      if (payload.triggered_by && !isSelf) {
        const toastKeyMap: Record<string, string> = {
          PLAY: "toast.play",
          PAUSE: "toast.pause",
          SEEK: "toast.seek",
          CHANGE_MEDIA: "toast.loadMedia",
        };
        const translationKey = toastKeyMap[payload.action];
        if (translationKey) {
          toast.info(tRef.current(translationKey, { user: payload.triggered_by }), {
            id: "player-sync-action",
          });
        }
      }
    });

    socket.on("SETTINGS_UPDATED", (payload: SettingsUpdatedPayload) => {
      setRoomSettings(payload.settings);
      if (payload.settings.is_locked) {
        toast.warning(tRef.current("toast.roomLocked"), { id: "room-lock-status" });
      } else {
        toast.info(tRef.current("toast.roomUnlocked"), { id: "room-lock-status" });
      }
    });

    // --- 3. Gestion des participants et rôles ---
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

    // --- 4. Tchat et métriques réseau ---
    socket.on("CHAT_BROADCAST", (payload: ChatMessage) => {
      setMessages((prev) => [...prev, payload]);
    });

    socket.on("HEARTBEAT_ACK", (payload: HeartbeatAckPayload) => {
      if (payload.client_sent_at) {
        const rtt = Math.max(0, Date.now() - payload.client_sent_at);
        setMyPing(Math.round(rtt / 2));
      } else {
        setMyPing(payload.ping_ms || 0);
      }
    });

    socket.on("PING_UPDATED", (payload: PingUpdatedPayload) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === payload.user_id ? { ...p, ping_ms: payload.ping_ms } : p))
      );
    });

    // --- 5. Erreurs et Rate Limiting ---
    socket.on("ERROR", (payload: ErrorPayload) => {
      const localizedMsg = formatErrorMessage(payload, tRef.current);
      setError(localizedMsg);
      toast.error(localizedMsg, { id: `ws-err-${payload.code || "generic"}` });

      if (payload.code === "RATE_LIMITED") {
        const action = payload.action;
        const retryAfter = payload.retry_after || 2;
        if (action) {
          lockActionRef.current(action, retryAfter);
        } else {
          lockActionRef.current("SEEK", retryAfter);
          lockActionRef.current("PLAY", retryAfter);
          lockActionRef.current("PAUSE", retryAfter);
        }

        // Rollback sur l'état faisant autorité côté serveur
        if (!action || action === "SEEK" || action === "PLAY" || action === "PAUSE") {
          setPlayer({
            ...authoritativePlayerRef.current,
            last_updated_at: Date.now(),
          });
        }
      }
    });

    // Mesure de latence périodique
    const heartbeatTimer = setInterval(() => {
      if (socket.connected) {
        socket.emit("HEARTBEAT", {
          client_sent_at: Date.now(),
          ping_ms: myPingRef.current,
        });
      }
    }, 5000);

    return () => {
      clearInterval(heartbeatTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, username, token, wsBaseUrl]);

  // Déterminer si l'utilisateur courant est hôte
  const effectiveUserId = currentUserId || userId;
  const isHost = useMemo(() => {
    return Boolean(
      participants.find(
        (p) => (effectiveUserId && p.id === effectiveUserId) || p.username === currentUsername
      )?.is_host
    );
  }, [participants, effectiveUserId, currentUsername]);

  return {
    isConnected,
    participants,
    player,
    roomSettings,
    messages,
    myPing,
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
  };
}
