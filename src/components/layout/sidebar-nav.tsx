"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/components/layout/nav-items";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarNavProps {
  /** Compact (icon-only) mode — driven by the provider on desktop. */
  collapsed: boolean;
  /** Called when a nav link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
  /** Renders a close button for the mobile drawer header. */
  onClose?: () => void;
}

/**
 * Shared sidebar contents: brand, navigation sections, and a user profile
 * footer. Used both by the fixed desktop sidebar and the mobile drawer.
 */
export function SidebarNav({ collapsed, onNavigate, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.permission || can(item.permission)
    ),
  })).filter((section) => section.items.length > 0);

  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : "Nexus User";
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "NX";
  const email = user?.email ?? "user@nexus.dev";

  return (
    <div className="flex h-full w-full flex-col">
      {/* Brand header */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b px-4",
          collapsed && "justify-center px-2"
        )}
      >
        <Link
          href="/"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 overflow-hidden",
            collapsed && "justify-center"
          )}
          aria-label="Nexus Admin home"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          {!collapsed && (
            <span className="truncate text-lg font-semibold tracking-tight">
              Nexus<span className="text-primary">Admin</span>
            </span>
          )}
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="flex flex-col gap-6 px-3 py-4" aria-label="Main navigation">
          {sections.map((section) => (
            <div key={section.label} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const link = (
                    <Link
                      key={item.title}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                        collapsed && "justify-center px-0",
                        active &&
                          "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                      )}
                    >
                      <item.icon className="size-5 shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                      {!collapsed && item.badge && (
                        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={item.title}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User profile + logout */}
      <div className="shrink-0 border-t p-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mx-auto flex size-10 rounded-xl"
                aria-label="Account menu"
              >
                <Avatar className="size-9">
                  <AvatarImage src="" alt="" />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{fullName}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
            <Avatar className="size-10">
              <AvatarImage src="" alt="" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Log out"
              onClick={() => logout()}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
