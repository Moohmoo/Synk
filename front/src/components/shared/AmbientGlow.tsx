export interface AmbientGlowProps {
  color?: "cyan" | "red" | "none";
  className?: string;
}

const GLOW_GRADIENTS: Record<"cyan" | "red", string> = {
  cyan: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(10, 200, 185, 0.22) 0%, rgba(15, 60, 90, 0.12) 45%, transparent 75%)",
  red: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255, 70, 85, 0.22) 0%, rgba(180, 20, 40, 0.08) 45%, transparent 75%)",
};

export function AmbientGlow({ color = "cyan", className = "" }: AmbientGlowProps) {
  const isNone = color === "none";
  const background = isNone ? "none" : GLOW_GRADIENTS[color];

  return (
    <div
      style={{ background }}
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[700px] pointer-events-none transition-all duration-700 ease-out select-none ${
        isNone ? "opacity-0 scale-95" : "opacity-100 scale-100"
      } ${className}`}
      aria-hidden="true"
    />
  );
}

export default AmbientGlow;

