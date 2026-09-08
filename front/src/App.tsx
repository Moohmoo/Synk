import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { HomeView } from "@/views/home/HomeView";
import { RoomView } from "@/views/room/RoomView";
import { NotFoundView } from "@/views/NotFoundView";
import { Toaster } from "@/components/ui/sonner";

export function App() {
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
