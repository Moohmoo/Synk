import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ChatMessage,
  Participant,
  PlayerState,
  Room,
  RoomSettings,
} from "@/types/room";
import {
  ClientEventType,
  ErrorPayload,
  PlayerUpdatedPayload,
  ServerEventType,
  WebSocketEvent,
} from "@/types/events";
import { formatErrorMessage } from "@/lib/errorMapper";
import { sessionManager } from "@/lib/session";

interface UseSyncRoomOptions {
  roomId: string;
  username: string;
  token?: string | null;
  userId?: string | null;
  wsBaseUrl?: string;
  onPlayerChange?: (payload: PlayerUpdatedPayload) => void;
}

export function useSyncRoom({
  roomId,
  username,
  token,
  userId,
  wsBaseUrl = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:8000",
  onPlayerChange,
}: UseSyncRoomOptions) {
  const { t } = useTranslation(["room", "global", "errors"]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentUserId, setCurrentUserId] = useState<string | null>(userId || null);
  const [room, setRoom] = useState<Room | null>(null);
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

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isManuallyClosedRef = useRef(false);
  const currentUsernameRef = useRef(username);
  const currentUserIdRef = useRef<string | null>(userId || null);
  const connectRef = useRef<() => void>(() => {});

  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  }, [currentUsername]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Envoi d'événements typés vers le serveur WebSocket
  const sendEvent = useCallback((event: ClientEventType, payload: Record<string, any> = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message: WebSocketEvent = {
        event,
        payload,
        timestamp: Date.now(),
      };
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn(`[useSyncRoom] Impossible d'envoyer ${event}: socket non connectée.`);
    }
  }, []);

  const sendPlay = useCallback((currentTime?: number) => {
    let target = currentTime;
    if (typeof target !== "number" || isNaN(target)) {
      if (player.is_playing) {
        const elapsed = Math.max(0, (Date.now() - player.last_updated_at) / 1000);
        target = player.current_time + elapsed;
      } else {
        target = player.current_time;
      }
    }
    // Si la vidéo a atteint la fin, réinitialiser à 0s pour relancer la lecture
    if (player.duration && player.duration > 0 && target >= player.duration - 0.5) {
      target = 0;
    }
    sendEvent("PLAY", { current_time: Math.round(target * 100) / 100 });
  }, [sendEvent, player.is_playing, player.current_time, player.last_updated_at, player.duration]);

  const sendPause = useCallback((currentTime?: number) => {
    let target = currentTime;
    if (typeof target !== "number" || isNaN(target)) {
      if (player.is_playing) {
        const elapsed = Math.max(0, (Date.now() - player.last_updated_at) / 1000);
        target = player.current_time + elapsed;
      } else {
        target = player.current_time;
      }
    }
    sendEvent("PAUSE", { current_time: Math.round(target * 100) / 100 });
  }, [sendEvent, player.is_playing, player.current_time, player.last_updated_at]);

  const sendSeek = useCallback((targetTime: number) => {
    sendEvent("SEEK", { target_time: targetTime });
  }, [sendEvent]);

  const changeMedia = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    sendEvent("CHANGE_MEDIA", { url: trimmed });
  }, [sendEvent]);

  const sendChat = useCallback((content: string) => {
    if (!content.trim()) return;
    sendEvent("CHAT_MESSAGE", { content: content.trim() });
  }, [sendEvent]);

  const updateSettings = useCallback((isLocked: boolean) => {
    if (roomSettings.is_locked === isLocked) return;
    sendEvent("UPDATE_SETTINGS", { is_locked: isLocked });
  }, [sendEvent, roomSettings.is_locked]);

  const scheduleReconnect = useCallback(() => {
    if (isManuallyClosedRef.current) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    const attempts = reconnectAttemptsRef.current;
    // Backoff exponentiel : 1s, 2s, 4s, 8s, plafonné à 15s max
    const delay = Math.min(1000 * Math.pow(2, attempts), 15000);
    reconnectAttemptsRef.current += 1;
    console.log(`[useSyncRoom] Reconnexion WebSocket dans ${delay}ms (tentative ${reconnectAttemptsRef.current})`);
    reconnectTimerRef.current = setTimeout(() => {
      connectRef.current();
    }, delay);
  }, []);

  // Connexion WebSocket Native & Cycle de vie
  const connect = useCallback(() => {
    if (!roomId || !username) return;

    // Nettoyer tout timer de reconnexion en attente
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Fermer proprement toute instance zombie résiduelle
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
    }

    const params = new URLSearchParams({
      username,
      ...(token ? { token } : {}),
      ...(userId ? { user_id: userId } : {}),
    });

    const url = `${wsBaseUrl}/api/v1/rooms/${roomId}/ws?${params.toString()}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      heartbeatTimerRef.current = setInterval(() => {
        sendEvent("HEARTBEAT", { client_sent_at: Date.now() });
      }, 5000);
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketEvent = JSON.parse(event.data);
        const serverEvent = data.event as ServerEventType;
        const payload = data.payload;

        switch (serverEvent) {
          case "ROOM_SYNC": {
            const roomData: Room = payload.room;
            setRoom(roomData);
            setParticipants(roomData.participants);
            setPlayer(roomData.player);
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

            // Si le serveur indique que l'on n'est pas hôte, purger tout ancien token résiduel du sessionStorage
            const myId = payload.your_id || currentUserIdRef.current || userId;
            const myName = payload.your_username || currentUsernameRef.current || username;
            const me = (roomData.participants || []).find(
              (p) => (myId && p.id === myId) || p.username === myName
            );
            if (me && !me.is_host) {
              sessionManager.clearHostToken(roomId);
            }
            break;
          }

          case "PLAYER_UPDATED": {
            const updatePayload = payload as PlayerUpdatedPayload;
            setPlayer(updatePayload.player);
            if (onPlayerChange) {
              onPlayerChange(updatePayload);
            }
            const isSelf =
              updatePayload.triggered_by === currentUsernameRef.current ||
              updatePayload.triggered_by === username;

            if (updatePayload.triggered_by && !isSelf) {
              if (updatePayload.action === "PLAY") {
                toast.info(t("toast.play", { user: updatePayload.triggered_by }), {
                  id: "player-sync-action",
                });
              } else if (updatePayload.action === "PAUSE") {
                toast.info(t("toast.pause", { user: updatePayload.triggered_by }), {
                  id: "player-sync-action",
                });
              } else if (updatePayload.action === "SEEK") {
                toast.info(t("toast.seek", { user: updatePayload.triggered_by }), {
                  id: "player-sync-action",
                });
              } else if (updatePayload.action === "CHANGE_MEDIA") {
                toast.info(t("toast.loadMedia", { user: updatePayload.triggered_by }), {
                  id: "player-sync-action",
                });
              }
            }
            break;
          }

          case "PARTICIPANT_JOINED": {
            const newParticipant: Participant = payload.user;
            setParticipants((prev) => {
              const filtered = prev.filter((p) => p.id !== newParticipant.id);
              return [...filtered, newParticipant];
            });
            const isSelfJoined =
              newParticipant.username === currentUsernameRef.current ||
              newParticipant.username === username;
            if (!isSelfJoined) {
              toast.info(t("toast.userJoined", { user: newParticipant.username }));
            }
            break;
          }

          case "PARTICIPANT_LEFT": {
            const { user_id, new_host_id } = payload;
            setParticipants((prev) => {
              const leaving = prev.find((p) => p.id === user_id);
              const isSelfLeft =
                leaving &&
                (leaving.username === currentUsernameRef.current ||
                  leaving.username === username);
              if (leaving && !isSelfLeft) {
                toast.info(t("toast.userLeft", { user: leaving.username }));
              }
              return prev
                .filter((p) => p.id !== user_id)
                .map((p) => (p.id === new_host_id ? { ...p, is_host: true } : p));
            });
            if (new_host_id && (currentUserIdRef.current === new_host_id || userId === new_host_id)) {
              toast.info(t("toast.hostTransferredToYou", { defaultValue: "Vous êtes désormais l'hôte du salon !" }), {
                id: "host-transferred",
              });
            }
            break;
          }

          case "HOST_PROMOTED": {
            const { host_token } = payload as { host_token: string };
            if (host_token) {
              sessionManager.setHostToken(roomId, host_token);
              toast.info(t("toast.hostTransferredToYou", { defaultValue: "Vous êtes désormais l'hôte du salon !" }), {
                id: "host-transferred",
              });
            }
            break;
          }

          case "CHAT_BROADCAST": {
            const chatMsg: ChatMessage = payload;
            setMessages((prev) => [...prev, chatMsg]);
            break;
          }

          case "HEARTBEAT_ACK": {
            const { client_sent_at } = payload;
            const rtt = Math.max(0, Date.now() - client_sent_at);
            setMyPing(rtt);
            break;
          }

          case "PING_UPDATED": {
            const { user_id, ping_ms } = payload;
            setParticipants((prev) =>
              prev.map((p) => (p.id === user_id ? { ...p, ping_ms } : p))
            );
            break;
          }

          case "SETTINGS_UPDATED": {
            setRoomSettings(payload.settings);
            if (payload.settings.is_locked) {
              toast.warning(t("toast.roomLocked"), { id: "room-lock-status" });
            } else {
              toast.info(t("toast.roomUnlocked"), { id: "room-lock-status" });
            }
            break;
          }

          case "ERROR": {
            const err = payload as ErrorPayload;
            const localizedMsg = formatErrorMessage(err, t);
            setError(localizedMsg);
            toast.error(localizedMsg, { id: `ws-err-${err.code || "generic"}` });
            break;
          }
        }
      } catch (e) {
        console.error("[useSyncRoom] Erreur de parsing JSON WebSocket :", e);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      // Reconnexion automatique si non fermée manuellement et non expulsée (4001: auth, 4003: kick)
      if (!isManuallyClosedRef.current && event.code !== 4001 && event.code !== 4003) {
        scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.error("[useSyncRoom] Erreur WebSocket :", err);
    };
  }, [roomId, username, token, userId, wsBaseUrl, sendEvent, onPlayerChange, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Réveil de la connexion WebSocket au retour sur l'onglet
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const ws = socketRef.current;
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          console.log("[useSyncRoom] Onglet redevenu visible & WebSocket inactif : reconnexion immédiate");
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          reconnectAttemptsRef.current = 0;
          connect();
        } else if (ws.readyState === WebSocket.OPEN) {
          // Contrôle de vivacité de la socket TCP après réveil
          sendEvent("HEARTBEAT", { client_sent_at: Date.now() });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connect, sendEvent]);

  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    room,
    participants,
    player,
    roomSettings,
    messages,
    myPing,
    error,
    currentUsername,
    currentUserId,
    sendPlay,
    sendPause,
    sendSeek,
    changeMedia,
    sendChat,
    updateSettings,
  };
}
