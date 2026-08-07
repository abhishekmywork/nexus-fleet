"use client";

import * as React from "react";
import { Menu, Plus, Search } from "lucide-react";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { RedisStatusIndicator } from "@/components/common/redis-status-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Sticky top navigation bar: mobile menu, global search (⌘K / Ctrl+K),
 * theme switcher, notifications, and a quick action button.
 */
export function Header() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Focus the global search when Cmd/Ctrl+K is pressed.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
        {/* Mobile drawer trigger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>

        {/* Global search */}
        <div className="relative flex w-full max-w-md items-center">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchRef}
            type="search"
            placeholder="Search anything…"
            className="h-10 rounded-xl pl-9 pr-14 shadow-sm [&::-webkit-search-cancel-button]:hidden"
            aria-label="Global search"
          />
          <kbd
            className="pointer-events-none absolute right-3 hidden items-center gap-0.5 rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground sm:inline-flex"
            aria-hidden="true"
          >
            <span className="text-[10px]">⌘</span>K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <RedisStatusIndicator />
          <ThemeToggle />
          <NotificationsMenu />
          <Button className="hidden h-10 items-center gap-1.5 rounded-xl px-4 sm:inline-flex">
            <Plus className="size-4" aria-hidden="true" /> New Entry
          </Button>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[280px] p-0"
          showCloseButton={false}
        >
          <TooltipProvider>
            <SidebarNav
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
              onClose={() => setMobileOpen(false)}
            />
          </TooltipProvider>
        </SheetContent>
      </Sheet>
    </>
  );
}
