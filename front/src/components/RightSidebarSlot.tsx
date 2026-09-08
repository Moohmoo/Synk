import { createPortal } from "react-dom";
import { useEffect, useState, ReactNode } from "react";

export interface RightSidebarSlotProps {
  children: ReactNode;
}

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
