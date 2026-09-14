import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { roomApi } from "@/services/roomApi";
import { validateUsername } from "@/lib/validation";
import { formatErrorMessage } from "@/lib/errorMapper";
import { sessionManager } from "@/lib/session";
import { extractRoomCode } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { useUIStore } from "@/stores/uiStore";

export type HomeMode = "create" | "join";
export type JoinStep = "code" | "username";

/**
 * Hook orchestrant l'intégralité du flux d'accueil :
 * - Machine à états (Création vs Rejoindre, Étape Code vs Étape Pseudo)
 * - Traitement des invitations directes par URL (?join=CODE)
 * - Validation des formulaires et persistance de session
 * - Effet atmosphérique (halo rouge en création, cyan en connexion)
 */
export function useHome() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation(["global", "validation", "errors"]);
  const setGlowColor = useUIStore((s) => s.setGlowColor);

  const initialJoinParam = searchParams.get("join");
  const initialCleanCode = initialJoinParam ? extractRoomCode(initialJoinParam) : null;

  const [mode, setMode] = useState<HomeMode>(() => (initialCleanCode ? "join" : "create"));
  const [joinStep, setJoinStep] = useState<JoinStep>("code");
  const [username, setUsername] = useState(() => sessionManager.getLastUsername());
  const [roomCode, setRoomCode] = useState(() => initialCleanCode || "");
  const [validatedRoomCode, setValidatedRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Maintient la lueur d'ambiance cyan de la marque sur l'accueil
  useEffect(() => {
    setGlowColor("cyan");
  }, [setGlowColor]);

  const clearJoinParam = () => {
    if (searchParams.has("join")) {
      setSearchParams({}, { replace: true });
    }
  };

  // Traitement automatique d'une invitation via ?join=ROOM_ID
  useEffect(() => {
    const joinParam = searchParams.get("join");
    if (!joinParam) return;

    const cleanCode = extractRoomCode(joinParam);
    if (!cleanCode) return;

    setMode("join");
    setRoomCode(cleanCode);
    setIsLoading(true);

    roomApi
      .checkRoom(cleanCode)
      .then((check) => {
        if (check.exists) {
          setValidatedRoomCode(cleanCode);
          setJoinStep("username");
        } else {
          toast.error(formatErrorMessage("ROOM_NOT_FOUND", t), { id: "home-join-not-found" });
          setJoinStep("code");
          clearJoinParam();
        }
      })
      .catch((err) => {
        toast.error(formatErrorMessage(err, t), { id: "home-join-error" });
        setJoinStep("code");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [searchParams, t]);

  const handleSwitchMode = (newMode: HomeMode) => {
    setMode(newMode);
    if (newMode === "create") {
      setJoinStep("code");
      clearJoinParam();
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleCancelValidatedCode = () => {
    setJoinStep("code");
    clearJoinParam();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mode === "join" && joinStep === "username") {
      if ((e.key === "Backspace" && !username) || e.key === "Escape") {
        e.preventDefault();
        handleCancelValidatedCode();
      }
    }
  };

  const validateAndGetUsername = (): string | null => {
    const valError = validateUsername(username, (key) =>
      t(key, { ns: "validation" })
    );
    if (valError) {
      toast.error(valError, { id: "home-val-error" });
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
        setIsLoading(false);
      }
    } else if (joinStep === "code") {
      const cleanRoomCode = extractRoomCode(roomCode);
      if (!cleanRoomCode) {
        toast.error(formatErrorMessage("MISSING_ROOM_CODE", t), { id: "home-room-code-error" });
        return;
      }

      setIsLoading(true);
      try {
        const check = await roomApi.checkRoom(cleanRoomCode);
        if (!check.exists) {
          toast.error(formatErrorMessage("ROOM_NOT_FOUND", t), { id: "home-room-not-found" });
          setIsLoading(false);
          return;
        }

        setValidatedRoomCode(cleanRoomCode);
        setJoinStep("username");
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      } catch (err: unknown) {
        toast.error(formatErrorMessage(err, t), { id: "home-api-error" });
        setIsLoading(false);
      }
    } else {
      const cleanUsername = validateAndGetUsername();
      if (!cleanUsername) return;

      sessionManager.setRoomSession(validatedRoomCode, { username: cleanUsername });
      navigate(`/room/${validatedRoomCode}`);
    }
  };

  const isUsernameInput = mode === "create" || joinStep === "username";

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
    inputValue: isUsernameInput ? username : roomCode,
    setInputValue: (val: string) => {
      if (isUsernameInput) {
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
      mode === "join" && joinStep === "username"
        ? {
            text: `#${validatedRoomCode}`,
            onRemove: handleCancelValidatedCode,
          }
        : null,
  };
}

export default useHome;
