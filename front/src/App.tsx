import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { HomeView } from "@/views/home/HomeView";
import { RoomView } from "@/views/room/RoomView";
import { NotFoundView } from "@/views/NotFoundView";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  // Invalidation proactive du BFCache (Back/Forward Cache) des navigateurs
  // Si l'utilisateur revient via le bouton Précédent/Undo et que la page est restaurée depuis le cache mémoire,
  // les sockets et les iframes tierces sont zombifiés par le navigateur.
  // Détecter event.persisted permet un rechargement automatique et transparent (équivalent Ctrl+R).
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // 1. Restauration depuis le BFCache RAM
      if (event.persisted) {
        window.location.reload();
        return;
      }
      // 2. Navigation d'historique Back/Forward (Undo) détectée via PerformanceNavigationTiming
      try {
        const navEntries = performance.getEntriesByType("navigation");
        if (navEntries.length > 0) {
          const nav = navEntries[0] as PerformanceNavigationTiming;
          if (nav.type === "back_forward" && window.location.pathname.startsWith("/room/")) {
            window.location.reload();
          }
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomeView />} />
          <Route path="/room/:roomId" element={<RoomView />} />
          <Route path="*" element={<NotFoundView />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
