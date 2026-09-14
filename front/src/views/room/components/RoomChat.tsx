import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/types/room";
import { getParticipantColor } from "@/lib/utils";

export interface RoomChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isChatDisabled?: boolean;
}

/**
 * Panneau de discussion textuelle en direct avec défilement automatique et formulaire de saisie.
 */
export function RoomChat({
  messages,
  onSendMessage,
  isChatDisabled = false,
}: RoomChatProps) {
  const { t } = useTranslation("room");
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le dernier message reçu
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isChatDisabled) return;
    onSendMessage(text);
    setChatInput("");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 pt-2">
      {/* Flux de messages défilable */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-4">
            <p className="text-xs font-mono text-zinc-500">{t("hub.chatEmpty")}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const color = getParticipantColor(msg.user_id);
            return (
              <div key={msg.id} className="text-xs flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold font-mono text-[11px] ${color.text}`}>
                    {msg.username}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600">{msg.time}</span>
                </div>
                <p className="text-zinc-300 break-words text-xs leading-relaxed bg-white/[0.02] p-2 rounded-sm border border-white/5">
                  {msg.content}
                </p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Saisie et envoi de message */}
      <form onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          disabled={isChatDisabled}
          placeholder={t("hub.chatPlaceholder")}
          maxLength={500}
          className="flex-1 h-8 px-2.5 bg-black/50 border border-white/10 rounded-sm text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#0ac8b9]/50 transition-colors"
        />
        <Button
          type="submit"
          size="icon"
          variant="teal"
          disabled={isChatDisabled || !chatInput.trim()}
          className="h-8 w-8 shrink-0"
          aria-label={t("hub.sendAria")}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
}

export default RoomChat;
