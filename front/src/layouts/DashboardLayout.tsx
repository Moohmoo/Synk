import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { AmbientGlow } from "@/components/shared";
import { useUIStore } from "@/stores/uiStore";

export function DashboardLayout() {
  const location = useLocation();
  const isRoom = location.pathname.startsWith("/room/");
  const glowColor = useUIStore((state) => state.glowColor);

  return (
    <div className="relative h-screen w-screen flex flex-col bg-[#09090b] text-white overflow-hidden select-none">
      {/* Fond atmosphérique global */}
      <AmbientGlow color={glowColor} position={isRoom ? "bottom" : "center"} />

      {/* Top Navbar */}
      <Navbar className="relative z-20" />

      {/* Conteneur principal des 3 colonnes avec marges fluides */}
      <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-0 flex flex-row overflow-hidden min-h-0 relative z-10">
        {/* Colonne de Gauche (Navigation principale) */}
        <LeftSidebar />

        {/* Zone centrale (Main Content) - fond transparent pour laisser transparaître le glow */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col justify-start relative z-10">
          <Outlet />
        </main>

        {/* Colonne de Droite (Contexte dynamique) */}
        <RightSidebar />
      </div>
    </div>
  );
}

export default DashboardLayout;
