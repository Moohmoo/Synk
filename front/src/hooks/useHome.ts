import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { roomApi } from "@/services/roomApi";
import { validateUsername } from "@/lib/validation";
import { formatErrorMessage } from "@/lib/errorMapper";
import { sessionManager } from "@/lib/session";
import { extractRoomCode } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

export type HomeMode = "create" | "join";
export type JoinStep = "code" | "username";

export function useHome() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation(["global", "validation", "errors"]);

  const initialJoinCode = extractRoomCode(searchParams.get("join") || "");

  const [mode, setMode] = useState<HomeMode>(() => (initialJoinCode ? "join" : "create"));
  const [joinStep, setJoinStep] = useState<JoinStep>("code");
  const [username, setUsername] = useState(() => sessionManager.getLastUsername());
  const [roomCode, setRoomCode] = useState(() => initialJoinCode || "");
  const [validatedRoomCode, setValidatedRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const focusInput = useCallback(() => {
    // Différé d'un tick pour laisser le DOM monter le nouveau mode de l'omnibox
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const clearJoinParam = useCallback(() => {
    if (!searchParams.has("join")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("join");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Vérification asynchrone unique d'un salon (URL ou formulaire)
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

  // Consomme l'invitation URL au montage sans boucle de re-déclenchement
  useEffect(() => {
    const joinParam = searchParams.get("join");
    if (!joinParam) return;

    setMode("join");
    setRoomCode(joinParam);
    void verifyAndSelectRoom(joinParam);
  }, [searchParams, verifyAndSelectRoom]);

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
    // Permet d'annuler le salon sélectionné comme un "tag" si le pseudo est vide
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

  const placeholder =
    mode === "create"
      ? t("home.createPlaceholder")
      : joinStep === "code"
      ? t("home.joinCodePlaceholder")
      : t("home.joinUsernamePlaceholder");

  const buttonText =
    mode === "create"
      ? undefined
      : joinStep === "code"
      ? isLoading
        ? t("home.checking")
        : t("home.next")
      : isLoading
      ? t("home.connecting")
      : t("home.join");

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
