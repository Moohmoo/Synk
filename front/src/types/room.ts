export interface RoomSettings {
  is_locked: boolean;
}

export interface PlayerState {
  media_url?: string | null;
  media_id?: string | null;
  provider?: string | null;
  media_type?: string | null;
  is_playing: boolean;
  current_time: number;
  duration?: number;
  last_updated_at: number;
}

export interface Participant {
  id: string;
  username: string;
  is_host: boolean;
  joined_at: number;
  ping_ms: number;
}

export interface Room {
  room_id: string;
  created_at: number;
  host_id: string;
  settings: RoomSettings;
  player: PlayerState;
  participants: Participant[];
}

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  time: string;
}

export interface RoomCreateResponse {
  room_id: string;
  host_token: string;
  user_id: string;
}

export interface RoomCheckResponse {
  exists: boolean;
  participant_count: number;
}
