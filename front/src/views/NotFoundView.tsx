import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotFoundViewProps {
  code?: string;
  title?: string;
  description?: string;
}

/**
 * Vue d'erreur / introuvable 404 :
 * Calquée sur la DA sobre de la vue d'accueil (centre optique sous le halo, typographie soignée).
 */
export function NotFoundView({ code = "404", title, description }: NotFoundViewProps = {}) {
  const { t } = useTranslation("global");

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center w-full max-w-full px-4 sm:px-6 md:px-12 py-10 animate-fade-in select-none">
      {/* Conteneur principal rehaussé au centre optique du halo (symétrie avec HomeView) */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full -translate-y-8 sm:-translate-y-12">
        {/* Capsule iconique sobre */}
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800/80 border border-white/10 mb-4 text-[#0ac8b9] shadow-sm">
          <Compass className="w-5 h-5" />
        </div>

        {/* Badge technique de code d'état */}
        <div className="inline-flex items-center px-2.5 py-0.5 mb-3 rounded-md bg-zinc-800/90 border border-white/10 text-[11px] font-mono font-semibold text-zinc-400">
          <span>STATUS // {code}</span>
        </div>

        {/* Titre canonique identique à Heading.tsx */}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100 mb-2.5 font-sans">
          {title ?? t("notFound.title")}
        </h1>

        {/* Sous-titre ou description contextuelle */}
        <p className="text-sm font-normal text-zinc-400 mb-8 max-w-sm text-center leading-relaxed font-sans">
          {description ?? t("notFound.description", { defaultValue: "La page ou le salon que vous recherchez n'existe pas ou a expiré." })}
        </p>

        {/* Bouton de retour vers l'accueil */}
        <Link to="/" className="inline-block">
          <Button variant="primary" size="default" className="gap-2 font-sans font-bold">
            <ArrowLeft className="w-4 h-4" />
            <span>{t("notFound.backHome")}</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default NotFoundView;
