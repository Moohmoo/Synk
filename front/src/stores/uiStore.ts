import { create } from "zustand";

export type GlowColor = "cyan" | "red" | "none";

interface UIState {
  glowColor: GlowColor;
  setGlowColor: (color: GlowColor) => void;
  resetUI: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  glowColor: "cyan",
  setGlowColor: (glowColor) => set({ glowColor }),
  resetUI: () => set({ glowColor: "cyan" }),
}));

