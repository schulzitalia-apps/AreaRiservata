"use client";

import { useIsMobile } from "@/design/hooks/use-mobile";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type SidebarMode = "expanded" | "collapsed" | "hover";

type SidebarContextType = {
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
  cycleMode: () => void;

  // Mobile overlay
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;

  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
}

const STORAGE_KEY = "sidebar-mode";

export function SidebarProvider({
                                  children,
                                  defaultOpen = true,
                                  defaultMode = "expanded",
                                }: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  defaultMode?: SidebarMode;
}) {
  const isMobile = useIsMobile();

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [mode, setModeState] = useState<SidebarMode>(defaultMode);

  // carica mode da localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as SidebarMode | null;
      if (saved === "expanded" || saved === "collapsed" || saved === "hover") {
        setModeState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const setMode = (next: SidebarMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const cycleMode = () => {
    setMode(mode === "expanded" ? "collapsed" : mode === "collapsed" ? "hover" : "expanded");
  };

  // comportamento mobile: chiude; desktop: aperta (overlay non usato)
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }, [isMobile]);

  function toggleSidebar() {
    setIsOpen((prev) => !prev);
  }

  const value = useMemo(
    () => ({
      mode,
      setMode,
      cycleMode,
      isOpen,
      setIsOpen,
      isMobile,
      toggleSidebar,
    }),
    [mode, isOpen, isMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
