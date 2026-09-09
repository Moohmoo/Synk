import { useState, useRef, useEffect, useCallback } from "react";

export interface RateLimiter {
  /** Vérifie si une action est actuellement bloquée par le limiteur de débit. */
  isRateLimited: (action: string) => boolean;
  /** Retourne le temps d'attente restant en secondes pour une action donnée (0 si autorisée). */
  getRemainingCooldown: (action: string) => number;
  /** Verrouille temporairement une action pour une durée donnée en secondes. */
  lockAction: (action: string, durationSeconds?: number) => void;
  /** Déverrouille manuellement une action. */
  resetAction: (action: string) => void;
}

/**
 * Hook générique de limitation de débit côté client (Frontend Rate Limiter).
 *
 * Permet de verrouiller de manière déclarative et réactive des actions utilisateur
 * (ex: boutons, sliders, soumissions de formulaires) suite à des réponses serveur 429
 * ou des événements WebSocket RATE_LIMITED, avec gestion automatique du déverrouillage
 * et nettoyage des timers au démontage.
 *
 * @param defaultDurationSeconds Durée de verrouillage par défaut (2s par défaut)
 */
export function useRateLimiter(defaultDurationSeconds: number = 2): RateLimiter {
  const [lockedActions, setLockedActions] = useState<Record<string, number>>({});
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Nettoyage de l'ensemble des timers au démontage du composant
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const lockAction = useCallback(
    (action: string, durationSeconds?: number) => {
      const duration =
        durationSeconds && durationSeconds > 0
          ? durationSeconds
          : defaultDurationSeconds;
      const expiresAt = Date.now() + duration * 1000;

      // Annuler tout timer préexistant pour cette action
      const existing = timersRef.current.get(action);
      if (existing) {
        clearTimeout(existing);
      }

      setLockedActions((prev) => ({ ...prev, [action]: expiresAt }));

      const timer = setTimeout(() => {
        setLockedActions((prev) => {
          if (!(action in prev)) return prev;
          const next = { ...prev };
          delete next[action];
          return next;
        });
        timersRef.current.delete(action);
      }, duration * 1000);

      timersRef.current.set(action, timer);
    },
    [defaultDurationSeconds]
  );

  const resetAction = useCallback((action: string) => {
    const existing = timersRef.current.get(action);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(action);
    }
    setLockedActions((prev) => {
      if (!(action in prev)) return prev;
      const next = { ...prev };
      delete next[action];
      return next;
    });
  }, []);

  const isRateLimited = useCallback(
    (action: string): boolean => {
      const expiresAt = lockedActions[action];
      if (!expiresAt) return false;
      return Date.now() < expiresAt;
    },
    [lockedActions]
  );

  const getRemainingCooldown = useCallback(
    (action: string): number => {
      const expiresAt = lockedActions[action];
      if (!expiresAt) return 0;
      const diffMs = expiresAt - Date.now();
      return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
    },
    [lockedActions]
  );

  return {
    isRateLimited,
    getRemainingCooldown,
    lockAction,
    resetAction,
  };
}
