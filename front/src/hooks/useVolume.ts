import { useState, useCallback } from "react";

interface VolumeController {
  volume: number;
  isMuted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const VOLUME_STORAGE_KEY = "synk_volume";

/**
 * Gestionnaire autonome du volume audio local et de la sourdine.
 * Isole la persistance localStorage de la logique de synchronisation vidéo.
 */
export function useVolume(initialVolume: number = 100): VolumeController {
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    return saved !== null ? Number(saved) : initialVolume;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    localStorage.setItem(VOLUME_STORAGE_KEY, String(newVolume));
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

  return { volume, isMuted, setVolume, toggleMute };
}
