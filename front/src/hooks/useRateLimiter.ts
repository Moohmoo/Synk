import { useState, useRef, useEffect, useCallback } from "react";

const DEFAULT_COOLDOWN_SECONDS = 2;

export interface RateLimiter {
  /** Indique si une action est actuellement bloquée par le limiteur de débit. */
  isRateLimited: (action: string) => boolean;
  /** Retourne le temps d'attente restant en secondes (0 si autorisée). */
  getRemainingCooldown: (action: string) => number;
  /** Verrouille temporairement une action pendant une durée donnée en secondes. */
  lockAction: (action: string, durationSeconds?: number) => void;
}

/**
 * Hook de limitation de débit côté client (Frontend Rate Limiter) :
 * - Maintient l'état réactif des actions bloquées pour désactiver les contrôles visuels.
 * - Fournit des callbacks à référence stable pour éviter les cascades de re-renders.
 * - Nettoie automatiquement les timers au démontage.
 */
export function useRateLimiter(defaultDurationSeconds: number = DEFAULT_COOLDOWN_SECONDS): RateLimiter {
  const [lockedActions, setLockedActions] = useState<Record<string, number>>({});
  const lockedActionsRef = useRef(lockedActions);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Maintient la référence synchrone pour garantir la stabilité des callbacks
  lockedActionsRef.current = lockedActions;

  // Nettoyage impératif de tous les timers au démontage
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const lockAction = useCallback(
    (action: string, durationSeconds?: number) => {
      const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : defaultDurationSeconds;
      const expiresAt = Date.now() + duration * 1000;

      const existingTimer = timersRef.current.get(action);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      setLockedActions((prev) => ({ ...prev, [action]: expiresAt }));

      const timer = setTimeout(() => {
        timersRef.current.delete(action);
        setLockedActions((prev) => {
          if (!(action in prev)) return prev;
          const next = { ...prev };
          delete next[action];
          return next;
        });
      }, duration * 1000);

      timersRef.current.set(action, timer);
    },
    [defaultDurationSeconds]
  );

  const isRateLimited = useCallback((action: string): boolean => {
    const expiresAt = lockedActionsRef.current[action];
    return Boolean(expiresAt && Date.now() < expiresAt);
  }, []);

  const getRemainingCooldown = useCallback((action: string): number => {
    const expiresAt = lockedActionsRef.current[action];
    if (!expiresAt) return 0;
    const diffMs = expiresAt - Date.now();
    return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
  }, []);

  return {
    isRateLimited,
    getRemainingCooldown,
    lockAction,
  };
}

export default useRateLimiter;
