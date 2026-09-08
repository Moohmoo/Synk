export interface AmbientGlowProps {
  color?: "cyan" | "red" | "none";
  className?: string;
}

export function AmbientGlow({ color = "cyan", className = "" }: AmbientGlowProps) {
  const isNone = color === "none";
  const colorClass = color === "red" ? "bg-[#ff4655]" : "bg-[#0ac8b9]";

  return (
    <div
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[520px] rounded-full blur-[140px] pointer-events-none transition-all duration-700 ease-out ${
        isNone ? "opacity-0 scale-95" : "opacity-25 scale-100"
      } ${colorClass} ${className}`}
      aria-hidden="true"
    />
  );
}

export default AmbientGlow;

