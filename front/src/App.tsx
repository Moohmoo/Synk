import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { HomeView } from "@/views/home/HomeView";
import { RoomView } from "@/views/room/RoomView";
import { NotFoundView } from "@/views/NotFoundView";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeView />} />
            <Route path="/room/:roomId" element={<RoomView />} />
            <Route path="*" element={<NotFoundView />} />
          </Route>
        </Routes>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </BrowserRouter>
    </TooltipProvider>
  );
}
