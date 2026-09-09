import { PlayerState, Room, Participant, RoomSettings } from "./room";

export type ClientEventType =
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "CHANGE_MEDIA"
  | "CHAT_MESSAGE"
  | "HEARTBEAT"
  | "UPDATE_SETTINGS";

export type ServerEventType =
  | "ROOM_SYNC"
  | "PLAYER_UPDATED"
  | "PARTICIPANT_JOINED"
  | "PARTICIPANT_LEFT"
  | "CHAT_BROADCAST"
  | "HEARTBEAT_ACK"
  | "PING_UPDATED"
  | "SETTINGS_UPDATED"
  | "ERROR"
  | "HOST_PROMOTED";

export interface RoomSyncPayload {
  room: Room;
  your_id?: string;
  your_username?: string;
}

export interface ParticipantJoinedPayload {
  user: Participant;
}

export interface ParticipantLeftPayload {
  user_id: string;
  username: string;
  new_host_id?: string | null;
}

export interface HeartbeatAckPayload {
  client_sent_at: number;
  ping_ms: number;
}

export interface PingUpdatedPayload {
  user_id: string;
  ping_ms: number;
}

export interface SettingsUpdatedPayload {
  settings: RoomSettings;
}

export interface HostPromotedPayload {
  host_token: string;
}

export interface WebSocketEvent<T = any> {
  event: ClientEventType | ServerEventType;
  payload: T;
  timestamp: number;
}

export interface PlayerUpdatedPayload {
  action: "PLAY" | "PAUSE" | "SEEK" | "CHANGE_MEDIA";
  current_time?: number;
  target_time?: number;
  media_url?: string;
  media_id?: string;
  provider?: string;
  media_type?: string;
  triggered_by: string;
  player: PlayerState;
}

export type ErrorCode =
  | "INVALID_MEDIA_URL"
  | "ROOM_LOCKED"
  | "LOCKED"
  | "FORBIDDEN_HOST_ONLY"
  | "FORBIDDEN"
  | "ROOM_NOT_FOUND"
  | "INVALID_HOST_TOKEN"
  | "INVALID_PLAYBACK_PAYLOAD"
  | "INVALID_SEEK_PAYLOAD"
  | "INVALID_CHAT_PAYLOAD"
  | "INVALID_HEARTBEAT"
  | "INVALID_SETTINGS"
  | "INVALID_PAYLOAD"
  | "INVALID_JSON"
  | "UNKNOWN_EVENT"
  | "RATE_LIMIT"
  | "RATE_LIMITED"
  | "RATE_LIMIT_EXCEEDED"
  | "PAYLOAD_TOO_LARGE"
  | "VALIDATION_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR"
  | "NETWORK_ERROR"
  | "ROOM_CREATE_FAILED"
  | "ROOM_JOIN_FAILED"
  | "MISSING_ROOM_CODE"
  | "UNKNOWN_ERROR"
  | string;

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  action?: string;
  retry_after?: number;
}

