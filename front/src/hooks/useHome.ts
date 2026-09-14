import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { roomApi } from "@/services/roomApi";
import { validateUsername } from "@/lib/validation";
import { formatErrorMessage } from "@/lib/errorMapper";
import { sessionManager } from "@/lib/session";
import { extractRoomCode } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

export type HomeMode = "create" | "join";
export type JoinStep = "code" | "username";

/**
 * Résout le texte du bouton d'action principal de l'accueil sans ternaire imbriqué.
 */
function getHomeButtonText(
  mode: HomeMode,
  step: JoinStep,
  isLoading: boolean,
  t: TFunction
): string | undefined {
  if (mode === "create") return undefined;
  if (step === "code") {
    return isLoading ? t("home.checking") : t("home.next");
  }
  return isLoading ? t("home.connecting") : t("home.join");
}

/**
 * Résout l'invite de saisie (placeholder) selon le mode et l'étape courante.
 */
function getHomePlaceholder(mode: HomeMode, step: JoinStep, t: TFunction): string {
  if (mode === "create") return t("home.createPlaceholder");
  if (step === "code") return t("home.joinCodePlaceholder");
  return t("home.joinUsernamePlaceholder");
}

export function useHome() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation(["global", "validation", "errors"]);

  const initialJoinParam = searchParams.get("join") || "";
  const initialJoinCode = extractRoomCode(initialJoinParam);

  const [mode, setMode] = useState<HomeMode>(() => (initialJoinCode ? "join" : "create"));
  const [joinStep, setJoinStep] = useState<JoinStep>("code");
  const [username, setUsername] = useState(() => sessionManager.getLastUsername());
  const [roomCode, setRoomCode] = useState(() => initialJoinCode || "");
  const [validatedRoomCode, setValidatedRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const focusInput = useCallback(() => {
    // Différé d'un tick pour laisser le DOM monter et actualiser le focus
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const clearJoinParam = useCallback(() => {
    if (!searchParams.has("join")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("join");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const verifyAndSelectRoom = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const cleanCode = extractRoomCode(rawCode);
      if (!cleanCode) {
        toast.error(formatErrorMessage("MISSING_ROOM_CODE", t), { id: "home-room-code-error" });
        return false;
      }

      setIsLoading(true);
      try {
        const check = await roomApi.checkRoom(cleanCode);
        if (!check.exists) {
          toast.error(formatErrorMessage("ROOM_NOT_FOUND", t), { id: "home-room-not-found" });
          clearJoinParam();
          return false;
        }

        setValidatedRoomCode(cleanCode);
        setJoinStep("username");
        clearJoinParam();
        focusInput();
        return true;
      } catch (err: unknown) {
        toast.error(formatErrorMessage(err, t), { id: "home-api-error" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t, clearJoinParam, focusInput]
  );

  // Consomme l'invitation d'URL une seule fois au montage si présente
  useEffect(() => {
    if (!initialJoinCode) return;
    void verifyAndSelectRoom(initialJoinCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchMode = (newMode: HomeMode) => {
    setMode(newMode);
    if (newMode === "create") {
      setJoinStep("code");
      setValidatedRoomCode("");
      clearJoinParam();
    }
    focusInput();
  };

  const handleCancelValidatedCode = () => {
    setValidatedRoomCode("");
    setJoinStep("code");
    clearJoinParam();
    focusInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Annulation rapide du salon sélectionné comme un "tag" avec Retour ou Échap
    if (mode === "join" && joinStep === "username") {
      if ((e.key === "Backspace" && !username) || e.key === "Escape") {
        e.preventDefault();
        handleCancelValidatedCode();
      }
    }
  };

  const validateAndGetUsername = (): string | null => {
    const error = validateUsername(username, (key) => t(key, { ns: "validation" }));
    if (error) {
      toast.error(error, { id: "home-val-error" });
      return null;
    }
    return username.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (mode === "create") {
      const cleanUsername = validateAndGetUsername();
      if (!cleanUsername) return;

      setIsLoading(true);
      try {
        const data = await roomApi.createRoom(cleanUsername);
        sessionManager.setRoomSession(data.room_id, {
          username: cleanUsername,
          token: data.host_token,
          userId: data.user_id,
        });
        navigate(`/room/${data.room_id}`);
      } catch (err: unknown) {
        toast.error(formatErrorMessage(err, t), { id: "home-api-error" });
      } finally {
        setIsLoading(false);
      }
    } else if (joinStep === "code") {
      await verifyAndSelectRoom(roomCode);
    } else {
      const cleanUsername = validateAndGetUsername();
      if (!cleanUsername) return;

      sessionManager.setRoomSession(validatedRoomCode, { username: cleanUsername });
      navigate(`/room/${validatedRoomCode}`);
    }
  };

  const isUsernameStep = mode === "create" || joinStep === "username";
  const placeholder = getHomePlaceholder(mode, joinStep, t);
  const buttonText = getHomeButtonText(mode, joinStep, isLoading, t);

  return {
    mode,
    switchMode: handleSwitchMode,
    inputRef,
    inputValue: isUsernameStep ? username : roomCode,
    setInputValue: (val: string) => {
      if (isUsernameStep) {
        setUsername(val);
      } else {
        setRoomCode(val);
      }
    },
    handleKeyDown,
    handleSubmit,
    isLoading,
    placeholder,
    buttonText,
    badge:
      mode === "join" && joinStep === "username" && validatedRoomCode
        ? {
            text: `#${validatedRoomCode}`,
            onRemove: handleCancelValidatedCode,
          }
        : null,
  };
}

export default useHome;
