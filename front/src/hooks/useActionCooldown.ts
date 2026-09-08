import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook réutilisable pour prémunir les interactions frénétiques et le spam de clics (Throttle / Cooldown).
 * - Exécute immédiatement la première action (Leading edge).
 * - Désactive toute invocation subséquente pendant `cooldownMs` millisecondes.
 * - Fournit l'état booléen `isCooldown` pour désactiver visuellement les boutons (`disabled={isCooldown}`).
 * - Nettoie proprement les timers à la destruction du composant (Unmount).
 */
export function useActionCooldown<T extends (...args: any[]) => any>(
  action: T,
  cooldownMs: number = 400
): [T, boolean] {
  const [isCooldown, setIsCooldown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const throttledAction = useCallback(
    (...args: Parameters<T>) => {
      if (isCooldown) return;

      setIsCooldown(true);
      actionRef.current(...args);

      timerRef.current = setTimeout(() => {
        setIsCooldown(false);
        timerRef.current = null;
      }, cooldownMs);
    },
    [isCooldown, cooldownMs]
  ) as T;

  return [throttledAction, isCooldown];
}

export default useActionCooldown;
