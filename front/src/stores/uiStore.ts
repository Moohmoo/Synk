import { create } from "zustand";

export type GlowColor = "cyan" | "red" | "none";

interface UIState {
  glowColor: GlowColor;
  isFullscreen: boolean;
  setGlowColor: (color: GlowColor) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  resetUI: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  glowColor: "cyan",
  isFullscreen: false,
  setGlowColor: (glowColor) => set({ glowColor }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  resetUI: () => set({ glowColor: "cyan", isFullscreen: false }),
}));
