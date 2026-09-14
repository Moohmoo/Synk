import { create } from "zustand";

export type GlowColor = "cyan" | "red" | "none";

interface UIState {
  glowColor: GlowColor;
  isSidebarCollapsed: boolean;
  setGlowColor: (color: GlowColor) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  resetUI: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  glowColor: "cyan",
  isSidebarCollapsed: false,
  setGlowColor: (glowColor) => set({ glowColor }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  resetUI: () => set({ glowColor: "cyan", isSidebarCollapsed: false }),
}));
