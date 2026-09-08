import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Tv2 } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

export function NotFoundView() {
  const { t } = useTranslation("global");
  const setGlowColor = useUIStore((s) => s.setGlowColor);

  useEffect(() => {
    setGlowColor("red");
    return () => setGlowColor("cyan");
  }, [setGlowColor]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-zinc-100 font-sans select-none">
      <div className="w-16 h-16 bg-[#18181b]/80 border border-white/10 flex items-center justify-center mb-6 rounded-xl shadow-lg">
        <Tv2 className="w-8 h-8 text-[#ff4655]" />
      </div>

      <h1 className="text-4xl font-mono font-extrabold tracking-widest text-zinc-100 mb-2">
        404
      </h1>

      <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-6">
        {t("notFound.title")}
      </p>

      <Link to="/">
        <Button variant="primary" size="default" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>{t("notFound.backHome")}</span>
        </Button>
      </Link>
    </div>
  );
}

export default NotFoundView;
