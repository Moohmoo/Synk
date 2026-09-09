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
    <div className="relative flex-1 flex flex-col items-center justify-center w-full max-w-full px-6 md:px-12 py-10">
      {/* Conteneur principal */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Titre & Sous-titre en superposition de grille (zéro layout shift) */}
        <div className="grid grid-cols-1 grid-rows-1 place-items-center mb-8 max-w-lg text-center select-none">
          {/* État Mode Créer */}
          <div
            className={`col-start-1 row-start-1 flex flex-col items-center transition-all duration-300 ease-out ${
              mode === "create"
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-100 to-zinc-400">
              {t("home.createTitle")}
            </h1>
            <p className="text-xs sm:text-sm font-mono text-zinc-500 mt-2">
              {t("home.createSubtitle")}
            </p>
          </div>

          {/* État Mode Rejoindre */}
          <div
            className={`col-start-1 row-start-1 flex flex-col items-center transition-all duration-300 ease-out ${
              mode === "join"
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-100 to-zinc-400">
              {t("home.joinTitle")}
            </h1>
            <p className="text-xs sm:text-sm font-mono text-zinc-500 mt-2">
              {t("home.joinSubtitle")}
            </p>
          </div>
        </div>

        {/* Le sélecteur de mode : deux gouttes connectées par un pont rectangulaire */}
        <div className="relative flex items-center mb-8 mx-auto select-none">
          {/* Goutte Gauche (Créer) */}
          <button
            type="button"
            onClick={() => handleSwitchMode("create")}
            className={`relative z-10 px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 border ${
              mode === "create"
                ? "bg-[#27272a] text-white border-white/15 shadow-lg shadow-red-500/10"
                : "bg-[#18181b] text-zinc-500 border-white/5 hover:text-zinc-300"
            }`}
          >
            {t("home.createTab")}
          </button>

          {/* Pont rectangulaire reliant les deux gouttes */}
          <div className="w-5 h-2.5 bg-[#18181b] border-y border-white/5 -mx-1.5 z-0" />

          {/* Goutte Droite (Rejoindre) */}
          <button
            type="button"
            onClick={() => handleSwitchMode("join")}
            className={`relative z-10 px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 border ${
              mode === "join"
                ? "bg-[#27272a] text-white border-white/15 shadow-lg shadow-cyan-500/10"
                : "bg-[#18181b] text-zinc-500 border-white/5 hover:text-zinc-300"
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
