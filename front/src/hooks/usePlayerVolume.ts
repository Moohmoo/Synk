import { useState, useCallback } from "react";

const STORAGE_KEY = "synk_volume";

export function usePlayerVolume(initialVolume = 100) {
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? Number(saved) : initialVolume;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    localStorage.setItem(STORAGE_KEY, String(newVolume));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prevMuted) => {
      if (prevMuted) {
        if (volume === 0) setVolume(50);
        return false;
      }
      return true;
    });
  }, [volume, setVolume]);

  return {
    volume,
    isMuted,
    setVolume,
    toggleMute,
  };
}
