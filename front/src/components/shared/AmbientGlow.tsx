import { cn } from "@/lib/utils";

export interface AmbientGlowProps {
  className?: string;
  disabled?: boolean;
}

interface GlowSideProps {
  side: "left" | "right";
}

/**
 * Halo latéral individuel projetant son flux lumineux vers le centre.
 */
function GlowSide({ side }: GlowSideProps) {
  const isLeft = side === "left";
  const sidePosition = isLeft ? "-left-10 top-[-6%]" : "right-0 top-0";
  const blueGradient = isLeft
    ? "radial-gradient(ellipse 100% 80% at -10% 10%, rgba(23, 37, 84, 0.5) 0%, rgba(30, 58, 138, 0.22) 40%, transparent 75%)"
    : "radial-gradient(ellipse 100% 80% at 100% 20%, rgba(23, 37, 84, 0.85) 0%, rgba(30, 58, 138, 0.45) 35%, transparent 75%)";
  const cyanGradient = isLeft
    ? "radial-gradient(ellipse 100% 75% at -10% 28%, rgba(8, 145, 178, 0.3) 0%, rgba(10, 200, 185, 0.12) 40%, transparent 80%)"
    : "radial-gradient(ellipse 100% 75% at 100% 38%, rgba(8, 145, 178, 0.6) 0%, rgba(10, 200, 185, 0.25) 40%, transparent 80%)";

  return (
    <div className={cn("absolute h-full w-[540px] overflow-hidden pointer-events-none", sidePosition)}>
      {/* 1. Halo supérieur : Bleu Nuit */}
      <div
        className={cn("absolute top-0 w-[480px] h-[55%] blur-[72px]", isLeft ? "left-0" : "right-0")}
        style={{ background: blueGradient }}
      />

      {/* 2. Halo médian : Cyan sombre et diffus */}
      <div
        className={cn("absolute top-[18%] w-[520px] h-[68%] blur-[76px]", isLeft ? "left-0" : "right-0")}
        style={{ background: cyanGradient }}
      />
    </div>
  );
}

/**
 * AmbientGlow : Lueurs d'ambiance Cyber-Tech face-à-face (Minimalisme Mécanique).
 * Projette deux faisceaux symétriques (gauche et droite) qui se rejoignent vers le centre.
 */
export function AmbientGlow({ className, disabled = false }: AmbientGlowProps) {
  if (disabled) return null;

  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0 pointer-events-none select-none z-0 overflow-hidden", className)}
    >
      <GlowSide side="left" />
      <GlowSide side="right" />

      {/* Texture grain anti-banding argentique unifiée */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export default AmbientGlow;
