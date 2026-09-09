import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { AmbientGlow } from "@/components/shared";
import { useUIStore } from "@/stores/uiStore";

export function DashboardLayout() {
  const glowColor = useUIStore((state) => state.glowColor);
  const isFullscreen = useUIStore((state) => state.isFullscreen);

  return (
    <div className="relative h-screen w-screen flex flex-col bg-[#09090b] text-white overflow-hidden select-none">
      {/* Fond atmosphérique global (désactivé en plein écran cinéma pour noir profond) */}
      {!isFullscreen && <AmbientGlow color={glowColor} />}

      {/* Top Navbar (masquée en plein écran) */}
      {!isFullscreen && <Navbar className="relative z-20" />}

      {/* Conteneur principal des 3 colonnes */}
      <div
        className={
          isFullscreen
            ? "flex-1 w-full h-full flex overflow-hidden min-h-0 relative z-10"
            : "flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-0 flex flex-row overflow-hidden min-h-0 relative z-10"
        }
      >
        {/* Colonne de Gauche (masquée en plein écran) */}
        {!isFullscreen && <LeftSidebar />}

        {/* Zone centrale (Main Content) : pleine page sans padding en plein écran */}
        <main
          className={
            isFullscreen
              ? "flex-1 w-full h-full min-w-0 p-0 flex flex-col justify-center items-center relative z-10 overflow-hidden"
              : "flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col justify-start relative z-10"
          }
        >
          <Outlet />
        </main>

        {/* Colonne de Droite (masquée en plein écran) */}
        {!isFullscreen && <RightSidebar />}
      </div>
    </div>
  );
}

export default DashboardLayout;
