import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Omnibox } from "@/components/shared";
import { roomApi } from "@/services/roomApi";
import { validateUsername } from "@/lib/validation";
import { formatErrorMessage } from "@/lib/errorMapper";
import { sessionManager } from "@/lib/session";
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
  const [createUsername, setCreateUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [validatedRoomCode, setValidatedRoomCode] = useState("");
  const [joinUsername, setJoinUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  // Pré-remplir avec le dernier pseudo utilisé si disponible
  useEffect(() => {
    const lastUser = sessionManager.getLastUsername();
    if (lastUser) {
      setCreateUsername(lastUser);
      setJoinUsername(lastUser);
    }
  }, []);

  // Synchronise la lueur d'ambiance avec le mode actif (rouge pour créer, cyan pour rejoindre)
  useEffect(() => {
    setGlowColor(mode === "create" ? "red" : "cyan");
  }, [mode, setGlowColor]);

  const extractRoomCode = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.includes("/room/")) {
      return (
        trimmed.split("/room/").pop()?.split("?")[0].split("#")[0] || ""
      );
    }
    return trimmed;
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
          if (searchParams.has("join")) {
            setSearchParams({}, { replace: true });
          }
        }
      })
      .catch((err) => {
        toast.error(formatErrorMessage(err, t), { id: "home-join-error" });
        setJoinStep("code");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [searchParams, setSearchParams, t]);

  const handleSwitchMode = (newMode: "create" | "join") => {
    setMode(newMode);
    if (newMode === "create") {
      setJoinStep("code");
      if (searchParams.has("join")) {
        setSearchParams({}, { replace: true });
      }
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleCancelValidatedCode = () => {
    setJoinStep("code");
    if (searchParams.has("join")) {
      setSearchParams({}, { replace: true });
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mode === "join" && joinStep === "username") {
      if ((e.key === "Backspace" && !joinUsername) || e.key === "Escape") {
        e.preventDefault();
        handleCancelValidatedCode();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      if (mode === "create") {
        const valError = validateUsername(createUsername, (key) =>
          t(key, { ns: "validation" })
        );
        if (valError) {
          toast.error(valError, { id: "home-val-error" });
          isSubmittingRef.current = false;
          return;
        }
        const username = createUsername.trim();

        setIsLoading(true);
        try {
          const data = await roomApi.createRoom(username);
          const newRoomId = data.room_id;

          sessionManager.setRoomSession(newRoomId, {
            username,
            token: data.host_token,
            userId: data.user_id,
          });

          navigate(`/room/${newRoomId}`);
        } catch (err: any) {
          toast.error(formatErrorMessage(err, t), { id: "home-api-error" });
          setIsLoading(false);
          isSubmittingRef.current = false;
        }
      } else if (joinStep === "code") {
        // Étape 1 : Validation stricte de l'existence du salon via roomApi
        const cleanRoomCode = extractRoomCode(roomCode);
        if (!cleanRoomCode) {
          toast.error(formatErrorMessage("MISSING_ROOM_CODE", t), { id: "home-room-code-error" });
          isSubmittingRef.current = false;
          return;
        }

        setIsLoading(true);
        try {
          const check = await roomApi.checkRoom(cleanRoomCode);
          if (!check.exists) {
            toast.error(formatErrorMessage("ROOM_NOT_FOUND", t), { id: "home-room-not-found" });
            setIsLoading(false);
            isSubmittingRef.current = false;
            return;
          }

          setValidatedRoomCode(cleanRoomCode);
          setJoinStep("username");
          setIsLoading(false);
          isSubmittingRef.current = false;
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        } catch (err: any) {
          toast.error(formatErrorMessage(err, t), { id: "home-api-error" });
          setIsLoading(false);
          isSubmittingRef.current = false;
        }
      } else {
        // Étape 2 : Saisie du pseudo et entrée dans le salon
        const valError = validateUsername(joinUsername, (key) =>
          t(key, { ns: "validation" })
        );
        if (valError) {
          toast.error(valError, { id: "home-val-error" });
          isSubmittingRef.current = false;
          return;
        }
        const username = joinUsername.trim();

        sessionManager.setRoomSession(validatedRoomCode, {
          username,
        });
        navigate(`/room/${validatedRoomCode}`);
      }
    } catch {
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full pt-10 pb-32 w-full max-w-full px-6 md:px-12">
      {/* CONTENEUR DU PREMIER PLAN (Z-Index) */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* LE SWITCH (Effet Sliding Pill) */}
        <div className="relative flex p-1 mb-6 bg-[#18181b] rounded-md border border-white/5 mx-auto">
          {/* Le fond coulissant (La pilule) */}
          <div
            className={`absolute top-1 bottom-1 left-1 w-[120px] bg-[#27272a] rounded shadow-sm transition-transform duration-300 ease-out ${
              mode === "create" ? "translate-x-0" : "translate-x-[120px]"
            }`}
          />

          {/* Bouton Créer */}
          <button
            type="button"
            onClick={() => handleSwitchMode("create")}
            className={`relative z-10 w-[120px] text-center px-3 py-1 text-xs font-medium transition-colors duration-300 ${
              mode === "create" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t("home.createTab")}
          </button>

          {/* Bouton Rejoindre */}
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

        {/* L'OMNIBOX (Composant extrait et workflow séquentiel) */}
        <Omnibox
          ref={inputRef}
          value={
            mode === "create"
              ? createUsername
              : joinStep === "code"
              ? roomCode
              : joinUsername
          }
          onChange={(e) => {
            if (mode === "create") {
              setCreateUsername(e.target.value);
            } else if (joinStep === "code") {
              setRoomCode(e.target.value);
            } else {
              setJoinUsername(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          mode={mode}
          placeholder={
            mode === "create"
              ? t("home.createPlaceholder")
              : joinStep === "code"
              ? t("home.joinCodePlaceholder")
              : t("home.joinUsernamePlaceholder")
          }
          buttonText={
            mode === "create"
              ? undefined
              : joinStep === "code"
              ? isLoading
                ? t("home.checking")
                : t("home.next")
              : isLoading
              ? t("home.connecting")
              : t("home.join")
          }
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

export default HomeView;
