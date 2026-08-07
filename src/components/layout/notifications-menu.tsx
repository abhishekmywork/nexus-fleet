"use client";

import * as React from "react";
import { Bell, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EVENT_TYPE_LABELS } from "@/components/events/events-table";
import type { NotificationLog } from "@/lib/auth-types";

export function NotificationsMenu() {
  const [logs, setLogs] = React.useState<NotificationLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await api.notifications.getLogs(1, 20);
        setLogs(res.data);
        setTotal(res.meta.total);
      } catch {
        // Silent — menu is non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={`Notifications, ${total} total`}
        >
          <Bell className="size-5" aria-hidden="true" />
          {total > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">
            Notifications
          </DropdownMenuLabel>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">
              {total} total
            </span>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "flex gap-3 border-l-2 px-3 py-2.5 text-left",
                  log.status === "failed"
                    ? "border-red-500 bg-red-50/50"
                    : log.status === "sent"
                      ? "border-green-500 bg-green-50/30"
                      : "border-transparent"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {EVENT_TYPE_LABELS[log.eventType as keyof typeof EVENT_TYPE_LABELS] ?? log.eventType}
                    </span>
                    <Badge
                      variant={log.channel === "email" ? "default" : "outline"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {log.channel}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {log.recipients.join(", ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    {new Date(log.createdAt).toLocaleString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {log.status === "failed" && log.errorMessage && (
                      <span className="text-red-500 ml-1">
                        — {log.errorMessage}
                      </span>
                    )}
                  </p>
                </div>
                <Badge
                  variant={
                    log.status === "sent"
                      ? "success"
                      : log.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                  className="mt-1 text-[10px] shrink-0"
                >
                  {log.status}
                </Badge>
              </div>
            ))
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="p-1">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <a href="/settings">View notification settings</a>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
