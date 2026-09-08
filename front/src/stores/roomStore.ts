import { create } from "zustand";
import { ChatMessage, Participant, PlayerState, RoomSettings } from "@/types/room";

interface RoomStoreState {
  // Session
  roomId: string | null;
  username: string;
  token: string | null;
  userId: string | null;
  isReady: boolean;

  // Real-time state
  isConnected: boolean;
  myPing: number;
  player: PlayerState;
  roomSettings: RoomSettings;
  participants: Participant[];
  messages: ChatMessage[];

  // UI state
  activeTab: "chat" | "participants";
  isJoinModalOpen: boolean;

  // Actions
  setSession: (params: {
    roomId: string;
    username: string;
    token?: string | null;
    userId?: string | null;
  }) => void;
  setUsername: (username: string) => void;
  setReady: (isReady: boolean) => void;
  setConnected: (isConnected: boolean) => void;
  setMyPing: (ping: number) => void;
  setPlayer: (player: PlayerState) => void;
  updatePlayerTime: (currentTime: number) => void;
  setRoomSettings: (settings: RoomSettings) => void;
  setParticipants: (participants: Participant[]) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setActiveTab: (tab: "chat" | "participants") => void;
  setJoinModalOpen: (open: boolean) => void;
  resetRoom: () => void;
}

const initialPlayer: PlayerState = {
  media_url: null,
  media_id: null,
  provider: null,
  media_type: null,
  is_playing: false,
  current_time: 0,
  duration: 0,
  last_updated_at: Date.now(),
};

const initialSettings: RoomSettings = {
  is_locked: false,
};

export const useRoomStore = create<RoomStoreState>((set) => ({
  roomId: null,
  username: "",
  token: null,
  userId: null,
  isReady: false,

  isConnected: false,
  myPing: 0,
  player: initialPlayer,
  roomSettings: initialSettings,
  participants: [],
  messages: [],

  activeTab: "chat",
  isJoinModalOpen: false,

  setSession: ({ roomId, username, token = null, userId = null }) =>
    set({ roomId, username, token, userId, isReady: true }),

  setUsername: (username) => set({ username }),
  setReady: (isReady) => set({ isReady }),
  setConnected: (isConnected) => set({ isConnected }),
  setMyPing: (myPing) => set({ myPing }),
  setPlayer: (player) => set({ player }),
  updatePlayerTime: (current_time) =>
    set((state) => ({ player: { ...state.player, current_time } })),
  setRoomSettings: (roomSettings) => set({ roomSettings }),
  setParticipants: (participants) => set({ participants }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setJoinModalOpen: (isJoinModalOpen) => set({ isJoinModalOpen }),

  resetRoom: () =>
    set({
      roomId: null,
      username: "",
      token: null,
      userId: null,
      isReady: false,
      isConnected: false,
      myPing: 0,
      player: initialPlayer,
      roomSettings: initialSettings,
      participants: [],
      messages: [],
      activeTab: "chat",
      isJoinModalOpen: false,
    }),
}));
