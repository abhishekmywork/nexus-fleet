"use client";

import * as React from "react";
import { createContext, useContext, useSyncExternalStore } from "react";

interface SidebarContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile drawer open state */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = "nexus-sidebar-collapsed";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot() {
  return false;
}

/**
 * Provides sidebar collapse + mobile-drawer state.
 * The collapse preference is persisted to localStorage so it survives
 * reloads. `useSyncExternalStore` keeps SSR snapshots consistent without
 * triggering a cascading render in an effect.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribe,
    getCollapsedSnapshot,
    getServerSnapshot
  );
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    window.localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return ctx;
}
