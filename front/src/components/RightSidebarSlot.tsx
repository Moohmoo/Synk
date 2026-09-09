import { createPortal } from "react-dom";
import { useEffect, useState, ReactNode } from "react";

export interface RightSidebarSlotProps {
  children: ReactNode;
}

/**
 * Portail React (Portal) permettant d'injecter dynamiquement du contenu contextuel
 * depuis une vue enfant (ex: RoomView) directement dans le conteneur de la RightSidebar du layout.
 */
export function RightSidebarSlot({ children }: RightSidebarSlotProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const container = document.getElementById("right-sidebar-slot");
  if (!container) return null;

  return createPortal(children, container);
}

export default RightSidebarSlot;
