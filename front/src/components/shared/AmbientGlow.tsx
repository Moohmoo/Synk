export interface AmbientGlowProps {
  color?: "cyan" | "red" | "none";
  position?: "center" | "bottom";
  className?: string;
}

const GLOW_GRADIENTS: Record<"cyan" | "red", string> = {
  cyan: "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(10, 200, 185, 0.25) 0%, rgba(15, 60, 90, 0.12) 40%, transparent 70%)",
  red: "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(255, 70, 85, 0.25) 0%, rgba(180, 20, 40, 0.08) 40%, transparent 70%)",
};

export function AmbientGlow({
  color = "cyan",
  position = "center",
  className = "",
}: AmbientGlowProps) {
  const isNone = color === "none";
  const background = isNone ? "none" : GLOW_GRADIENTS[color];

  // Transition fluide verticale : même ancrage top et même transform pour éviter tout saut ou bord coupé
  const positionClasses =
    position === "bottom"
      ? "top-[78%] left-1/2 -translate-x-1/2 -translate-y-1/2"
      : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";

  return (
    <div
      style={{ background }}
      className={`absolute w-[1400px] h-[750px] pointer-events-none transition-all duration-700 ease-out select-none ${positionClasses} ${
        isNone ? "opacity-0 scale-95" : "opacity-100 scale-100"
      } ${className}`}
      aria-hidden="true"
    />
  );
}

export default AmbientGlow;

