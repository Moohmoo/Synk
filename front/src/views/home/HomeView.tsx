import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Omnibox } from "@/components/shared";
import { roomApi } from "@/services/roomApi";
import { validateUsername } from "@/lib/validation";
import { formatErrorMessage } from "@/lib/errorMapper";
import { sessionManager } from "@/lib/session";
import { extractRoomCode } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { useUIStore } from "@/stores/uiStore";

export function HomeView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation(["global", "validation", "errors"]);
  const setGlowColor = useUIStore((s) => s.setGlowColor);

  const [mode, setMode] = useState<"create" | "join">("create");
  const [joinStep, setJoinStep] = useState<"code" | "username">("code");
  const [username, setUsername] = useState(() => sessionManager.getLastUsername());
  const [roomCode, setRoomCode] = useState("");
  const [validatedRoomCode, setValidatedRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Synchronise la lueur d'ambiance avec le mode actif (rouge pour créer, cyan pour rejoindre)
  useEffect(() => {
    setGlowColor(mode === "create" ? "red" : "cyan");
    return () => setGlowColor("cyan");
  }, [mode, setGlowColor]);

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

  const handleSwitchMode = (newMode: "create" | "join") => {
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

  /**
   * Valide le pseudo courant, affiche une notification d'erreur si invalide
   * et retourne le pseudo nettoyé ou null.
   */
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
      } catch (err: any) {
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
      } catch (err: any) {
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

  return (
    <div className="relative flex flex-col items-center justify-center h-full pt-10 pb-32 w-full max-w-full px-6 md:px-12">
      {/* Conteneur principal */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Le sélecteur de mode (Créer / Rejoindre) */}
        <div className="relative flex p-1 mb-6 bg-[#18181b] rounded-md border border-white/5 mx-auto">
          <div
            className={`absolute top-1 bottom-1 left-1 w-[120px] bg-[#27272a] rounded shadow-sm transition-transform duration-300 ease-out ${
              mode === "create" ? "translate-x-0" : "translate-x-[120px]"
            }`}
          />

          <button
            type="button"
            onClick={() => handleSwitchMode("create")}
            className={`relative z-10 w-[120px] text-center px-3 py-1 text-xs font-medium transition-colors duration-300 ${
              mode === "create" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t("home.createTab")}
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode("join")}
            className={`relative z-10 w-[120px] text-center px-3 py-1 text-xs font-medium transition-colors duration-300 ${
              mode === "join" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t("home.joinTab")}
          </button>
        </div>

        {/* L'Omnibox d'accueil */}
        <Omnibox
          ref={inputRef}
          value={isUsernameInput ? username : roomCode}
          onChange={(e) => {
            if (isUsernameInput) {
              setUsername(e.target.value);
            } else {
              setRoomCode(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          mode={mode}
          placeholder={placeholder}
          buttonText={buttonText}
          badge={
            mode === "join" && joinStep === "username"
              ? {
                  text: `#${validatedRoomCode}`,
                  onRemove: handleCancelValidatedCode,
                }
              : null
          }
          onSubmit={handleSubmit}
          isLoading={isLoading}
          autoFocus
        />
      </div>
    </div>
  );
}
