import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import {
  ChatMessage,
  Participant,
  PlayerState,
  Room,
  RoomSettings,
} from "@/types/room";
import {
  ErrorPayload,
  PlayerUpdatedPayload,
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

export function useSyncRoom({
  roomId,
  username,
  token,
  userId,
  wsBaseUrl = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:8000",
}: UseSyncRoomOptions) {
  const { t } = useTranslation(["room", "global", "errors"]);
  const { isRateLimited, getRemainingCooldown, lockAction, resetAction } = useRateLimiter();
  const [isConnected, setIsConnected] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentUserId, setCurrentUserId] = useState<string | null>(userId || null);
  const [participants, setParticipants] = useState<Participant[]>([]);
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

  // Actions utilisateur vers le serveur Socket.IO (stables & protégées contre le spam)
  const sendPlay = useCallback((currentTime?: number, duration?: number) => {
    if (isRateLimited("PLAY")) return;
    const pos = typeof currentTime === "number" && !isNaN(currentTime) ? currentTime : 0;
    const roundedPos = Math.round(pos * 100) / 100;
    const validDur = duration && duration > 0 ? Math.round(duration * 100) / 100 : undefined;
    socketRef.current?.emit("PLAY", {
      current_time: roundedPos,
      duration: validDur,
    });
    setPlayer((prev) => ({
      ...prev,
      is_playing: true,
      current_time: roundedPos,
      duration: validDur || prev.duration,
      last_updated_at: Date.now(),
    }));
  }, [isRateLimited]);

  const sendPause = useCallback((currentTime?: number, duration?: number) => {
    if (isRateLimited("PAUSE")) return;
    const pos = typeof currentTime === "number" && !isNaN(currentTime) ? currentTime : 0;
    const roundedPos = Math.round(pos * 100) / 100;
    const validDur = duration && duration > 0 ? Math.round(duration * 100) / 100 : undefined;
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
  }, [isRateLimited]);

  const sendSeek = useCallback((targetTime: number, duration?: number) => {
    if (isRateLimited("SEEK")) return;
    const validDur = duration && duration > 0 ? Math.round(duration * 100) / 100 : undefined;
    socketRef.current?.emit("SEEK", {
      target_time: targetTime,
      duration: validDur,
    });
    setPlayer((prev) => ({
      ...prev,
      current_time: targetTime,
      duration: validDur || prev.duration,
      last_updated_at: Date.now(),
    }));
  }, [isRateLimited]);

  const changeMedia = useCallback((url: string) => {
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
  }, [isRateLimited]);

  const sendChat = useCallback((content: string) => {
    if (isRateLimited("CHAT_MESSAGE")) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    socketRef.current?.emit("CHAT_MESSAGE", { content: trimmed });
  }, [isRateLimited]);

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

    socket.on("ROOM_SYNC", (payload: any) => {
      const roomData: Room = payload.room;
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

      // Si le serveur indique qu'on n'est pas hôte, purger l'ancien token hôte
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
      const isSelf =
        payload.triggered_by === currentUsernameRef.current ||
        payload.triggered_by === username;

      if (payload.triggered_by && !isSelf) {
        if (payload.action === "PLAY") {
          toast.info(tRef.current("toast.play", { user: payload.triggered_by }), {
            id: "player-sync-action",
          });
        } else if (payload.action === "PAUSE") {
          toast.info(tRef.current("toast.pause", { user: payload.triggered_by }), {
            id: "player-sync-action",
          });
        } else if (payload.action === "SEEK") {
          toast.info(tRef.current("toast.seek", { user: payload.triggered_by }), {
            id: "player-sync-action",
          });
        } else if (payload.action === "CHANGE_MEDIA") {
          toast.info(tRef.current("toast.loadMedia", { user: payload.triggered_by }), {
            id: "player-sync-action",
          });
        }
      }
    });

    socket.on("PARTICIPANT_JOINED", (payload: { user: Participant }) => {
      const newParticipant = payload.user;
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.id !== newParticipant.id);
        return [...filtered, newParticipant];
      });
      const isSelfJoined =
        newParticipant.username === currentUsernameRef.current ||
        newParticipant.username === username;
      if (!isSelfJoined) {
        toast.info(tRef.current("toast.userJoined", { user: newParticipant.username }));
      }
    });

    socket.on("PARTICIPANT_LEFT", (payload: { user_id: string; username: string; new_host_id?: string | null }) => {
      const { user_id, new_host_id } = payload;
      setParticipants((prev) => {
        const leaving = prev.find((p) => p.id === user_id);
        const isSelfLeft =
          leaving &&
          (leaving.username === currentUsernameRef.current ||
            leaving.username === username);
        if (leaving && !isSelfLeft) {
          toast.info(tRef.current("toast.userLeft", { user: leaving.username }));
        }
        return prev
          .filter((p) => p.id !== user_id)
          .map((p) => (p.id === new_host_id ? { ...p, is_host: true } : p));
      });
      if (new_host_id && (currentUserIdRef.current === new_host_id || userId === new_host_id)) {
        toast.info(tRef.current("toast.hostTransferredToYou"), {
          id: "host-transferred",
        });
      }
    });

    socket.on("HOST_PROMOTED", (payload: { host_token: string }) => {
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

    socket.on("HEARTBEAT_ACK", (payload: { client_sent_at: number; ping_ms: number }) => {
      if (payload.client_sent_at) {
        const rtt = Math.max(0, Date.now() - payload.client_sent_at);
        setMyPing(Math.round(rtt / 2));
      } else {
        setMyPing(payload.ping_ms || 0);
      }
    });

    socket.on("PING_UPDATED", (payload: { user_id: string; ping_ms: number }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === payload.user_id ? { ...p, ping_ms: payload.ping_ms } : p))
      );
    });

    socket.on("SETTINGS_UPDATED", (payload: { settings: RoomSettings }) => {
      setRoomSettings(payload.settings);
      if (payload.settings.is_locked) {
        toast.warning(tRef.current("toast.roomLocked"), { id: "room-lock-status" });
      } else {
        toast.info(tRef.current("toast.roomUnlocked"), { id: "room-lock-status" });
      }
    });

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

        // Rollback sur l'état officiel du salon en cas de rejet d'une commande
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
