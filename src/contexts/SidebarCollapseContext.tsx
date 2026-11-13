"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";

const STORAGE_KEY = "desktop_sidebar_collapsed";

type SidebarCollapseContextValue = {
  isCollapsed: boolean;
  toggleSidebar: () => void;
};

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(
  null
);

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(STORAGE_KEY, (raw) => raw === "true");

  const toggleSidebar = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed, setIsCollapsed]);

  const value = useMemo(
    () => ({ isCollapsed, toggleSidebar }),
    [isCollapsed, toggleSidebar]
  );

  return (
    <SidebarCollapseContext.Provider value={value}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse() {
  const context = useContext(SidebarCollapseContext);
  if (!context) {
    throw new Error(
      "useSidebarCollapse must be used within SidebarCollapseProvider"
    );
  }
  return context;
}
