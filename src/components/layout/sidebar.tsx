"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";

/**
 * Fixed desktop sidebar. Slides between an expanded (260px) and a
 * collapsed icon-only (76px) state. Hidden on mobile — the drawer there
 * is rendered by the header instead.
 */
export function Sidebar() {
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out lg:flex lg:flex-col",
        collapsed ? "w-[76px]" : "w-[260px]"
      )}
      aria-label="Sidebar"
    >
      <SidebarNav collapsed={collapsed} />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapsed}
        className="absolute -right-4 top-[52px] z-10 size-8 rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-accent"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronsRight className="size-4" aria-hidden="true" />
        ) : (
          <ChevronsLeft className="size-4" aria-hidden="true" />
        )}
      </Button>
    </aside>
  );
}
